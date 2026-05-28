from typing import Annotated

from fastapi import APIRouter, Query, status

from src.auth.constants import UserRole, UserStatus

from .schemas import BaseUserDetails, SearchStr, UserDetails, UsersPaged

router = APIRouter(prefix="/users")


@router.get(
    path="",
    response_model=UsersPaged,
    status_code=status.HTTP_200_OK,
    summary="Wylistuj użytkowników",
)
def read_users(
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    role: UserRole | None = None,
    status: UserStatus | None = None,
    search: SearchStr | None = None,
) -> UsersPaged:
    return UsersPaged(
        users=[
            UserDetails(
                id=1,
                email="nobody@example.com",
                first_name="John",
                last_name="Doe",
                role=UserRole.USER,
                status=UserStatus.ACTIVE,
            ),
        ],
        total_count=1,
    )


@router.get(
    path="/{user_id}",
    response_model=UserDetails,
    status_code=status.HTTP_200_OK,
    summary="Wypisz szczegóły użytkownika",
)
def read_user(user_id: int) -> UserDetails:
    return UserDetails(
        id=1,
        email="nobody@example.com",
        first_name="John",
        last_name="Doe",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
    )


@router.put(
    path="/{user_id}",
    response_model=UserDetails,
    status_code=status.HTTP_200_OK,
    summary="Edytuj dane użytkownika",
)
def update_user(user_id: int, data: BaseUserDetails) -> UserDetails:
    return UserDetails(
        id=1,
        email="nobody@example.com",
        first_name="John",
        last_name="Wick",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
    )
