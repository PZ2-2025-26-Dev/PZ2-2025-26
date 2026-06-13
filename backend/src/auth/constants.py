from enum import Enum


class UserStatus(Enum):
    ACTIVE = "active"
    PENDING_APPROVAL = "pending_approval"
    INACTIVE = "inactive"


class UserRole(Enum):
    ADMIN = "admin"
    USER = "user"
    OBSERVER = "observer"


class AuthProvider(Enum):
    LOCAL = "local"
    GOOGLE = "google"
