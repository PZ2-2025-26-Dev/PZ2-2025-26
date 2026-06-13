from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from src.auth.constants import UserRole, UserStatus
from src.dependencies import DBDep
from src.schemas import ErrorResponse

from .schemas import BaseUserDetails, SearchStr, UserDetails, UsersPaged
from .service import (
    InvalidUserApprovalRoleError,
    UserHasHistoricalReferencesError,
    UserNotFoundError,
    UserOwnsItemsError,
    UserService,
)

router = APIRouter(prefix="/users")


def to_user_details(user) -> UserDetails:
    return UserDetails(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        status=user.status,
    )


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
        users=[to_user_details(user) for user in users],
        total_count=total_count,
    )


@router.get(
    path="/{user_id}",
    response_model=UserDetails,
    status_code=status.HTTP_200_OK,
    summary="Wypisz szczegóły użytkownika",
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono użytkownika o podanym ID.",
        },
    },
)
def read_user(user_id: int, db: DBDep) -> UserDetails:
    service = UserService(db)

    try:
        user = service.get_user(user_id)
    except UserNotFoundError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono użytkownika.") from err

    return to_user_details(user)


@router.put(
    path="/{user_id}",
    response_model=UserDetails,
    status_code=status.HTTP_200_OK,
    summary="Edytuj dane użytkownika",
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Przy aktywacji konta oczekującego należy nadać rolę user albo observer.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono użytkownika o podanym ID.",
        },
    },
)
def update_user(user_id: int, data: BaseUserDetails, db: DBDep) -> UserDetails:
    service = UserService(db)

    try:
        user = service.update_user(user_id, data)
    except UserNotFoundError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono użytkownika.") from err
    except InvalidUserApprovalRoleError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Przy aktywacji konta oczekującego należy nadać rolę user albo observer.",
        ) from err

    return to_user_details(user)


@router.delete(
    path="/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Usuń użytkownika",
    responses={
        status.HTTP_204_NO_CONTENT: {
            "description": "Pomyślnie usunięto użytkownika.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono użytkownika o podanym ID.",
        },
        status.HTTP_409_CONFLICT: {
            "model": ErrorResponse,
            "description": "Użytkownik ma powiązane dane, które blokują usunięcie.",
        },
    },
)
def delete_user(user_id: int, db: DBDep) -> None:
    service = UserService(db)

    try:
        service.delete_user(user_id)
    except UserNotFoundError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nie znaleziono użytkownika.") from err
    except UserOwnsItemsError as err:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Nie można usunąć użytkownika, ponieważ jest właścicielem przedmiotów. "
                "Najpierw przepisz przedmioty do innego użytkownika."
            ),
        ) from err
    except UserHasHistoricalReferencesError as err:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Nie można usunąć użytkownika, ponieważ występuje w historii, wypożyczeniach "
                "lub rejestrze gości. Dezaktywuj konto zamiast usuwać."
            ),
        ) from err
