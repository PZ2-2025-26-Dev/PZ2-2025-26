from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.equipment.schemas import (
    CategoryRead, CategoryCreate, 
    EquipmentRead, EquipmentCreate, EquipmentDescriptionUpdate, DescriptionHistoryRead
)

from src.equipment.service import EquipmentService
from src.database import get_db

# Mocki zależności auth - do podmiany na prawdziwe funkcje z domeny auth
def get_current_user(): return type('User', (), {'id': 1})()
def require_admin(): return type('User', (), {'id': 1, 'is_admin': True})()

router = APIRouter(prefix="/equipment", tags=["Equipment"])

@router.post("/categories", response_model=CategoryRead)
def create_category(
    data: CategoryCreate, 
    session: Session = Depends(get_db),
    _ = Depends(require_admin) # Zgodnie z wymogiem: tylko admin
):
    service = EquipmentService(session)
    return service.create_category(data)

@router.post("/", response_model=EquipmentRead)
def register_equipment(
    data: EquipmentCreate,
    session: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    service = EquipmentService(session)
    return service.register_equipment(data, current_user.id)

@router.patch("/{equipment_id}/description", response_model=EquipmentRead)
def update_equipment_description(
    equipment_id: int,
    data: EquipmentDescriptionUpdate,
    session: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    service = EquipmentService(session)
    return service.update_description(equipment_id, data.description, current_user.id)

@router.get("/{equipment_id}/description-history", response_model=list[DescriptionHistoryRead])
def get_equipment_description_history(
    equipment_id: int,
    session: Session = Depends(get_db)
):
    service = EquipmentService(session)
    return service.get_description_history(equipment_id)

