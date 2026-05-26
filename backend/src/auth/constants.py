from enum import Enum


class UserStatus(Enum):
    ACTIVE = "active"
    PENDING_APPROVAL = "pending_approval"


class UserRole(Enum):
    ADMIN = "admin"
    ACTIVE_USER = "active_user"
    OBSERVER = "observer"
