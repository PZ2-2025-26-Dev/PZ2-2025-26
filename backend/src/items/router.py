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
    ItemID,
    ItemPagination,
    ItemResponse,
    ItemsPaged,
    ItemUpdate,
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
    db: DBDep,
    name: SearchStr | None = None,
    description: SearchStr | None = None,
    category_id: CategoryID | None = None,
    location_id: LocationID | None = None,
    owner_id: UserID | None = None,
    status: ItemStatus | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> ItemsPaged:
    service = ItemService(db)

    items, total = service.search_items(
        name=name,
        description=description,
        category_id=category_id,
        location_id=location_id,
        owner_id=owner_id,
        status=status,
        page=page,
        limit=limit,
    )

    return ItemsPaged(
        items=[
            ItemResponse(
                id=item.id,
                name=item.name,
                category_id=item.category_id,
                location_id=item.location_id,
                owner_id=item.owner_id,
                description=item.description,
                status=item.status,
            )
            for item in items
        ],
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


@router.get(
    "/{item_id}",
    response_model=ItemResponse,
    status_code=status.HTTP_200_OK,
    summary="Pobierz szczegóły przedmiotu",
    responses={
        status.HTTP_200_OK: {
            "model": ItemResponse,
            "description": "Pomyślnie zwrócono szczegóły przedmiotu",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Nie znaleziono przedmiotu",
        },
    },
)
def read_item(
    item_id: ItemID,
    db: DBDep,
) -> ItemResponse:
    service = ItemService(db)

    try:
        item = service.get_item(item_id)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        ) from err

    return ItemResponse(
        id=item.id,
        name=item.name,
        category_id=item.category_id,
        location_id=item.location_id,
        owner_id=item.owner_id,
        description=item.description,
        status=item.status,
    )


@router.patch(
    "/{item_id}",
    response_model=ItemUpdate,
    status_code=status.HTTP_200_OK,
    summary="Aktualizuj dane przedmiotu",
    responses={
        status.HTTP_200_OK: {
            "model": ItemUpdate,
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
) -> ItemUpdate:
    service = ItemService(db)

    try:
        item = service.update_item(item_id, data)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        ) from err

    return ItemUpdate(
        id=item.id,
        description=item.description,
    )


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Usuń przedmiot",
    responses={
        status.HTTP_204_NO_CONTENT: {
            "description": "Przedmiot został usunięty",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Nie znaleziono przedmiotu",
        },
    },
)
def delete_item(
    item_id: ItemID,
    db: DBDep,
) -> None:
    service = ItemService(db)

    try:
        service.delete_item(item_id)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        ) from err


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
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        ) from err

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
