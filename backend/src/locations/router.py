from fastapi import APIRouter, status

from src.dependencies import DBDep
from src.items.schemas import SearchStr
from src.locations.schemas import LocationTreeResponse
from src.locations.service import LocationService

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get(
    "/tree",
    response_model=LocationTreeResponse,
    status_code=status.HTTP_200_OK,
    summary="Pobierz hierarchiczną strukturę lokalizacji",
)
def read_location_tree(
    db: DBDep,
    search: SearchStr | None = None,
) -> LocationTreeResponse:
    service = LocationService(db)
    return LocationTreeResponse(tree=service.get_location_tree(search=search))
