from datetime import datetime

from pydantic import BaseModel, Field


class CategoryBase(BaseModel):
    name: str = Field(..., max_length=100)
    parent_id: int | None = None


class CategoryCreate(CategoryBase):
    pass


class CategoryRead(CategoryBase):
    id: int
    model_config = {"from_attributes": True}


class EquipmentBase(BaseModel):
    name: str
    type: str
    serial_number: str
    category_id: int
    owner_id: int
    manager_id: int
    description: str | None = None


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentRead(EquipmentBase):
    id: int
    model_config = {"from_attributes": True}


class EquipmentDescriptionUpdate(BaseModel):
    description: str


class DescriptionHistoryRead(BaseModel):
    id: int
    description: str | None
    changed_at: datetime
    changed_by_id: int
    model_config = {"from_attributes": True}
