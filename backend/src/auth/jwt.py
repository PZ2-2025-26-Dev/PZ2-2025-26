from datetime import timedelta

from jose import JWTError, jwt

from src.config import config
from src.utils import now


def create_access_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": now() + timedelta(minutes=config.access_token_expire_minutes),
        "type": "access",
    }

    return jwt.encode(
        payload,
        config.jwt_secret_key,
        algorithm=config.jwt_algorithm,
    )


def create_refresh_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": now() + timedelta(days=7),
        "type": "refresh",
    }

    return jwt.encode(
        payload,
        config.jwt_secret_key,
        algorithm=config.jwt_algorithm,
    )


def decode_token(token: str) -> dict[str, str]:
    try:
        return jwt.decode(
            token,
            config.jwt_secret_key,
            algorithms=[config.jwt_algorithm],
        )
    except JWTError as exc:
        raise ValueError(str(exc)) from exc
