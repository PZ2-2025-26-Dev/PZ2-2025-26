from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from src.auth.constants import UserRole
from src.auth.jwt import decode_token
from src.database import get_db
from src.users.models import User

# --- FastAPI dependencies (Annotated style) ---

bearer_scheme = HTTPBearer()

DBSession = Annotated[Session, Depends(get_db)]
BearerCreds = Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)]


def get_current_user(
    credentials: BearerCreds,
    db: DBSession,
) -> User:
    token = credentials.credentials

    try:
        payload = decode_token(token)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from err

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing subject",
        )

    user = db.get(User, int(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_admin(
    user: CurrentUser,
) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin only",
        )
    return user