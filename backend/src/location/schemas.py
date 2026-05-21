from pydantic import BaseModel


class BuildingCreate(BaseModel):
    name: str
    is_hidden: bool | None = False


class BuildingUpdate(BaseModel):
    name: str | None = None
    is_hidden: bool | None = None


class BuildingRead(BuildingCreate):
    id: int
    model_config = {"from_attributes": True}


class RoomCreate(BaseModel):
    name: str
    number: str
    description: str | None = None
    building_id: int
    is_hidden: bool | None = False


class RoomUpdate(BaseModel):
    name: str | None = None
    number: str | None = None
    description: str | None = None
    is_hidden: bool | None = None


class RoomRead(RoomCreate):
    id: int
    model_config = {"from_attributes": True}
