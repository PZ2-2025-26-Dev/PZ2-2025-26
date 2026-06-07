from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from src.dependencies import DBDep
from src.schemas import ErrorResponse

from .schemas import LocationCreate, LocationCreateResponse, LocationsTree
from .service import InvalidLocationParentError, LocationNotFoundError, LocationService

router = APIRouter(prefix="/locations")


@router.post(
    "",
    response_model=LocationCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Dodaj lokalizację",
    responses={
        status.HTTP_201_CREATED: {
            "model": LocationCreateResponse,
            "description": "Pomyślnie utworzono lokalizację.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Niepoprawna lokalizacja nadrzędna dla wskazanego typu.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono lokalizacji nadrzędnej.",
        },
    },
)
def create_location(data: LocationCreate, db: DBDep) -> LocationCreateResponse:
    service = LocationService(db)

    try:
        location, path = service.create_location(data)
    except InvalidLocationParentError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid parent location for this type.",
            ).model_dump(),
        ) from err
    except LocationNotFoundError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                code=status.HTTP_404_NOT_FOUND,
                detail="Parent location was not found.",
            ).model_dump(),
        ) from err

    return LocationCreateResponse(id=location.id, path=path)


@router.get(
    "/tree",
    response_model=LocationsTree,
    status_code=status.HTTP_200_OK,
    summary="Wylistuj drzewo lokalizacji",
    responses={
        status.HTTP_200_OK: {
            "model": LocationsTree,
            "description": "Pomyślnie zwrócono drzewo lokalizacji.",
        },
    },
)
def read_locations_tree(db: DBDep) -> LocationsTree:
    service = LocationService(db)

    return LocationsTree(items=service.get_tree())


@router.delete(
    "/{location_id}",
    status_code=status.HTTP_200_OK,
    summary="Usuń lokalizację i przenieś sprzęt",
)
def delete_location(
    location_id: int,
    replacement_location_id: Annotated[int, Query(alias="replacementLocationId")],
    db: DBDep,
) -> dict:
    migrated_items_count = LocationService(db).delete_location(
        location_id=location_id,
        replacement_location_id=replacement_location_id,
        updated_by=1,
    )

    return {
        "id": location_id,
        "replacement_location_id": replacement_location_id,
        "migrated_items_count": migrated_items_count,
    }
