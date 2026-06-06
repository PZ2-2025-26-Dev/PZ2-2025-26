from typing import Annotated

from fastapi import APIRouter, Query, status

from src.auth.constants import UserRole, UserStatus
from src.dependencies import DBDep

from .schemas import BaseUserDetails, SearchStr, UserDetails, UsersPaged
from .service import UserService

router = APIRouter(prefix="/users")


@router.get(
    path="",
    response_model=UsersPaged,
    status_code=status.HTTP_200_OK,
    summary="Wylistuj użytkowników",
)
def read_users(
    db: DBDep,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    role: UserRole | None = None,
    status: UserStatus | None = None,
    search: SearchStr | None = None,
) -> UsersPaged:
    service = UserService(db)
    users, total_count = service.list_users(
        page=page,
        limit=limit,
        role=role,
        status=status,
        search=search,
    )

    return UsersPaged(
        users=[
            UserDetails(
                id=user.id,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                role=user.role,
                status=user.status,
            )
            for user in users
        ],
        total_count=total_count,
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
        last_name="Snow",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
    )
