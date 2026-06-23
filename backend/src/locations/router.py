from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from src.auth.dependencies import RequireAdmin
from src.dependencies import DBDep
from src.locations.constants import LOCATION_PAGE_LIMIT_MAX
from src.locations.dependencies import RequireLocationReader
from src.locations.schemas import (
    LocationCreate,
    LocationDeleteResponse,
    LocationDetails,
    LocationHistoryEntry,
    LocationID,
    LocationPagination,
    LocationsPaged,
    LocationUpdate,
)
from src.locations.service import (
    InvalidLocationParentError,
    LocationHasAssignedItemsError,
    LocationNotFoundError,
    LocationService,
)
from src.schemas import ErrorResponse

router = APIRouter(prefix="/locations", tags=["locations"])


@router.post(
    "",
    response_model=LocationDetails,
    status_code=status.HTTP_201_CREATED,
    summary="Dodaj lokalizację",
    responses={
        status.HTTP_201_CREATED: {
            "model": LocationDetails,
            "description": "Lokalizacja została utworzona.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Wskazana lokalizacja nadrzędna jest niepoprawna.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Brak poprawnego tokena uwierzytelniającego.",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Operacja dostępna wyłącznie dla administratora.",
        },
    },
)
def create_location(data: LocationCreate, db: DBDep, _admin: RequireAdmin) -> LocationDetails:
    try:
        return LocationService(db).create_location(data)
    except InvalidLocationParentError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(code=status.HTTP_400_BAD_REQUEST, detail="Invalid parent location.").model_dump(),
        ) from err


@router.get(
    "",
    response_model=LocationsPaged,
    status_code=status.HTTP_200_OK,
    summary="Wylistuj lokalizacje",
    responses={
        status.HTTP_200_OK: {
            "model": LocationsPaged,
            "description": "Zwrócono stronicowaną listę lokalizacji.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Brak poprawnego tokena uwierzytelniającego.",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Brak uprawnień do przeglądania lokalizacji.",
        },
    },
)
def read_locations(
    db: DBDep,
    _reader: RequireLocationReader,
    parent_id: LocationID | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=LOCATION_PAGE_LIMIT_MAX)] = 20,
) -> LocationsPaged:
    locations, total = LocationService(db).list_locations(page=page, limit=limit, parent_id=parent_id)

    return LocationsPaged(locations=locations, pagination=LocationPagination(page=page, limit=limit, total=total))


@router.get(
    "/{location_id}",
    response_model=LocationDetails,
    status_code=status.HTTP_200_OK,
    summary="Sprawdź szczegóły lokalizacji",
    responses={
        status.HTTP_200_OK: {
            "model": LocationDetails,
            "description": "Zwrócono szczegóły lokalizacji wraz z pełną ścieżką.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono lokalizacji.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Brak poprawnego tokena uwierzytelniającego.",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Operacja dostępna wyłącznie dla administratora.",
        },
    },
)
def read_location(location_id: LocationID, db: DBDep, _admin: RequireAdmin) -> LocationDetails:
    try:
        return LocationService(db).get_location(location_id)
    except LocationNotFoundError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(code=status.HTTP_404_NOT_FOUND, detail="Location not found.").model_dump(),
        ) from err


@router.put(
    "/{location_id}",
    response_model=LocationDetails,
    status_code=status.HTTP_200_OK,
    summary="Zmodyfikuj lokalizację",
    responses={
        status.HTTP_200_OK: {
            "model": LocationDetails,
            "description": "Lokalizacja została zmodyfikowana, a zmiana zapisana w historii.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Wskazana lokalizacja nadrzędna jest niepoprawna.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono lokalizacji.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Brak poprawnego tokena uwierzytelniającego.",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Operacja dostępna wyłącznie dla administratora.",
        },
    },
)
def update_location(location_id: LocationID, data: LocationUpdate, db: DBDep, _admin: RequireAdmin) -> LocationDetails:
    try:
        return LocationService(db).update_location(location_id, data)
    except InvalidLocationParentError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(code=status.HTTP_400_BAD_REQUEST, detail="Invalid parent location.").model_dump(),
        ) from err
    except LocationNotFoundError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(code=status.HTTP_404_NOT_FOUND, detail="Location not found.").model_dump(),
        ) from err


@router.delete(
    "/{location_id}",
    response_model=LocationDeleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Usuń pustą lokalizację",
    responses={
        status.HTTP_200_OK: {
            "model": LocationDeleteResponse,
            "description": "Lokalizacja i jej puste poddrzewo zostały usunięte.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Lokalizacja lub jej poddrzewo zawiera przypisane przedmioty.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono lokalizacji.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Brak poprawnego tokena uwierzytelniającego.",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Operacja dostępna wyłącznie dla administratora.",
        },
    },
)
def delete_location(location_id: LocationID, db: DBDep, _admin: RequireAdmin) -> LocationDeleteResponse:
    try:
        deleted_locations_count = LocationService(db).delete_location(location_id)
    except LocationHasAssignedItemsError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                code=status.HTTP_400_BAD_REQUEST,
                detail="Location cannot be deleted because it or its descendants contain assigned items.",
            ).model_dump(),
        ) from err
    except LocationNotFoundError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(code=status.HTTP_404_NOT_FOUND, detail="Location not found.").model_dump(),
        ) from err

    return LocationDeleteResponse(
        id=location_id,
        deleted_locations_count=deleted_locations_count,
    )


@router.get(
    "/{location_id}/history",
    response_model=list[LocationHistoryEntry],
    status_code=status.HTTP_200_OK,
    summary="Wylistuj historię zmian lokalizacji",
    responses={
        status.HTTP_200_OK: {
            "model": list[LocationHistoryEntry],
            "description": "Zwrócono historię zmian lokalizacji.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono lokalizacji.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Brak poprawnego tokena uwierzytelniającego.",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Operacja dostępna wyłącznie dla administratora.",
        },
    },
)
def read_location_history(location_id: LocationID, db: DBDep, _admin: RequireAdmin) -> list[LocationHistoryEntry]:
    try:
        history = LocationService(db).list_history(location_id)
    except LocationNotFoundError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(code=status.HTTP_404_NOT_FOUND, detail="Location not found.").model_dump(),
        ) from err

    return [
        LocationHistoryEntry(
            id=entry.id,
            location_id=entry.location_id,
            changed_at=entry.changed_at,
            changed_by=entry.changed_by,
            change_type=entry.change_type,
            description=entry.description,
        )
        for entry in history
    ]
