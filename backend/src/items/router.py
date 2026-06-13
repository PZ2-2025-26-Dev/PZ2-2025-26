from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from src.auth.schemas import UserID
from src.dependencies import DBDep
from src.items.constants import ItemStatus
from src.items.schemas import (
    CategoryID,
    ItemCreate,
    ItemCreateResponse,
    ItemHistoryEntry,
    ItemPagination,
    ItemsPaged,
    ItemUpdate,
    ItemUpdateResponse,
    LocationID,
    SearchStr,
    ItemID,
)
from src.items.service import ItemService

router = APIRouter(prefix="/items", tags=["items"])


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
    db: DBDep,
    search: SearchStr | None = None,
    category_id: CategoryID | None = None,
    location_id: LocationID | None = None,
    include_descendants: bool = False,
    owner_id: UserID | None = None,
    status: Annotated[list[ItemStatus] | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
) -> ItemsPaged:
    service = ItemService(db)
    items, total = service.list_items(
        search=search,
        category_id=category_id,
        location_id=location_id,
        include_descendants=include_descendants,
        owner_id=owner_id,
        statuses=status,
        page=page,
        limit=limit,
    )

    return ItemsPaged(
        items=items,
        pagination=ItemPagination(
            page=page,
            limit=limit,
            total=total,
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

@router.patch(
    "/{item_id}",
    response_model=ItemUpdateResponse,
    status_code=status.HTTP_200_OK,
    summary="Aktualizuj dane przedmiotu",
    responses={
        status.HTTP_200_OK: {
            "model": ItemUpdateResponse,
            "description": "Dane przedmiotu zostały zaktualizowane.",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Nie znaleziono przedmiotu.",
        },
    },
)
def update_item(
    item_id: ItemID,
    data: ItemUpdate,
    db: DBDep,
) -> ItemUpdateResponse:
    service = ItemService(db)

    try:
        item = service.update_item(item_id, data)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )

    return ItemUpdateResponse(
        id=item.id,
        description=item.description,
    )

@router.get(
    "/{item_id}/history",
    summary="Get item history",
    status_code=status.HTTP_200_OK,
    response_model=list[ItemHistoryEntry],
    responses={
        status.HTTP_404_NOT_FOUND: {
            "description": "Item not found",
        },
    },
)
def read_item_history(
    item_id: ItemID,
    db: DBDep,
) -> list[ItemHistoryEntry]:
    service = ItemService(db)

    try:
        history = service.get_item_history(item_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )

    return [
        ItemHistoryEntry(
            id=entry.id,
            updated_at=entry.updated_at,
            updated_by=entry.updated_by,
            change_type=entry.change_type,
            description=entry.description,
        )
        for entry in history
    ]