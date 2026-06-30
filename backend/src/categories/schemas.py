from typing import Annotated

from pydantic import BaseModel, Field

from src.categories.constants import CATEGORY_NAME_LENGTH, CATEGORY_PAGE_LIMIT_MAX

type CategoryID = Annotated[int, Field(ge=1)]
type CategoryName = Annotated[str, Field(min_length=1, max_length=CATEGORY_NAME_LENGTH)]
type CategoryPath = Annotated[str, Field(min_length=1)]


class CategoryCreate(BaseModel):
    name: CategoryName
    parent_id: CategoryID | None = None


class CategoryUpdate(BaseModel):
    name: CategoryName
    parent_id: CategoryID | None = None


class CategoryResponse(BaseModel):
    id: CategoryID
    name: CategoryName
    parent_id: CategoryID | None
    path: CategoryPath
    item_count: int


class CategoryPagination(BaseModel):
    page: Annotated[int, Field(ge=1)]
    limit: Annotated[int, Field(ge=1, le=CATEGORY_PAGE_LIMIT_MAX)]
    total: Annotated[int, Field(ge=0)]


class CategoriesPaged(BaseModel):
    categories: list[CategoryResponse]
    pagination: CategoryPagination


class CategoryItem(BaseModel):
    id: Annotated[int, Field(ge=1)]
    name: Annotated[str, Field(min_length=1)]
    status: Annotated[str, Field(min_length=1)]
    description: str | None = None


class CategoryItemsPaged(BaseModel):
    items: list[CategoryItem]
    pagination: CategoryPagination


class CategoryItemsCount(BaseModel):
    category_id: CategoryID
    count: Annotated[int, Field(ge=0)]


class CategoryDeleteResponse(BaseModel):
    deleted_category_id: CategoryID
    replacement_category_id: CategoryID
    moved_items_count: Annotated[int, Field(ge=0)]
