from typing import Annotated

import jwt
from fastapi import Header, HTTPException, status
from src.auth.constants import UserRole
from src.auth.schemas import User
from src.config import config


def get_current_user(authorization: Annotated[str | None, Header()] = None) -> User:
    if not authorization:
        if config.debug:
            return User(id=1, role=UserRole.ADMIN)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization scheme")

    try:
        payload = jwt.decode(token, config.jwt_secret, algorithms=[config.jwt_algorithm])
        user_id = int(payload.get("sub") or payload.get("user_id"))
        role = UserRole(payload.get("role"))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc

    return User(id=user_id, role=role)
