from datetime import timedelta

import jwt
from fastapi import APIRouter, status
from src.auth.constants import UserRole, UserStatus
from src.config import config
from src.schemas import ErrorResponse
from src.utils import now

from .schemas import (TokenRefreshIn, TokenResponse, User, UserCreate,
                      UserCreateResponse, UserLogin, UserLoginResponse)

router = APIRouter(prefix="/auth")


def _create_token(user_id: int, role: UserRole, expires_in_minutes: int = 60) -> str:
    payload = {
        "sub": str(user_id),
        "role": role.value,
        "exp": now() + timedelta(minutes=expires_in_minutes),
    }
    return jwt.encode(payload, config.jwt_secret, algorithm=config.jwt_algorithm)


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
        access_token=_create_token(user_id=1, role=UserRole.ADMIN),
        refresh_token=_create_token(user_id=1, role=UserRole.ADMIN, expires_in_minutes=60 * 24),
        user=User(id=1, role=UserRole.ADMIN),
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
        access_token=_create_token(user_id=1, role=UserRole.ADMIN),
        refresh_token=_create_token(user_id=1, role=UserRole.ADMIN, expires_in_minutes=60 * 24),
    )
