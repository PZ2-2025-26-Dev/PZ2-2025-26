from fastapi import APIRouter, status

from src.auth.constants import UserRole, UserStatus
from src.schemas import ErrorResponse

from .schemas import (
    TokenRefreshIn,
    TokenResponse,
    User,
    UserCreate,
    UserCreateResponse,
    UserLogin,
    UserLoginResponse,
)

router = APIRouter(prefix="/auth")


@router.post(
    "/register",
    response_model=UserCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Zarejestruj się",
    description="Rejestracja wymaga akceptacji administratora.",
    responses={
        status.HTTP_201_CREATED: {
            "model": UserCreateResponse,
            "description": "Pomyślnie utworzono prośbę o rejestrację",
        }
    },
)
def register(data: UserCreate) -> UserCreateResponse:
    return UserCreateResponse(
        id=1,
        status=UserStatus.PENDING_APPROVAL,
    )


@router.post(
    "/login",
    response_model=UserLoginResponse,
    summary="Zaloguj się",
    responses={
        status.HTTP_200_OK: {
            "model": UserLoginResponse,
            "description": "Pomyślnie zalogowano.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "model": ErrorResponse,
            "description": "Nieprawidłowy email lub hasło.",
        },
    },
)
def login(data: UserLogin) -> UserLoginResponse:
    return UserLoginResponse(
        access_token="JWT",
        refresh_token="REFRESH_TOKEN",
        user=User(id=1, role=UserRole.USER),
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Odśwież sesję",
    responses={
        status.HTTP_200_OK: {
            "model": TokenResponse,
            "description": "Pomyślnie odświeżono token.",
        },
    },
)
def refresh(data: TokenRefreshIn) -> TokenResponse:
    return TokenResponse(
        access_token="JWT",
        refresh_token="REFRESH_TOKEN_2",
    )
