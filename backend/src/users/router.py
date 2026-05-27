from typing import Annotated

from fastapi import APIRouter, Query, status

from src.auth.constants import UserRole, UserStatus

from .schemas import SearchStr, UserDetail

router = APIRouter(prefix="/users")


@router.get(
    path="",
    response_model=list[UserDetail],
    status_code=status.HTTP_200_OK,
    summary="Wylistuj użytkowników",
)
def read_users(
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    role: UserRole | None = None,
    status: UserStatus | None = None,
    search: SearchStr | None = None,
) -> list[UserDetail]:
    return [
        UserDetail(
            id="usr_1",
            email="nobody@example.com",
            first_name="John",
            last_name="Doe",
            role=UserRole.USER,
            status=UserStatus.ACTIVE,
        )
    ]
