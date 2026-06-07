from sqlalchemy import select
from sqlalchemy.orm import Session

from src.locations.constants import LocationType
from src.locations.models import Location
from src.locations.schemas import LocationCreate, LocationTreeNode


class LocationNotFoundError(Exception):
    pass


class InvalidLocationParentError(Exception):
    pass


PARENT_TYPE_BY_LOCATION_TYPE = {
    LocationType.BUILDING: None,
    LocationType.ROOM: LocationType.BUILDING,
    LocationType.CABINET: LocationType.ROOM,
    LocationType.SHELF: LocationType.CABINET,
}


class LocationService:
    def __init__(self, db: Session):
        self.db = db

    def create_location(self, data: LocationCreate) -> tuple[Location, str]:
        parent = self._get_valid_parent(data.type, data.parent_id)

        location = Location(
            name=data.name,
            type=data.type,
            description=data.description,
            parent_id=parent.id if parent else None,
            is_active=True,
        )

        self.db.add(location)
        self.db.commit()
        self.db.refresh(location)

        return location, self.build_path(location)

    def get_tree(self) -> list[LocationTreeNode]:
        locations = list(self.db.scalars(select(Location).order_by(Location.id)).all())
        nodes_by_id = {
            location.id: LocationTreeNode(
                id=location.id,
                name=location.name,
                type=location.type,
                description=location.description,
                is_active=location.is_active,
            )
            for location in locations
        }
        roots: list[LocationTreeNode] = []

        for location in locations:
            node = nodes_by_id[location.id]

            if location.parent_id is not None and location.parent_id in nodes_by_id:
                nodes_by_id[location.parent_id].children.append(node)
            else:
                roots.append(node)

        return roots

    def build_path(self, location: Location) -> str:
        path = [location.name]
        parent_id = location.parent_id

        while parent_id is not None:
            parent = self.db.get(Location, parent_id)

            if parent is None:
                break

            path.append(parent.name)
            parent_id = parent.parent_id

        return " / ".join(reversed(path))

    def _get_valid_parent(self, location_type: LocationType, parent_id: int | None) -> Location | None:
        expected_parent_type = PARENT_TYPE_BY_LOCATION_TYPE[location_type]

        if expected_parent_type is None:
            if parent_id is not None:
                raise InvalidLocationParentError()

            return None

        if parent_id is None:
            raise InvalidLocationParentError()

        parent = self.db.get(Location, parent_id)

        if parent is None:
            raise LocationNotFoundError()

        if parent.type != expected_parent_type:
            raise InvalidLocationParentError()

        return parent
