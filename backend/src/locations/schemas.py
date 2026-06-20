from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

from src.locations.constants import (
    LOCATION_HISTORY_DESC_LENGTH,
    LOCATION_NAME_LENGTH,
    LocationHistoryChangeType,
    LocationType,
)

type LocationID = int
type LocationName = Annotated[str, Field(min_length=1, max_length=LOCATION_NAME_LENGTH)]
type LocationDescription = Annotated[str, Field(min_length=1)]
type LocationPath = str
type LocationHistoryDescription = Annotated[str, Field(min_length=1, max_length=LOCATION_HISTORY_DESC_LENGTH)]


class LocationCreate(BaseModel):
    name: LocationName
    type: LocationType
    parent_id: LocationID | None = None
    description: LocationDescription | None = None
    is_active: bool = True


class LocationUpdate(BaseModel):
    name: LocationName | None = None
    type: LocationType | None = None
    parent_id: LocationID | None = None
    description: LocationDescription | None = None
    is_active: bool | None = None


class LocationDetails(BaseModel):
    id: LocationID
    name: LocationName
    type: LocationType
    parent_id: LocationID | None
    description: str | None
    is_active: bool
    path: LocationPath


class LocationPagination(BaseModel):
    page: Annotated[int, Field(ge=1)]
    limit: Annotated[int, Field(ge=1, le=100)]
    total: Annotated[int, Field(ge=0)]


class LocationsPaged(BaseModel):
    items: list[LocationDetails]
    pagination: LocationPagination


class LocationTreeNode(BaseModel):
    id: LocationID
    name: LocationName
    type: LocationType
    children: list[LocationTreeNode]


class LocationsTree(BaseModel):
    items: list[LocationTreeNode]


class LocationDeleteRequest(BaseModel):
    replacement_location_id: LocationID


class LocationDeleteResponse(BaseModel):
    id: LocationID
    replacement_location_id: LocationID
    migrated_items_count: int


class LocationHistoryEntry(BaseModel):
    id: int
    location_id: LocationID
    changed_at: datetime
    changed_by: int | None
    change_type: LocationHistoryChangeType
    description: LocationHistoryDescription | None
