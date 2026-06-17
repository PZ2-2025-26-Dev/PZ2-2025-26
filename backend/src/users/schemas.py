from typing import Annotated

from pydantic import BaseModel, EmailStr, Field

from src.auth.constants import AuthProvider, UserRole, UserStatus
from src.auth.schemas import Name, UserID

type SearchStr = Annotated[str, Field(min_length=1, max_length=255)]


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
    items: list[UserDetails]
    total_count: int
