from enum import Enum

LOCATION_NAME_MAX_LENGTH = 100


class LocationType(Enum):
    BUILDING = "building"
    ROOM = "room"
    CABINET = "cabinet"
    SHELF = "shelf"


DEFAULT_ROOT_LOCATION_NAMES = ("D10", "D11")
