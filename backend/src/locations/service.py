from sqlalchemy import func, literal, select
from sqlalchemy.orm import Session, aliased

from src.categories.models import Category
from src.items.models import Item
from src.items.schemas import ItemCategory, ItemDetails, ItemLocation, ItemOwner, ItemPagination, ItemsPaged
from src.locations.constants import LocationHistoryChangeType
from src.locations.models import Location, LocationHistory
from src.locations.schemas import LocationCreate, LocationDetails, LocationTreeNode, LocationUpdate
from src.users.models import User
from src.utils import now


class LocationNotFoundError(Exception):
    pass


class InvalidLocationParentError(Exception):
    pass


class LocationHasChildrenError(Exception):
    pass


class LocationDeleteReplacementError(Exception):
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

    def list_location_tree(self) -> list[LocationTreeNode]:
        locations = list(self.db.scalars(select(Location).order_by(Location.id)).all())
        nodes = {
            location.id: LocationTreeNode(
                id=location.id,
                name=location.name,
                type=location.type,
                children=[],
            )
            for location in locations
        }
        roots: list[LocationTreeNode] = []

        for location in locations:
            node = nodes[location.id]
            parent = nodes.get(location.parent_id)

            if parent is None:
                roots.append(node)
            else:
                parent.children.append(node)

        return roots

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

    def delete_location(self, location_id: int, replacement_location_id: int, changed_by: int | None = None) -> int:
        location = self._get_location(location_id)
        replacement = self._get_location(replacement_location_id)

        if location.id == replacement.id:
            raise LocationDeleteReplacementError()
        if self.db.scalar(select(Location.id).where(Location.parent_id == location_id).limit(1)) is not None:
            raise LocationHasChildrenError()

        items = list(self.db.scalars(select(Item).where(Item.location_id == location_id)).all())
        for item in items:
            item.location_id = replacement.id

        migrated_items_count = len(items)
        self._add_history(
            location.id,
            LocationHistoryChangeType.DELETED,
            f"Deleted location {location.name}; moved {migrated_items_count} items to {replacement.name}",
            changed_by,
        )
        self.db.delete(location)
        self.db.commit()

        return migrated_items_count

    def list_location_items(self, location_id: int, page: int, limit: int) -> ItemsPaged:
        self._get_location(location_id)
        location_ids = self._location_subtree_ids(location_id)
        stmt = (
            select(Item, Category, User)
            .join(Category, Category.id == Item.category_id)
            .join(User, User.id == Item.owner_id)
            .where(Item.location_id.in_(location_ids))
            .order_by(Item.id)
            .offset((page - 1) * limit)
            .limit(limit)
        )
        total = self.db.scalar(select(func.count(Item.id)).where(Item.location_id.in_(location_ids))) or 0
        items = [
            ItemDetails(
                id=item.id,
                name=item.name,
                category=ItemCategory(id=category.id, name=category.name),
                location=ItemLocation(id=item.location_id, path=self.build_location_path(item.location_id)),
                owner=ItemOwner(id=owner.id, name=owner.first_name),
                description=item.description,
                status=item.status,
                legacy_id=None,
            ).model_dump()
            for item, category, owner in self.db.execute(stmt).all()
        ]

        return ItemsPaged(items=items, pagination=ItemPagination(page=page, limit=limit, total=total))

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

    def _location_subtree_ids(self, location_id: int) -> list[int]:
        location_tree = select(Location.id).where(Location.id == location_id).cte("location_tree", recursive=True)
        child = aliased(Location)
        location_tree = location_tree.union_all(select(child.id).where(child.parent_id == location_tree.c.id))

        return list(self.db.scalars(select(location_tree.c.id)).all())

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
