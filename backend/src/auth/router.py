from typing import Annotated
from urllib.parse import urlencode, urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse

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
from src.users.models import User as UserModel

from .schemas import (
    CurrentUserResponse,
    TokenRefreshIn,
    TokenResponse,
    User,
    UserCreate,
    UserCreateResponse,
    UserLogin,
    UserLoginResponse,
    UserPreferencesUpdate,
)

router = APIRouter(prefix="/auth")


def _frontend_url_from_request(request: Request) -> str:
    session_frontend_url = request.session.get("frontend_url")
    if isinstance(session_frontend_url, str) and session_frontend_url:
        return session_frontend_url.rstrip("/")

    return config.frontend_url.rstrip("/")


def _frontend_google_callback_url(request: Request, **params: str) -> str:
    frontend_url = _frontend_url_from_request(request)
    query = urlencode({key: value for key, value in params.items() if value})
    return f"{frontend_url}/google/complete?{query}"


def _remember_frontend_url(request: Request) -> None:
    explicit_frontend_url = request.query_params.get("frontend_url")
    referer = request.headers.get("referer")
    parsed_referer = urlparse(referer) if referer else None
    referer_origin = (
        f"{parsed_referer.scheme}://{parsed_referer.netloc}"
        if parsed_referer and parsed_referer.scheme in {"http", "https"} and parsed_referer.netloc
        else None
    )
    frontend_url = explicit_frontend_url or referer_origin

    if not frontend_url:
        return

    parsed_frontend_url = urlparse(frontend_url)
    if parsed_frontend_url.scheme not in {"http", "https"} or not parsed_frontend_url.netloc:
        return

    request.session["frontend_url"] = frontend_url.rstrip("/")


def to_current_user_response(user: UserModel) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=user.id,
        email=user.email or "",
        name=f"{user.first_name} {user.last_name or ''}".strip(),
        role=user.role,
        status=user.status,
        ui_theme=user.ui_theme,
        ui_font=user.ui_font,
        ui_accent=user.ui_accent,
    )


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
    _remember_frontend_url(request)
    redirect_uri = config.google_redirect_uri
    return await oauth.google.authorize_redirect(request, redirect_uri, prompt="select_account")


@router.get("/google/callback")
async def google_callback(request: Request, db: DBDep):
    google_error = request.query_params.get("error")
    if google_error:
        return RedirectResponse(
            url=_frontend_google_callback_url(
                request,
                error=google_error,
                error_description=request.query_params.get("error_description", ""),
            )
        )

    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception:
        return RedirectResponse(
            url=_frontend_google_callback_url(
                request,
                error="google_callback_failed",
                error_description="Nie udało się dokończyć logowania przez Google.",
            )
        )

    userinfo = token.get("userinfo") or {}

    email = userinfo.get("email")
    google_id = userinfo.get("sub")
    first_name = userinfo.get("given_name") or ""
    last_name = userinfo.get("family_name") or ""

    if not email or not google_id:
        return RedirectResponse(
            url=_frontend_google_callback_url(
                request,
                error="google_profile_missing",
                error_description="Google nie zwrócił wymaganych danych profilu.",
            )
        )

    try:
        user = await run_in_threadpool(
            get_or_create_google_user,
            db,
            email,
            google_id,
            first_name,
            last_name,
        )
    except HTTPException as exc:
        detail = exc.detail
        message = detail.get("message") if isinstance(detail, dict) else str(detail)
        return RedirectResponse(
            url=_frontend_google_callback_url(
                request,
                error="google_user_error",
                error_description=message,
            )
        )

    access_token = create_access_token(user.id)

    return RedirectResponse(url=_frontend_google_callback_url(request, token=access_token))


@router.get(
    "/me",
    response_model=CurrentUserResponse,
)
def me(
    user: Annotated[UserModel, Depends(get_current_user)],
) -> CurrentUserResponse:
    return to_current_user_response(user)


@router.patch(
    "/me/preferences",
    response_model=CurrentUserResponse,
)
def update_my_preferences(
    data: UserPreferencesUpdate,
    db: DBDep,
    user: Annotated[UserModel, Depends(get_current_user)],
) -> CurrentUserResponse:
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(user, field, value)

    db.add(user)
    db.commit()
    db.refresh(user)

    return to_current_user_response(user)
