from typing import Annotated

from pydantic import BaseModel, EmailStr, Field

from .constants import UserRole, UserStatus

type Name = Annotated[str, Field(min_length=1, max_length=100)]
type Password = Annotated[str, Field(min_length=8)]
# type UserID = Annotated[str, Field(min_length=1, examples=["usr_1"])]
type UserID = int

type AccessToken = Annotated[str, Field(min_length=1)]
type RefreshToken = Annotated[str, Field(min_length=1)]


class UserCreate(BaseModel):
    email: EmailStr
    password: Password
    first_name: Name
    last_name: Name


class UserCreateResponse(BaseModel):
    id: UserID
    status: UserStatus


class UserLogin(BaseModel):
    email: EmailStr
    password: Password


class GoogleCallback(BaseModel):
    code: str
    state: str | None = None
    redirect_uri: str | None = None


class User(BaseModel):
    id: UserID
    role: UserRole
    name: str


class TokenResponse(BaseModel):
    access_token: AccessToken
    token_type: str = "Bearer"
    refresh_token: RefreshToken


class UserLoginResponse(TokenResponse):
    user: User


class TokenRefreshIn(BaseModel):
    refresh_token: RefreshToken


class CurrentUserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: UserRole
    status: UserStatus
