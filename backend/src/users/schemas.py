from typing import Annotated

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


class UserSelectOption(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UserID
    first_name: Name
    last_name: str | None = None


class UsersSelectPaged(BaseModel):
    users: list[UserSelectOption]
    total_count: int


class BaseUserDetails(BaseModel):
    email: EmailStr
    first_name: Name
    last_name: Name
    role: UserRole
    status: UserStatus


class UserDetails(BaseUserDetails):
    id: UserID
    # Poluzowane względem BaseUserDetails, bo encje typu Gość mogą nie mieć
    # adresu email ani nazwiska.
    email: EmailStr | None = None
    last_name: str | None = None
    provider: AuthProvider | None = None
    provider_user_id: str | None = None


class UserStatusUpdate(BaseModel):
    status: UserStatus


class UsersPaged(BaseModel):
    users: list[UserDetails]
    total_count: int
