from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from src.categories.constants import CATEGORY_PAGE_DEFAULT, CATEGORY_PAGE_LIMIT_DEFAULT, CATEGORY_PAGE_LIMIT_MAX
from src.categories.exceptions import (
    CategoryDuplicateNameError,
    CategoryHasChildrenError,
    CategoryNotFoundError,
    CategoryParentCycleError,
    CategoryReplacementError,
)
from src.categories.schemas import (
    CategoriesPaged,
    CategoryCreate,
    CategoryDeleteResponse,
    CategoryID,
    CategoryItemsCount,
    CategoryItemsPaged,
    CategoryPagination,
    CategoryResponse,
    CategoryUpdate,
)
from src.categories.service import CategoryService
from src.dependencies import DBDep
from src.schemas import ErrorResponse

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get(
    "",
    response_model=CategoriesPaged,
    status_code=status.HTTP_200_OK,
    summary="Wylistuj kategorie",
    responses={
        status.HTTP_200_OK: {
            "model": CategoriesPaged,
            "description": "Pomyślnie zwrócono stronicowaną listę kategorii.",
        },
    },
)
def read_categories(
    db: DBDep,
    page: Annotated[int, Query(ge=1)] = CATEGORY_PAGE_DEFAULT,
    limit: Annotated[int, Query(ge=1, le=CATEGORY_PAGE_LIMIT_MAX)] = CATEGORY_PAGE_LIMIT_DEFAULT,
) -> CategoriesPaged:
    service = CategoryService(db)
    categories, total = service.list_categories(page=page, limit=limit)
    return CategoriesPaged(
        categories=categories,
        pagination=CategoryPagination(page=page, limit=limit, total=total),
    )


@router.post(
    "",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Dodaj kategorię",
    responses={
        status.HTTP_201_CREATED: {
            "model": CategoryResponse,
            "description": "Kategoria została utworzona.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono kategorii nadrzędnej.",
        },
        status.HTTP_409_CONFLICT: {
            "model": ErrorResponse,
            "description": "Kategoria o tej nazwie istnieje już w tym samym rodzicu.",
        },
    },
)
def create_category(data: CategoryCreate, db: DBDep) -> CategoryResponse:
    service = CategoryService(db)
    try:
        category = service.create_category(data)
    except CategoryNotFoundError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent category not found") from err
    except CategoryDuplicateNameError as err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(err)) from err

    return service.to_response(category)


@router.put(
    "/{category_id}",
    response_model=CategoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Zmodyfikuj kategorię",
    responses={
        status.HTTP_200_OK: {
            "model": CategoryResponse,
            "description": "Kategoria została zmodyfikowana.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Zmiana rodzica utworzyłaby cykl w drzewie kategorii.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono kategorii lub kategorii nadrzędnej.",
        },
        status.HTTP_409_CONFLICT: {
            "model": ErrorResponse,
            "description": "Kategoria o tej nazwie istnieje już w docelowym rodzicu.",
        },
    },
)
def update_category(category_id: CategoryID, data: CategoryUpdate, db: DBDep) -> CategoryResponse:
    service = CategoryService(db)
    try:
        category = service.update_category(category_id, data)
    except CategoryNotFoundError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err)) from err
    except CategoryParentCycleError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err
    except CategoryDuplicateNameError as err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(err)) from err

    return service.to_response(category)


@router.delete(
    "/{category_id}",
    response_model=CategoryDeleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Usuń kategorię",
    responses={
        status.HTTP_200_OK: {
            "model": CategoryDeleteResponse,
            "description": "Kategoria została usunięta, a jej przedmioty przeniesiono do kategorii zastępczej.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Kategoria zastępcza jest taka sama jak usuwana kategoria.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono usuwanej lub zastępczej kategorii.",
        },
        status.HTTP_409_CONFLICT: {
            "model": ErrorResponse,
            "description": "Kategoria ma podkategorie i nie może zostać usunięta przed ich przeniesieniem.",
        },
    },
)
def delete_category(
    category_id: CategoryID,
    db: DBDep,
    replacement_category_id: Annotated[
        int,
        Query(
            ge=1,
            description="ID kategorii, do której zostaną przeniesione przedmioty z usuwanej kategorii.",
        ),
    ],
) -> CategoryDeleteResponse:
    service = CategoryService(db)
    try:
        moved_items_count = service.delete_category(category_id, replacement_category_id)
    except CategoryNotFoundError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err)) from err
    except CategoryReplacementError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err
    except CategoryHasChildrenError as err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(err)) from err

    return CategoryDeleteResponse(
        deleted_category_id=category_id,
        replacement_category_id=replacement_category_id,
        moved_items_count=moved_items_count,
    )


@router.get(
    "/{category_id}/items",
    response_model=CategoryItemsPaged,
    status_code=status.HTTP_200_OK,
    summary="Wylistuj przedmioty w kategorii",
    responses={
        status.HTTP_200_OK: {
            "model": CategoryItemsPaged,
            "description": "Pomyślnie zwrócono stronicowaną listę przedmiotów przypisanych do kategorii.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono kategorii.",
        },
    },
)
def read_category_items(
    category_id: CategoryID,
    db: DBDep,
    page: Annotated[int, Query(ge=1)] = CATEGORY_PAGE_DEFAULT,
    limit: Annotated[int, Query(ge=1, le=CATEGORY_PAGE_LIMIT_MAX)] = CATEGORY_PAGE_LIMIT_DEFAULT,
) -> CategoryItemsPaged:
    service = CategoryService(db)
    try:
        items, total = service.get_category_items(category_id, page=page, limit=limit)
    except CategoryNotFoundError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err)) from err

    return CategoryItemsPaged(
        items=items,
        pagination=CategoryPagination(page=page, limit=limit, total=total),
    )


@router.get(
    "/{category_id}/items/count",
    response_model=CategoryItemsCount,
    status_code=status.HTTP_200_OK,
    summary="Pobierz liczbę przedmiotów w kategorii",
    responses={
        status.HTTP_200_OK: {
            "model": CategoryItemsCount,
            "description": "Pomyślnie zwrócono liczbę przedmiotów przypisanych do kategorii.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono kategorii.",
        },
    },
)
def read_category_items_count(category_id: CategoryID, db: DBDep) -> CategoryItemsCount:
    service = CategoryService(db)
    try:
        count = service.get_category_items_count(category_id)
    except CategoryNotFoundError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err)) from err

    return CategoryItemsCount(category_id=category_id, count=count)
