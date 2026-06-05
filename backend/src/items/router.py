from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from src.auth.schemas import UserID
from src.dependencies import DBDep
from src.items.constants import ItemStatus
from src.items.schemas import (
    CategoryID,
    ItemCategory,
    ItemCreate,
    ItemCreateResponse,
    ItemDetails,
    ItemLocation,
    ItemOwner,
    ItemPagination,
    ItemsPaged,
    LocationID,
    SearchStr,
)
from src.items.service import ItemService

router = APIRouter(prefix="/items")


@router.get(
    "",
    response_model=ItemsPaged,
    status_code=status.HTTP_200_OK,
    summary="Wylistuj przedmioty",
    responses={
        status.HTTP_200_OK: {
            "model": ItemsPaged,
            "description": "Pomyślnie zwrócono listę przedmiotów na podstawie zadanego filtru",
        }
    },
)
def read_items(
    search: SearchStr | None = None,
    category_id: CategoryID | None = None,
    location_id: LocationID | None = None,
    owner_id: UserID | None = None,
    status: ItemStatus | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
) -> ItemsPaged:
    return ItemsPaged(
        items=[
            ItemDetails(
                id=1,
                name="Nokia 3310",
                category=ItemCategory(
                    id=1,
                    name="Elektronika / Telefony",
                ),
                location=ItemLocation(
                    id=1,
                    path="D10 / 204",
                ),
                owner=ItemOwner(
                    id=1,
                    name="Batman",
                ),
                description=None,
                legacy_id=None,
            ),
        ],
        pagination=ItemPagination(
            page=page,
            limit=limit,
            total=1,
        ),
    )


@router.post(
    "",
    response_model=ItemCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Dodaj przedmiot do inwentaryzacji",
    responses={
        status.HTTP_201_CREATED: {
            "model": ItemCreateResponse,
            "description": "Pomyślnie dodano przedmiot",
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "Błędne dane lub nieistniejące powiązania",
        },
    },
)
def create_item(
    data: ItemCreate,
    db: DBDep,
) -> ItemCreateResponse:

    service = ItemService(db)

    try:
        new_item = service.add_item(data)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err

    return ItemCreateResponse(
        id=new_item.id,
        name=new_item.name,
        inventory_number=new_item.inventory_number,
        status=new_item.status,
        description=new_item.description,
    )
