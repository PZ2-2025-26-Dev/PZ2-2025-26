from typing import Annotated

from pydantic import BaseModel, EmailStr, Field

from src.auth.constants import UserRole, UserStatus
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


class UsersPaged(BaseModel):
    users: list[UserDetails]
    total_count: int
