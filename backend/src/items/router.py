from datetime import datetime
from typing import Annotated
from uuid import uuid7

from backend.src.utils import now
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.schemas import UserID
from src.categories.models import Category
from src.database import get_db
from src.items.constants import ItemChangeLogType, ItemStatus
from src.items.models import Item, ItemHistory
from src.items.schemas import (
    CategoryID,
    ItemCreate,
    ItemCreateResponse,
    ItemCategory,
    ItemDetails,
    ItemLocation,
    ItemOwner,
    ItemPagination,
    ItemsPaged,
    LocationID,
    SearchStr,
)
from src.locations.models import Location
from src.users.models import User

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
    db: DBDep = Depends(get_db),
) -> ItemCreateResponse:

    # Generate inventory number (UUIDv7)
    inventory_number = uuid7()

    # Create new item with default AVAILABLE status
    new_item = Item(
        name=data.name,
        inventory_number=inventory_number,
        category_id=data.category_id,
        location_id=data.location_id,
        owner_id=data.owner_id,
        status=ItemStatus.AVAILABLE,
        description=data.description,
    )

    db.add(new_item)
    db.flush()  # Get the item ID without committing

    # Create history record in the same transaction
    item_history = ItemHistory(
        item_id=new_item.id,
        updated_at=now(),
        updated_by=data.owner_id,
        change_type=ItemChangeLogType.CREATED,
        description="Item created",
    )

    db.add(item_history)
    db.commit()
    db.refresh(new_item)

    return ItemCreateResponse(
        id=new_item.id,
        name = new_item.name,
        description=new_item.description,
        inventory_number=new_item.inventory_number,
        status=new_item.status,
    )


@router.get(
    "/{item_id}",
    response_model=ItemDetails,
    status_code=status.HTTP_200_OK,
    summary="Wypisz szczegóły przedmiotu",
    responses={
        status.HTTP_200_OK: {
            "model": ItemDetails,
            "description": "Pomyślnie zwrócono szczegóły przedmiotu",
        }
    },
)
def read_item(item_id: int):
    return (
        ItemDetails(
            id=item_id,
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
    )
