from enum import Enum


class LoanStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"
    LOANED = "loaned"
    RETURNED = "returned"


EXTERNAL_LOAN_PURPOSE = "external_guest_loan"
