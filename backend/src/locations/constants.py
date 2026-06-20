from enum import Enum

LOCATION_HISTORY_DESC_LENGTH = 512
LOCATION_ADDRESS_LENGTH = 255
LOCATION_NAME_LENGTH = 100
LOCATION_PAGE_LIMIT_MAX = 100


class LocationType(Enum):
    BUILDING = "building"
    ROOM = "room"
    CABINET = "cabinet"
    SHELF = "shelf"
    REMOTE = "remote"
    OTHER = "other"


class LocationHistoryChangeType(Enum):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"
