import json
import urllib.error
import urllib.parse
import urllib.request

from fastapi import APIRouter, HTTPException, Request, Depends, status

from src.auth.constants import UserRole, UserStatus
from src.auth.google_oauth import oauth
from src.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from src.auth.service import (
    get_or_create_google_user,
    register_user,
    login_user,
)
from src.config import settings
from src.database import get_db
from src.schemas import ErrorResponse

from .schemas import (
    GoogleCallback,
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
    db=Depends(get_db),
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
    db=Depends(get_db),
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
        )

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
    redirect_uri = settings.google_redirect_uri
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.post(
    "/google/callback",
    response_model=UserLoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Callback logowania Google (code/state)",
    description=(
        "Przyjmuje kod i state z frontendu, wymienia kod na token w Google, "
        "tworzy lub pobiera użytkownika i zwraca JWT."
    ),
    responses={
        status.HTTP_200_OK: {
            "model": UserLoginResponse,
            "description": "Pomyślne logowanie przez Google i zwrócenie tokena JWT.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Błąd autoryzacji Google lub nieprawidłowy kod.",
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "model": ErrorResponse,
            "description": "Błąd serwera podczas przetwarzania OAuth.",
        },
    },
)
async def google_callback_code(
    data: GoogleCallback,
    db=Depends(get_db),
) -> UserLoginResponse:
    token_url = "https://oauth2.googleapis.com/token"
    redirect_uri = data.redirect_uri or settings.google_redirect_uri

    token_request = urllib.request.Request(
        token_url,
        data=urllib.parse.urlencode(
            {
                "code": data.code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            }
        ).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    try:
        with urllib.request.urlopen(token_request) as response:
            token_data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Błąd wymiany kodu Google: {detail}",
        )

    access_token_google = token_data.get("access_token")
    if not access_token_google:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brak access_token od Google.",
        )

    userinfo_request = urllib.request.Request(
        "https://openidconnect.googleapis.com/v1/userinfo",
        headers={"Authorization": f"Bearer {access_token_google}"},
    )

    try:
        with urllib.request.urlopen(userinfo_request) as response:
            userinfo = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Błąd pobierania danych użytkownika Google: {detail}",
        )

    user = get_or_create_google_user(
        db,
        userinfo["email"],
        userinfo["sub"],
        userinfo.get("given_name", ""),
        userinfo.get("family_name", ""),
    )

    access_token = create_access_token(user.id)

    return UserLoginResponse(
        access_token=access_token,
        refresh_token=create_refresh_token(user.id),
        user=User(id=user.id, role=user.role),
    )


@router.get(
    "/google/callback",
    summary="Callback logowania Google",
    description="Obsługuje OAuth2 callback z Google, tworzy lub pobiera użytkownika i zwraca JWT.",
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_200_OK: {
            "description": "Pomyślne logowanie przez Google i zwrócenie tokena JWT.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Błąd autoryzacji Google (np. mismatching state).",
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "model": ErrorResponse,
            "description": "Błąd serwera podczas przetwarzania OAuth.",
        },
    },
)
async def google_callback(request: Request, db=Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)

    userinfo = token["userinfo"]

    email = userinfo["email"]
    google_id = userinfo["sub"]
    first_name = userinfo["given_name"]
    last_name = userinfo["family_name"]

    user = get_or_create_google_user(
        db, email, google_id, first_name, last_name
    )

    access_token = create_access_token(user.id)

    return {
        "access_token": access_token,
        "token_type": "Bearer",
        "user": {
            "id": user.id,
            "role": user.role,
        },
    }