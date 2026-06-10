from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator
from src.auth.schemas import UserID
from src.guests.schemas import GuestID
from src.items.schemas import ItemID
from src.loans.constants import LoanStatus

type LoanID = int


class ExternalLoanCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    item_id: ItemID = Field(alias="itemId")
    guest_id: GuestID = Field(alias="guestId")
    declared_return_date: date = Field(alias="declaredReturnDate")

    @field_validator("declared_return_date")
    @classmethod
    def validate_future_date(cls, value: date) -> date:
        if value <= date.today():
            raise ValueError("declaredReturnDate musi być datą z przyszłości")
        return value


class LoanCreateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: LoanID
    item_id: ItemID
    guest_id: GuestID
    declared_return_date: datetime
    loan_purpose: str
    status: LoanStatus
    decision_by: UserID
    decision_at: datetime
    borrowed_at: datetime
