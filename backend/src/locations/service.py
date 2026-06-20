from sqlalchemy import func, literal, select
from sqlalchemy.orm import Session, aliased

from src.items.models import Item
from src.locations.constants import LocationHistoryChangeType
from src.locations.models import Location, LocationHistory
from src.locations.schemas import LocationCreate, LocationDetails, LocationUpdate
from src.utils import now


class LocationNotFoundError(Exception):
    pass


class InvalidLocationParentError(Exception):
    pass


class LocationHasAssignedItemsError(Exception):
    pass


class LocationService:
    def __init__(self, db: Session):
        self.db = db

    def build_location_path(self, location_id: int) -> str:
        location_path = (
            select(
                Location.id,
                Location.name,
                Location.parent_id,
                literal(0).label("depth"),
            )
            .where(Location.id == location_id)
            .cte("location_path", recursive=True)
        )
        parent = aliased(Location)
        location_path = location_path.union_all(
            select(
                parent.id,
                parent.name,
                parent.parent_id,
                (location_path.c.depth + 1).label("depth"),
            ).where(parent.id == location_path.c.parent_id)
        )
        rows = self.db.execute(select(location_path.c.name).order_by(location_path.c.depth.desc())).all()

        if not rows:
            raise LocationNotFoundError()

        return " / ".join(row.name for row in rows)

    def create_location(self, data: LocationCreate, changed_by: int | None = None) -> LocationDetails:
        self._validate_parent(data.parent_id)
        location = Location(
            name=data.name,
            type=data.type,
            parent_id=data.parent_id,
            description=data.description,
            is_active=data.is_active,
        )

        self.db.add(location)
        self.db.flush()
        self._add_history(
            location.id, LocationHistoryChangeType.CREATED, f"Created location {location.name}", changed_by
        )
        self.db.commit()

        return self.get_location(location.id)

    def get_location(self, location_id: int) -> LocationDetails:
        location = self._get_location(location_id)

        return self._to_details(location)

    def list_locations(self, page: int, limit: int, parent_id: int | None = None) -> tuple[list[LocationDetails], int]:
        stmt = select(Location).order_by(Location.id)
        count_stmt = select(func.count(Location.id))

        if parent_id is not None:
            stmt = stmt.where(Location.parent_id == parent_id)
            count_stmt = count_stmt.where(Location.parent_id == parent_id)

        locations = list(self.db.scalars(stmt.offset((page - 1) * limit).limit(limit)).all())
        total = self.db.scalar(count_stmt) or 0

        return [self._to_details(location) for location in locations], total

    def update_location(self, location_id: int, data: LocationUpdate, changed_by: int | None = None) -> LocationDetails:
        location = self._get_location(location_id)

        updated_fields = data.model_fields_set

        if "parent_id" in updated_fields:
            self._validate_parent(data.parent_id, edited_location_id=location_id)
            location.parent_id = data.parent_id
        if "name" in updated_fields:
            location.name = data.name
        if "type" in updated_fields:
            location.type = data.type
        if "description" in updated_fields:
            location.description = data.description
        if "is_active" in updated_fields:
            location.is_active = data.is_active

        self._add_history(
            location.id, LocationHistoryChangeType.UPDATED, f"Updated location {location.name}", changed_by
        )
        self.db.commit()

        return self.get_location(location.id)

    def delete_location(self, location_id: int, changed_by: int | None = None) -> int:
        location = self._get_location(location_id)
        subtree = self._location_subtree(location_id)
        subtree_ids = [location_id for location_id, _depth in subtree]

        assigned_items_count = self.db.scalar(select(func.count(Item.id)).where(Item.location_id.in_(subtree_ids))) or 0
        if assigned_items_count > 0:
            raise LocationHasAssignedItemsError()

        deleted_locations_count = len(subtree)
        self._add_history(
            location.id,
            LocationHistoryChangeType.DELETED,
            f"Deleted location {location.name}",
            changed_by,
        )
        for subtree_location_id, _depth in subtree:
            subtree_location = self._get_location_model(subtree_location_id)
            if subtree_location is not None:
                self.db.delete(subtree_location)
        self.db.commit()

        return deleted_locations_count

    def list_history(self, location_id: int) -> list[LocationHistory]:
        self._get_location(location_id)

        return list(
            self.db.scalars(
                select(LocationHistory)
                .where(LocationHistory.location_id == location_id)
                .order_by(LocationHistory.changed_at.desc(), LocationHistory.id.desc())
            ).all()
        )

    def _get_location(self, location_id: int) -> Location:
        location = self._get_location_model(location_id)

        if location is None:
            raise LocationNotFoundError()

        return location

    def _get_location_model(self, location_id: int) -> Location | None:
        return self.db.get(Location, location_id)

    def _to_details(self, location: Location) -> LocationDetails:
        return LocationDetails(
            id=location.id,
            name=location.name,
            type=location.type,
            parent_id=location.parent_id,
            description=location.description,
            is_active=location.is_active,
            path=self.build_location_path(location.id),
        )

    def _validate_parent(self, parent_id: int | None, edited_location_id: int | None = None) -> None:
        if parent_id is None:
            return
        if edited_location_id is not None and parent_id == edited_location_id:
            raise InvalidLocationParentError()

        parent = self._get_location_model(parent_id)
        if parent is None:
            raise InvalidLocationParentError()
        if edited_location_id is not None and self._is_descendant(parent_id, edited_location_id):
            raise InvalidLocationParentError()

    def _is_descendant(self, location_id: int, possible_parent_id: int) -> bool:
        current = self._get_location_model(location_id)

        while current is not None:
            if current.parent_id == possible_parent_id:
                return True
            current = self._get_location_model(current.parent_id) if current.parent_id is not None else None

        return False

    def _location_subtree(self, location_id: int) -> list[tuple[int, int]]:
        location_tree = (
            select(
                Location.id,
                literal(0).label("depth"),
            )
            .where(Location.id == location_id)
            .cte("location_tree", recursive=True)
        )
        child = aliased(Location)
        location_tree = location_tree.union_all(
            select(
                child.id,
                (location_tree.c.depth + 1).label("depth"),
            ).where(child.parent_id == location_tree.c.id)
        )

        return list(
            self.db.execute(
                select(location_tree.c.id, location_tree.c.depth).order_by(location_tree.c.depth.desc())
            ).all()
        )

    def _add_history(
        self,
        location_id: int,
        change_type: LocationHistoryChangeType,
        description: str,
        changed_by: int | None,
    ) -> None:
        self.db.add(
            LocationHistory(
                location_id=location_id,
                changed_at=now(),
                changed_by=changed_by,
                change_type=change_type,
                description=description,
            )
        )
