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
    ItemHistoryEntry,
    ItemLocation,
    ItemOwner,
    ItemPagination,
    ItemsPaged,
    ItemUpdate,
    ItemUpdateResponse,
    LocationID,
    SearchStr,
    ItemID
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


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Usuń przedmiot z inwentaryzacji",
    responses={
        status.HTTP_204_NO_CONTENT: {
            "description": "Pomyślnie usunięto przedmiot"
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "Nie można usunąć wypożyczonego przedmiotu"
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Przedmiot nie istnieje"
        },
    },
)
def delete_item(
    item_id: int,
    db: DBDep,
) -> None:

    service = ItemService(db)
    service.delete_item(item_id)
    return None


@router.patch(
    "/{item_id}",
    response_model=ItemDetails,
    status_code=status.HTTP_200_OK,
    summary="Zaktualizuj dane przedmiotu",
    responses={
        status.HTTP_200_OK: {
            "description": "Pomyślnie zaktualizowano przedmiot"
            },
        status.HTTP_404_NOT_FOUND: {
            "description": "Przedmiot nie istnieje"
            },
    },
)
def update_item(
    item_id: int,
    data: ItemUpdate,
    db: DBDep,
) -> ItemDetails:

    service = ItemService(db)

    item = service.get_item(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    updated = service.update_item(item, data.model_dump(exclude_unset=True))

    return ItemDetails(
        id=updated.id,
        name=updated.name,
        category=updated.category,
        location=updated.location,
        owner=updated.owner,
        description=updated.description,
        legacy_id=updated.legacy_id,
    )

router.patch(
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