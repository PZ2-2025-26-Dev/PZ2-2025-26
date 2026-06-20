from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from src.auth.dependencies import CurrentUser, RequireAdmin, RequireUserOrAdmin
from src.dependencies import DBDep
from src.guests.constants import DEFAULT_GUEST_PAGE_SIZE, MAX_GUEST_PAGE_SIZE
from src.guests.exceptions import (
    GuestEmailTakenError,
    GuestHasLoanHistoryError,
    GuestNotFoundError,
)
from src.guests.schemas import (
    GuestCreate,
    GuestID,
    GuestResponse,
    GuestsPaged,
    GuestUpdate,
)
from src.guests.service import GuestService
from src.schemas import ErrorResponse
from src.users.schemas import SearchStr

router = APIRouter(prefix="/guests", tags=["Guests"])


@router.post(
    "",
    response_model=GuestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Dodaj Gościa",
    responses={
        status.HTTP_201_CREATED: {
            "model": GuestResponse,
            "description": "Pomyślnie utworzono profil Gościa.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Podany adres email jest już zajęty.",
        },
        status.HTTP_403_FORBIDDEN: {
            "model": ErrorResponse,
            "description": "Brak uprawnień do dodania Gościa.",
        },
    },
)
def create_guest(
    data: GuestCreate,
    db: DBDep,
    current_user: RequireUserOrAdmin,
) -> GuestResponse:
    service = GuestService(db)

    try:
        guest = service.create_guest(data)
    except GuestEmailTakenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Podany adres email jest już zajęty.",
        ) from exc

    return GuestResponse.model_validate(guest)


@router.get(
    "",
    response_model=GuestsPaged,
    status_code=status.HTTP_200_OK,
    summary="Wylistuj Gości",
    responses={
        status.HTTP_200_OK: {
            "model": GuestsPaged,
            "description": "Pomyślnie zwrócono listę Gości.",
        },
    },
)
def list_guests(
    db: DBDep,
    current_user: CurrentUser,
    search: SearchStr | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=MAX_GUEST_PAGE_SIZE)] = DEFAULT_GUEST_PAGE_SIZE,
) -> GuestsPaged:
    service = GuestService(db)

    guests, total_count = service.list_guests(page=page, limit=limit, search=search)

    return GuestsPaged(
        guests=[GuestResponse.model_validate(guest) for guest in guests],
        total_count=total_count,
    )


@router.get(
    "/{guest_id}",
    response_model=GuestResponse,
    status_code=status.HTTP_200_OK,
    summary="Pobierz szczegóły Gościa",
    responses={
        status.HTTP_200_OK: {
            "model": GuestResponse,
            "description": "Pomyślnie zwrócono szczegóły Gościa.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono Gościa.",
        },
    },
)
def read_guest(
    guest_id: GuestID,
    db: DBDep,
    current_user: CurrentUser,
) -> GuestResponse:
    service = GuestService(db)

    try:
        guest = service.get_guest(guest_id)
    except GuestNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono Gościa.",
        ) from exc

    return GuestResponse.model_validate(guest)


@router.put(
    "/{guest_id}",
    response_model=GuestResponse,
    status_code=status.HTTP_200_OK,
    summary="Edytuj dane Gościa",
    responses={
        status.HTTP_200_OK: {
            "model": GuestResponse,
            "description": "Pomyślnie zaktualizowano dane Gościa.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Podany adres email jest już zajęty.",
        },
        status.HTTP_403_FORBIDDEN: {
            "model": ErrorResponse,
            "description": "Tylko administrator może modyfikować Gościa.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono Gościa.",
        },
    },
)
def update_guest(
    guest_id: GuestID,
    data: GuestUpdate,
    db: DBDep,
    admin: RequireAdmin,
) -> GuestResponse:
    service = GuestService(db)

    try:
        guest = service.update_guest(guest_id, data)
    except GuestNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono Gościa.",
        ) from exc
    except GuestEmailTakenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Podany adres email jest już zajęty.",
        ) from exc

    return GuestResponse.model_validate(guest)


@router.delete(
    "/{guest_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Usuń Gościa",
    responses={
        status.HTTP_204_NO_CONTENT: {
            "description": "Gość został usunięty.",
        },
        status.HTTP_403_FORBIDDEN: {
            "model": ErrorResponse,
            "description": "Tylko administrator może usuwać Gościa.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono Gościa.",
        },
        status.HTTP_409_CONFLICT: {
            "model": ErrorResponse,
            "description": "Gość posiada historię wypożyczeń – nie można go usunąć.",
        },
    },
)
def delete_guest(
    guest_id: GuestID,
    db: DBDep,
    admin: RequireAdmin,
) -> None:
    service = GuestService(db)

    try:
        service.delete_guest(guest_id)
    except GuestNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono Gościa.",
        ) from exc
    except GuestHasLoanHistoryError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Gość posiada historię wypożyczeń – nie można go usunąć.",
        ) from exc
