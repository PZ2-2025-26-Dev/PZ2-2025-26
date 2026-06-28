from enum import Enum

ITEM_NAME_LENGTH = 128
ITEM_DESC_LENGTH = 256
ATTACHMENT_FILENAME_MAX_LENGTH = 255
ATTACHMENT_MIME_TYPE_MAX_LENGTH = 127
ATTACHMENT_MAX_SIZE_BYTES = 50 * 1024 * 1024
BASIC_LENGTH = 100
ITEM_HISTORY_PAGE_LIMIT_DEFAULT = 10
ITEM_HISTORY_PAGE_LIMIT_MAX = 100


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


# Pola ItemUpdate wymagające delegacji przez ItemACL (niekrytyczne).
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

# Pola edytowalne przez właściciela przedmiotu (bez administratora).
ITEM_UPDATE_OWNER_ALLOWED_FIELDS: frozenset[str] = frozenset({"name", "location_id"})

# Statusy przedmiotu blokujące usunięcie.
ITEM_DELETE_BLOCKED_STATUSES: frozenset[ItemStatus] = frozenset(
    {
        ItemStatus.PENDING_APPROVAL,
        ItemStatus.RESERVED,
        ItemStatus.LOANED,
        ItemStatus.OVERDUE,
    }
)
