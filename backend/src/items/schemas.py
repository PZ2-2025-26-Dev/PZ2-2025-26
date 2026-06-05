from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field

from src.auth.schemas import Name as UserName
from src.auth.schemas import UserID
from src.categories.schemas import CategoryID, CategoryName
from src.items.constants import ITEM_DESC_LENGTH, ITEM_NAME_LENGTH, ItemStatus
from src.locations.schemas import LocationID, LocationPath

type ItemID = int
type ItemName = Annotated[str, Field(min_length=1, max_length=ITEM_NAME_LENGTH)]
type ItemDescription = Annotated[str, Field(min_length=1, max_length=ITEM_DESC_LENGTH)]
type SearchStr = Annotated[str, Field(min_length=1, max_length=255)]


class ItemCreate(BaseModel):
    name: ItemName
    category_id: CategoryID
    location_id: LocationID
    owner_id: UserID
    description: ItemDescription | None = None
    legacy_id: int | None = None  


class ItemCreateResponse(BaseModel):
    id: ItemID
    name: ItemName
    inventory_number: UUID
    status: ItemStatus
    description: ItemDescription | None


class Item(BaseModel):
    name: ItemName
    category_id: CategoryID
    location_id: LocationID
    owner_id: UserID
    description: ItemDescription | None
    status: ItemStatus = ItemStatus.AVAILABLE
    legacy_id: int | None


class ItemCategory(BaseModel):
    id: CategoryID
    name: CategoryName


class ItemLocation(BaseModel):
    id: LocationID
    path: LocationPath


class ItemOwner(BaseModel):
    id: UserID
    name: UserName


class ItemDetails(BaseModel):
    id: ItemID
    name: ItemName
    category: ItemCategory
    location: ItemLocation
    owner: ItemOwner
    description: ItemDescription | None
    status: ItemStatus = ItemStatus.AVAILABLE
    legacy_id: int | None


class ItemPagination(BaseModel):
    page: Annotated[int, Field(ge=1)]
    limit: Annotated[int, Field(ge=1, le=100)]
    total: Annotated[int, Field(ge=0)]


class ItemsPaged(BaseModel):
    items: list[ItemDetails]
    pagination: ItemPagination


class ExportResponse(BaseModel):
    message: str