from enum import Enum

LOCATION_HISTORY_DESC_LENGTH = 512
LOCATION_NAME_LENGTH = 100


class LocationType(Enum):
    BUILDING = "building"
    ROOM = "room"
    CABINET = "cabinet"
    SHELF = "shelf"


class LocationHistoryChangeType(Enum):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"
