from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.loans.constants import LOAN_NOTE_MAX_LENGTH, LoanListScope, LoanStatus, ReturnCondition

type LoanID = int
type LoanNote = Annotated[str, Field(min_length=1, max_length=LOAN_NOTE_MAX_LENGTH)]


class LoanCreate(BaseModel):
    item_id: UUID
    declared_return_date: datetime
    borrower_user_id: int | None = None
    guest_id: int | None = None
    note: LoanNote | None = None

    @model_validator(mode="after")
    def validate_borrower_choice(self) -> LoanCreate:
        if self.borrower_user_id is not None and self.guest_id is not None:
            raise ValueError("Można wskazać użytkownika albo gościa, ale nie obu naraz")
        return self


class LoanCreateExternal(BaseModel):
    item_id: UUID
    guest_id: int
    declared_return_date: datetime
    note: LoanNote | None = None


class LoanDecision(BaseModel):
    approved: bool = True
    note: LoanNote | None = None


class LoanReturn(BaseModel):
    condition: ReturnCondition
    note: LoanNote | None = None


class LoanConfirmReturn(BaseModel):
    approved: bool = True
    condition: ReturnCondition | None = None
    note: LoanNote | None = None


class LoanBorrowerInfo(BaseModel):
    id: int
    name: str
    role: str


class LoanItemOwner(BaseModel):
    id: int
    name: str


class LoanItemInfo(BaseModel):
    id: UUID
    name: str
    owner: LoanItemOwner


class LoanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: LoanID
    item: LoanItemInfo
    borrower: LoanBorrowerInfo | None
    status: LoanStatus
    is_external: bool
    created_at: datetime
    declared_return_date: datetime
    note: str | None
    borrowed_at: datetime | None
    returned_at: datetime | None
    decision_by: int | None
    decision_at: datetime | None
    decision_comment: str | None
    return_reported_by: int | None
    return_reported_at: datetime | None
    return_condition: ReturnCondition | None
    return_note: str | None
    return_confirmed_by: int | None
    return_confirmed_at: datetime | None
    return_confirmation_note: str | None


class LoanListResponse(BaseModel):
    loans: list[LoanResponse]


type LoanScopeQuery = LoanListScope
