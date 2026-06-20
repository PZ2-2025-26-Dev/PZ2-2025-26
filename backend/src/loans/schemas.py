from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from src.auth.schemas import UserID
from src.items.schemas import ItemID
from src.loans.constants import LOAN_PURPOSE_MAX_LENGTH, LoanStatus

type LoanID = int
type LoanPurpose = Annotated[str, Field(min_length=1, max_length=LOAN_PURPOSE_MAX_LENGTH)]


class LoanCreate(BaseModel):
    item_id: ItemID
    borrower_id: UserID
    declared_return_date: datetime
    loan_purpose: LoanPurpose | None = None


class LoanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: LoanID
    item_id: ItemID
    borrower_id: UserID
    registered_by: UserID
    created_at: datetime
    declared_return_date: datetime
    loan_purpose: LoanPurpose | None
    returned_at: datetime | None
    status: LoanStatus


class LoansPaged(BaseModel):
    loans: list[LoanResponse]
    total_count: int
