from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from src.auth.constants import AuthProvider, UserRole, UserStatus
from src.auth.schemas import Name, UserID

type SearchStr = Annotated[str, Field(min_length=1, max_length=255)]


class GuestUserCreate(BaseModel):
    first_name: Name
    last_name: Name | None = None
    email: EmailStr | None = None


class GuestUserUpdate(BaseModel):
    first_name: Name | None = None
    last_name: Name | None = None
    email: EmailStr | None = None


class UserBasicBrowse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UserID
    first_name: Name
    last_name: str | None = None
    role: Literal["admin", "user", "observer"]


class GuestBrowse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UserID
    first_name: Name
    last_name: str | None = None
    email: EmailStr | None = None
    role: Literal["guest"] = "guest"


class UsersBrowsePaged(BaseModel):
    users: list[UserBasicBrowse | GuestBrowse]
    total_count: int


class BaseUserDetails(BaseModel):
    email: EmailStr
    first_name: Name
    last_name: Name
    role: UserRole
    status: UserStatus


class UserDetails(BaseUserDetails):
    id: UserID
    provider: AuthProvider | None = None
    provider_user_id: str | None = None


class UserStatusUpdate(BaseModel):
    status: UserStatus


class UsersPaged(BaseModel):
    users: list[UserDetails]
    total_count: int
