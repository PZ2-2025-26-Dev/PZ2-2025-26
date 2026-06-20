from enum import Enum

ITEM_NAME_LENGTH = 128
ITEM_DESC_LENGTH = 256


class ItemStatus(Enum):
    AVAILABLE = "available"
    PENDING_APPROVAL = "pending_approval"
    RESERVED = "reserved"
    LOANED = "loaned"
    BROKEN = "broken"


class ItemChangeLogType(Enum):
    CREATED = "created"
    LOANED = "loaned"
    RETURNED = "returned"
    OWNER_CHANGED = "owner_changed"
    LOCATION_CHANGED = "location_changed"
    CATEGORY_CHANGED = "category_changed"


class ItemPermissionType(Enum):
    AUTO_APPROVED_LOAN = "auto_approved_loan"
    EDIT_LOCATION = "edit_location"
