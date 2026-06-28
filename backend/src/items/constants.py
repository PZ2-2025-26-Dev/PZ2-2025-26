from enum import Enum

ITEM_NAME_LENGTH = 128
ITEM_DESC_LENGTH = 256
ATTACHMENT_FILENAME_MAX_LENGTH = 255
ATTACHMENT_MIME_TYPE_MAX_LENGTH = 127
ATTACHMENT_MAX_SIZE_BYTES = 50 * 1024 * 1024
BASIC_LENGTH = 100


class ItemStatus(Enum):
    AVAILABLE = "available"
    PENDING_APPROVAL = "pending_approval"
    RESERVED = "reserved"
    LOANED = "loaned"
    BROKEN = "broken"
    MISSING = "missing"
    OVERDUE = "overdue"


class ItemChangeLogType(Enum):
    CREATED = "created"
    LOANED = "loaned"
    OWNER_CHANGED = "owner_changed"
    LOCATION_CHANGED = "location_changed"
    CATEGORY_CHANGED = "category_changed"


class ItemPermissionType(Enum):
    AUTO_APPROVED_LOAN = "auto_approved_loan"
    EDIT_LOCATION = "edit_location"
    EDIT_DESCRIPTION = "edit_description"
    EDIT_PARAMETERS = "edit_parameters"
    EDIT_ATTACHMENTS = "edit_attachments"


ITEM_UPDATE_FIELD_PERMISSIONS: dict[str, ItemPermissionType] = {
    "location_id": ItemPermissionType.EDIT_LOCATION,
    "description": ItemPermissionType.EDIT_DESCRIPTION,
    "parameters": ItemPermissionType.EDIT_PARAMETERS,
}

# Pola krytyczne — tylko właściciel lub administrator.
ITEM_UPDATE_CRITICAL_FIELDS: frozenset[str] = frozenset(
    {
        "name",
        "category_id",
        "owner_id",
    }
)
