from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field

from src.loans.constants import LoanStatus

type LoanID = int
type LoanPurpose = Annotated[str, Field(min_length=1, max_length=512)]


class LoanCreate(BaseModel):
    item_id: UUID
    declared_return_date: datetime
    loan_purpose: LoanPurpose


class LoanCreateExternal(BaseModel):
    item_id: UUID
    guest_id: int
    declared_return_date: datetime
    loan_purpose: LoanPurpose


class LoanDecision(BaseModel):
    comment: str | None = None


class LoanBorrowerInfo(BaseModel):
    id: int
    name: str


class LoanItemOwner(BaseModel):
    id: int
    name: str


class LoanItemInfo(BaseModel):
    id: UUID
    name: str
    owner: LoanItemOwner


class LoanResponse(BaseModel):
    id: LoanID
    item: LoanItemInfo
    borrower: LoanBorrowerInfo | None
    status: LoanStatus
    is_external: bool
    created_at: datetime
    declared_return_date: datetime
    loan_purpose: str
    borrowed_at: datetime | None
    returned_at: datetime | None
    decision_by: int | None
    decision_at: datetime | None
    decision_comment: str | None


class LoanListResponse(BaseModel):
    loans: list[LoanResponse]
