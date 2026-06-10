from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.auth.schemas import UserID
from src.dependencies import DBDep
from src.items.constants import ItemStatus
from src.items.schemas import (
    CategoryID,
    ExportResponse,
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


def heavy_export_task(search: str | None, category_id: int | None) -> None:
    """Zasobochłonna funkcja wykonywana w tle (w osobnym wątku przez FastAPI)."""
    import time
    time.sleep(5)


@router.get(
    "",
    response_model=ItemsPaged,
    status_code=status.HTTP_200_OK,
    summary="Wylistuj przedmioty",
    responses={
        status.HTTP_200_OK: {
            "model": ItemsPaged,
            "description": "Pomyślnie zwrócono listę przedmiotów na podstawie zadanego filtru",
        },
    },
)
def read_items(
    db: DBDep,
    search: SearchStr | None = None,
    category_id: CategoryID | None = None,
    location_id: LocationID | None = None,
    owner_id: UserID | None = None,
    status: ItemStatus | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
) -> ItemsPaged:
    service = ItemService(db)
    items, total = service.get_items_paged(
        search=search,
        category_id=category_id,
        location_id=location_id,
        owner_id=owner_id,
        status=status,
        page=page,
        limit=limit,
    )

    item_details = [
        ItemDetails(
            id=item.id,
            name=item.name,
            status=item.status,
            description=item.description,
            legacy_id=item.legacy_id,
            category=ItemCategory(
                id=item.category.id,
                name=item.category.name,
            ),
            location=ItemLocation(
                id=item.location.id,
                path=item.location.path,
            ),
            owner=ItemOwner(
                id=item.owner.id,
                name=f"{item.owner.first_name} {item.owner.last_name}",
            ),
        )
        for item in items
    ]

    return ItemsPaged(
        items=item_details,
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
    "/exports/items.xlsx",
    response_model=ExportResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Eksportuj przedmioty do pliku Excel w tle",
    responses={
        status.HTTP_202_ACCEPTED: {
            "model": ExportResponse,
            "description": "Zadanie generowania pliku zostało pomyślnie dodane do kolejki w tle",
        },
    },
)
def export_items_excel(
    background_tasks: BackgroundTasks,
    search: SearchStr | None = None,
    category_id: CategoryID | None = None,
) -> ExportResponse:
    background_tasks.add_task(heavy_export_task, search, category_id)
    return ExportResponse(
        message="Generowanie pliku Excel zostało rozpoczęte w tle. Wynik będzie dostępny wkrótce."
    )