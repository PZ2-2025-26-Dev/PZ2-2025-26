from fastapi import APIRouter, status

from src.auth.constants import UserStatus
from src.schemas import ErrorResponse

from .schemas import UserCreate, UserCreateResponse, UserLogin, UserLoginResponse

router = APIRouter(prefix="/auth")


@router.post(
    "/register",
    response_model=UserCreateResponse,
    summary="Zarejestruj się",
    description="Rejestracja wymaga akceptacji administratora.",
    responses={
        status.HTTP_200_OK: {
            "model": UserCreateResponse,
            "description": "Pomyślnie utworzono prośbę o rejestrację",
        }
    },
)
def register(data: UserCreate) -> UserCreateResponse:
    return UserCreateResponse(
        id="usr_1",
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
    )
