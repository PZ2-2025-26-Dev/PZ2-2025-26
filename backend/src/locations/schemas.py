from pydantic import BaseModel

from src.locations.constants import LocationType

type LocationID = int
type LocationPath = str


class LocationTreeNode(BaseModel):
    id: LocationID
    name: str
    type: LocationType
    children: list["LocationTreeNode"] = []


class LocationTreeResponse(BaseModel):
    tree: list[LocationTreeNode]
