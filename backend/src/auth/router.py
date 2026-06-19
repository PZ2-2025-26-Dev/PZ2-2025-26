
from fastapi import APIRouter, HTTPException, Request, status, Depends
from fastapi.responses import RedirectResponse
from fastapi.concurrency import run_in_threadpool
from urllib.parse import urlencode
from typing import Annotated

from src.users.models import User as UserModel
from src.auth.dependencies import get_current_user


from src.auth.google_oauth import oauth
from src.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from src.auth.service import (
    get_or_create_google_user,
    login_user,
    register_user,
)
from src.config import config
from src.dependencies import DBDep
from src.schemas import ErrorResponse

from .schemas import (
    CurrentUserResponse,
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
    summary="Rejestracja użytkownika",
    description="Tworzy konto użytkownika w statusie PENDING_APPROVAL (wymaga akceptacji administratora).",
    responses={
        status.HTTP_201_CREATED: {
            "model": UserCreateResponse,
            "description": "Pomyślnie utworzono konto i wysłano do akceptacji.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Niepoprawne dane lub użytkownik już istnieje.",
        },
    },
)
def register(
    data: UserCreate,
    db: DBDep,
) -> UserCreateResponse:
    user = register_user(
        db=db,
        email=data.email,
        password=data.password,
        first_name=data.first_name,
        last_name=data.last_name,
    )
    return UserCreateResponse(
        id=user.id,
        status=user.status,
    )


@router.post(
    "/login",
    response_model=UserLoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Logowanie użytkownika",
    description="Logowanie lokalne przy użyciu adresu email i hasła.",
    responses={
        status.HTTP_200_OK: {
            "model": UserLoginResponse,
            "description": "Pomyślnie zalogowano użytkownika.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "model": ErrorResponse,
            "description": "Nieprawidłowy email lub hasło.",
        },
        status.HTTP_403_FORBIDDEN: {
            "model": ErrorResponse,
            "description": "Konto nie zostało jeszcze aktywowane.",
        },
    },
)
def login(
    data: UserLogin,
    db: DBDep,
) -> UserLoginResponse:
    user = login_user(
        db=db,
        email=data.email,
        password=data.password,
    )

    access_token = create_access_token(user.id)

    return UserLoginResponse(
        access_token=access_token,
        refresh_token=create_refresh_token(user.id),
        user=User(
            id=user.id,
            role=user.role,
            name=f"{user.first_name} {user.last_name or ''}".strip(),
        ),
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Odświeżanie tokena",
    description="Przyjmuje refresh token i zwraca nowy access token wraz z refresh tokenem.",
    responses={
        status.HTTP_200_OK: {
            "model": TokenResponse,
            "description": "Pomyślne odświeżenie tokenów.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "model": ErrorResponse,
            "description": "Nieprawidłowy lub wygasły refresh token.",
        },
    },
)
async def refresh_token(data: TokenRefreshIn) -> TokenResponse:
    try:
        payload = decode_token(data.refresh_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy token odświeżający.",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy token odświeżający.",
        )

    return TokenResponse(
        access_token=create_access_token(int(user_id)),
        refresh_token=create_refresh_token(int(user_id)),
    )


@router.get(
    "/google/authorize",
    summary="Rozpoczęcie logowania Google OAuth2",
    description="Przekierowuje użytkownika do Google w celu autoryzacji.",
    status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    responses={
        status.HTTP_307_TEMPORARY_REDIRECT: {
            "description": "Przekierowanie do Google OAuth2.",
        }
    },
)
@router.get(
    "/google/login",
    summary="Rozpoczęcie logowania Google OAuth2",
    description="Przekierowuje użytkownika do Google w celu autoryzacji.",
    status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    responses={
        status.HTTP_307_TEMPORARY_REDIRECT: {
            "description": "Przekierowanie do Google OAuth2.",
        }
    },
)
async def google_authorize(request: Request):
    redirect_uri = config.google_redirect_uri
    print(config.cors_origins)
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request, db: DBDep):
    token = await oauth.google.authorize_access_token(request)

    userinfo = token["userinfo"]

    email = userinfo["email"]
    google_id = userinfo["sub"]
    first_name = userinfo["given_name"]
    last_name = userinfo["family_name"]

    user = await run_in_threadpool(
        get_or_create_google_user,
        db,
        email,
        google_id,
        first_name,
        last_name,
    )

    access_token = create_access_token(user.id)

    params = urlencode({"token": access_token})

    return RedirectResponse(
        url=f"http://localhost:5173/auth/google/callback?{params}"
    )

@router.get(
    "/me",
    response_model=CurrentUserResponse,
)
def me(
    user: Annotated[UserModel, Depends(get_current_user)],
) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=user.id,
        email=user.email,
        name=f"{user.first_name} {user.last_name or ''}".strip(),
        role=user.role,
        status=user.status,
    )