from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.dependencies import DBDep
from src.items.schemas import (
    ItemCreate,
    ItemCreateResponse,
    ItemGetResponse,
    ItemHistoryGetResponse,
    ItemID,
    ItemSearch,
    ItemsPaged,
    ItemUpdate,
    ItemUpdateResponse,
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
    data: Annotated[ItemSearch, Depends()],
) -> ItemsPaged:
    return ItemService(db).search_items(data)

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
        return service.add_item(data)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err


@router.get(
    "/{item_id}",
    response_model=ItemGetResponse,
    status_code=status.HTTP_200_OK,
    summary="Pobierz szczegóły przedmiotu",
    responses={
        status.HTTP_200_OK: {
            "model": ItemGetResponse,
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
) -> ItemGetResponse:
    service = ItemService(db)

    try:
        return service.get_item(item_id)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        ) from err


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
        return service.update_item(item_id, data)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        ) from err


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
    summary="Pobierz historię przedmiotu",
    status_code=status.HTTP_200_OK,
    response_model=ItemHistoryGetResponse,
    responses={
        status.HTTP_404_NOT_FOUND: {
            "description": "Nie znaleziono przedmiotu",
        },
    },
)
def read_item_history(
    item_id: ItemID,
    db: DBDep,
) -> ItemHistoryGetResponse:
    service = ItemService(db)

    try:
        return service.get_item_history(item_id)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        ) from err
