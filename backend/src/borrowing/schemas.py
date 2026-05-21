from datetime import datetime

from pydantic import BaseModel, Field

from src.borrowing.models import BorrowStatus


class GuestCreate(BaseModel):
    name: str
    contact_info: str


class GuestRead(GuestCreate):
    id: int
    created_by_id: int
    model_config = {"from_attributes": True}


class BorrowRequestCreate(BaseModel):
    equipment_id: int
    expected_return_date: datetime
    guest_id: int | None = None


class BorrowReturnCreate(BaseModel):
    condition_rating: int | None = Field(None, ge=1, le=5)
    return_comment: str | None = None


class BorrowRequestRead(BaseModel):
    id: int
    equipment_id: int
    requester_id: int | None
    guest_id: int | None
    status: BorrowStatus
    expected_return_date: datetime
    actual_return_date: datetime | None
    condition_rating: int | None
    return_comment: str | None
    model_config = {"from_attributes": True}
