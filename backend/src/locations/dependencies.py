from typing import Annotated

from fastapi import Depends, HTTPException, status

from src.auth.constants import UserRole
from src.auth.dependencies import CurrentUser
from src.users.models import User

_LOCATION_READ_ROLES = {UserRole.ADMIN, UserRole.USER, UserRole.OBSERVER}


def require_location_reader(user: CurrentUser) -> User:
    if user.role not in _LOCATION_READ_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Brak uprawnień do przeglądania lokalizacji.",
        )
    return user


RequireLocationReader = Annotated[User, Depends(require_location_reader)]
