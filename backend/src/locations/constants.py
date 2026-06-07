from enum import Enum


class LocationType(Enum):
    BUILDING = "building"
    ROOM = "room"
    CABINET = "cabinet"
    SHELF = "shelf"


DEFAULT_ROOT_LOCATION_NAMES = ("D10", "D11")
