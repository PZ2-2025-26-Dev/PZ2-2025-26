from enum import Enum


class LoanStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"
    LOANED = "loaned"
    RETURNED = "returned"
