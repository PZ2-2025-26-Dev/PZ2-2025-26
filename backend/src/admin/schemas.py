from pydantic import BaseModel, Field


class AdminEquipmentUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    serial_number: str | None = None
    category_id: int | None = None
    owner_id: int | None = None
    manager_id: int | None = None
    description: str | None = None


class CategoryDeleteRequest(BaseModel):
    target_category_id: int = Field(..., description="ID kategorii, do której trafi sprzęt z usuwanej kategorii")


class AdminUserUpdate(BaseModel):
    is_admin: bool | None = None
    is_active: bool | None = None
    # inne pola usera: email, nazwa itp.
