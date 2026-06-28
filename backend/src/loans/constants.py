from enum import Enum

LOAN_NOTE_MAX_LENGTH = 512


class LoanStatus(Enum):
    PENDING_APPROVAL = "pending_approval"
    ACTIVE = "active"
    RETURN_PENDING_CONFIRMATION = "return_pending_confirmation"
    CLOSED = "closed"
    REJECTED = "rejected"


class ReturnCondition(Enum):
    OK = "ok"
    BROKEN = "broken"
    MISSING = "missing"


class LoanListScope(Enum):
    MY = "my"
    OWNED = "owned"
    ALL = "all"
