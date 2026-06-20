from pydantic import BaseModel, ConfigDict, EmailStr

from src.auth.constants import UserStatus
from src.auth.schemas import Name

type GuestID = int


class GuestCreate(BaseModel):
    first_name: Name
    last_name: Name | None = None
    email: EmailStr | None = None


class GuestUpdate(BaseModel):
    first_name: Name | None = None
    last_name: Name | None = None
    email: EmailStr | None = None


class GuestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: GuestID
    first_name: Name
    last_name: str | None = None
    email: EmailStr | None = None
    status: UserStatus


class GuestsPaged(BaseModel):
    guests: list[GuestResponse]
    total_count: int
