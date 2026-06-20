from enum import Enum


class UserStatus(Enum):
    ACTIVE = "active"
    PENDING_APPROVAL = "pending_approval"
    INACTIVE = "inactive"
    BLOCKED = "blocked"
    REJECTED = "rejected"


class UserRole(Enum):
    ADMIN = "admin"
    USER = "user"
    OBSERVER = "observer"
    # Gość jest pełnoprawną encją User, ale nie ma własnego konta (UserAccount)
    # i nie może się logować. Służy wyłącznie jako podmiot wypożyczeń.
    GUEST = "guest"


class AuthProvider(Enum):
    LOCAL = "local"
    GOOGLE = "google"


PROVIDER_USER_ID_MAX_LENGTH = 512
