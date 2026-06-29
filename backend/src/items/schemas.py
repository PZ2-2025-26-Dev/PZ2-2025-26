from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.auth.schemas import Name as UserName
from src.auth.schemas import UserID
from src.categories.schemas import CategoryID, CategoryName, CategoryPath
from src.items.constants import (
    ATTACHMENT_FILENAME_MAX_LENGTH,
    ATTACHMENT_MIME_TYPE_MAX_LENGTH,
    BASIC_LENGTH,
    ITEM_DESC_LENGTH,
    ITEM_HISTORY_PAGE_LIMIT_DEFAULT,
    ITEM_HISTORY_PAGE_LIMIT_MAX,
    ITEM_NAME_LENGTH,
    ItemChangeLogType,
    ItemPermissionType,
    ItemStatus,
)
from src.locations.schemas import LocationID, LocationPath

type ItemID = UUID
type ItemName = Annotated[str, Field(min_length=1, max_length=ITEM_NAME_LENGTH)]
type ItemDescription = Annotated[str, Field(min_length=1, max_length=ITEM_DESC_LENGTH)]
type StringBasic = Annotated[str, Field(min_length=1, max_length=BASIC_LENGTH)]
type SearchStr = Annotated[str, Field(min_length=1, max_length=255)]
type SortOrder = Literal["asc", "desc"]
type ItemSortField = Literal["name", "id", "status", "category", "location", "status", "owner"]


class ItemCreate(BaseModel):
    name: ItemName
    category_id: CategoryID
    location_id: LocationID
    owner_id: UserID
    description: ItemDescription | None = None
    parameters: dict | None = None
    oldID: StringBasic | None = None


class ItemCreateResponse(ItemCreate):
    id: ItemID
    status: ItemStatus


class ItemCategory(BaseModel):
    id: CategoryID
    name: CategoryName
    path: CategoryPath


class ItemLocation(BaseModel):
    id: LocationID
    path: LocationPath


class ItemOwner(BaseModel):
    id: UserID
    name: UserName


class ItemSearch(BaseModel):
    uuid: UUID | None = None
    name: SearchStr | None = None
    description: SearchStr | None = None

    category_id: CategoryID | None = None
    location_id: LocationID | None = None
    owner_id: UserID | None = None

    status: ItemStatus | None = None

    borrower_id: UserID | None = None
    search: SearchStr | None = None

    sort_by: ItemSortField = "name"
    sort_order: SortOrder = "asc"

    page: Annotated[int, Field(ge=1)] = 1
    limit: Annotated[int, Field(ge=1, le=100)] = 20


class ItemSearchResponse(BaseModel):
    name: ItemName
    id: ItemID
    status: ItemStatus = ItemStatus.AVAILABLE
    oldID: StringBasic | None = None
    category: ItemCategory
    location: ItemLocation
    owner: ItemOwner
    description: ItemDescription | None


class ItemGetResponse(BaseModel):
    id: ItemID
    name: ItemName
    status: ItemStatus = ItemStatus.AVAILABLE
    oldID: StringBasic | None = None
    category: ItemCategory
    location: ItemLocation
    owner: ItemOwner
    description: ItemDescription | None
    parameters: dict | None = None


class ItemPagination(BaseModel):
    page: Annotated[int, Field(ge=1)]
    limit: Annotated[int, Field(ge=1, le=100)]
    total: Annotated[int, Field(ge=0)]


class ItemsPaged(BaseModel):
    items: list[ItemSearchResponse]
    pagination: ItemPagination


class ItemUpdate(BaseModel):
    name: ItemName | None = None
    description: ItemDescription | None = None
    category_id: CategoryID | None = None
    location_id: LocationID | None = None
    owner_id: UserID | None = None
    parameters: dict | None = None


class ItemUpdateResponse(BaseModel):
    id: ItemID
    name: ItemName
    description: ItemDescription | None
    category_id: CategoryID
    location_id: LocationID
    owner_id: UserID
    status: ItemStatus
    parameters: dict | None = None
    updated_at: datetime


class ItemLabelField(StrEnum):
    NAME = "name"
    DESCRIPTION = "description"
    STATUS = "status"
    CATEGORY = "category"
    LOCATION = "location"
    OWNER = "owner"
    OLD_ID = "oldID"


class ItemLabelRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "fields": [],
                    "width_mm": 76.2,
                    "height_mm": 30.48,
                },
                {
                    "fields": ["name", "category", "location", "parameters.serial_number"],
                    "width_mm": 50,
                    "height_mm": 25,
                },
            ]
        }
    )

    fields: list[str] = Field(
        default_factory=list,
        examples=[["name", "category", "location", "parameters.serial_number"]],
    )
    width_mm: Annotated[float, Field(ge=20, le=200)] = 76.2
    height_mm: Annotated[float, Field(ge=10, le=150)] = 30.48


class ItemDeleteResponse(BaseModel):
    deleted: bool


class ItemHistoryGet(BaseModel):
    id: int
    updated_at: datetime
    updated_by: UserID
    change_type: ItemChangeLogType
    description: str | None


class ItemHistorySearch(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    change_type: ItemChangeLogType | None = Field(default=None, alias="type")
    page: Annotated[int, Field(ge=1)] = 1
    limit: Annotated[int, Field(ge=1, le=ITEM_HISTORY_PAGE_LIMIT_MAX)] = ITEM_HISTORY_PAGE_LIMIT_DEFAULT


class ItemHistoryGetResponse(BaseModel):
    entries: list[ItemHistoryGet]
    pagination: ItemPagination


type AttachmentID = int
type AttachmentFilename = Annotated[str, Field(min_length=1, max_length=ATTACHMENT_FILENAME_MAX_LENGTH)]
type AttachmentMimeType = Annotated[str, Field(min_length=1, max_length=ATTACHMENT_MIME_TYPE_MAX_LENGTH)]


class ItemAttachmentAuthor(BaseModel):
    id: UserID
    name: UserName


class ItemAttachmentResponse(BaseModel):
    id: AttachmentID
    original_filename: AttachmentFilename
    mime_type: AttachmentMimeType
    size_bytes: Annotated[int, Field(ge=0)]
    uploaded_at: datetime
    uploaded_by: ItemAttachmentAuthor


class ItemAttachmentsListResponse(BaseModel):
    attachments: list[ItemAttachmentResponse]


class ItemACLUser(BaseModel):
    id: UserID
    name: UserName


class ItemACLCreate(BaseModel):
    user_id: UserID
    permission: ItemPermissionType


class ItemACLResponse(BaseModel):
    id: int
    user_id: UserID
    user: ItemACLUser
    permission: ItemPermissionType


class ItemACLListResponse(BaseModel):
    entries: list[ItemACLResponse]
