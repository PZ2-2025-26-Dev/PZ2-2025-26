from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.constants import (
    AuthProvider,
    UserRole,
    UserStatus,
)
from src.auth.models import UserAccount
from src.users.models import User
from src.dependencies import DBDep
from src.auth.jwt import decode_token

password_hasher = PasswordHasher()


def get_or_create_google_user(
    db: Session,
    email: str,
    google_id: str,
    first_name: str,
    last_name: str,
):
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            first_name=first_name,
            last_name=last_name,
            role=UserRole.USER,
            status=UserStatus.PENDING_APPROVAL,
        )
        db.add(user)
        db.flush()

    account = db.execute(
        select(UserAccount).where(
            UserAccount.user_id == user.id,
            UserAccount.provider == AuthProvider.GOOGLE,
        )
    ).scalar_one_or_none()

    if not account:
        account = UserAccount(
            user_id=user.id,
            provider=AuthProvider.GOOGLE,
            provider_user_id=google_id,
        )
        db.add(account)

    db.commit()
    db.refresh(user)

    return user


def register_user(
    db: Session,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
) -> User:
    existing_user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Użytkownik o podanym adresie email już istnieje.",
        )

    user = User(
        email=email,
        first_name=first_name,
        last_name=last_name,
        role=UserRole.USER,
        status=UserStatus.PENDING_APPROVAL,
    )

    db.add(user)
    db.flush()

    account = UserAccount(
        user_id=user.id,
        provider=AuthProvider.LOCAL,
        pwd_hash=password_hasher.hash(password),
    )

    db.add(account)

    db.commit()
    db.refresh(user)
    return user


def login_user(
    db: Session,
    email: str,
    password: str,
) -> User:
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy email lub hasło.",
        )

    account = db.execute(
        select(UserAccount).where(
            UserAccount.user_id == user.id,
            UserAccount.provider == AuthProvider.LOCAL,
        )
    ).scalar_one_or_none()

    if account is None or account.pwd_hash is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy email lub hasło.",
        )

    try:
        password_hasher.verify(
            account.pwd_hash,
            password,
        )
    except VerifyMismatchError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy email lub hasło.",
        ) from exc
    if user.status == UserStatus.PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="PENDING_APPROVAL"
        )

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Brak uprawnień.",
        )

    return user

def get_current_user(db: DBDep, request):
    auth = request.headers.get("Authorization")

    if not auth:
        raise HTTPException(401, "No token")

    token = auth.replace("Bearer ", "")

    payload = decode_token(token)

    user_id = payload.get("sub")

    user = db.get(User, int(user_id))

    if not user:
        raise HTTPException(401, "User not found")

    return user