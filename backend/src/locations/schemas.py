from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.locations.constants import LOCATION_NAME_MAX_LENGTH, LocationType

type LocationID = int
type LocationName = Annotated[str, Field(min_length=1, max_length=LOCATION_NAME_MAX_LENGTH)]
type LocationPath = str


class LocationCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: LocationName
    type: LocationType
    parent_id: LocationID | None = Field(default=None, alias="parentId")
    description: str | None = None

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, value: object) -> object:
        if isinstance(value, str):
            return value.lower()

        return value


class LocationCreateResponse(BaseModel):
    id: LocationID
    path: LocationPath


class LocationTreeNode(BaseModel):
    id: LocationID
    name: LocationName
    type: LocationType
    description: str | None
    is_active: bool
    children: list[LocationTreeNode] = Field(default_factory=list)


class LocationsTree(BaseModel):
    items: list[LocationTreeNode]
