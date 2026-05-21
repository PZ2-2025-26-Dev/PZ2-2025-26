from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.admin.schemas import (
    AdminEquipmentUpdate,
    AdminUserUpdate,
    CategoryDeleteRequest,
)
from src.admin.service import AdminService
from src.database import get_db
from src.equipment.schemas import EquipmentRead


# Podmień na swoje prawdziwe zależności z modułu auth
def require_admin():
    # Funkcja weryfikująca JWT i pole is_admin == True.
    # Jeśli użytkownik nie jest adminem, rzuca HTTPException(403)
    pass


# Aplikujemy require\_admin do WSZYSTKICH endpointów w tym routerze
router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])


@router.put("/equipment/{equipment_id}", response_model=EquipmentRead)
def admin_update_equipment(equipment_id: int, data: AdminEquipmentUpdate, session: Session = Depends(get_db)):
    service = AdminService(session)
    return service.update_equipment_full(equipment_id, data)


@router.delete("/equipment/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_equipment(equipment_id: int, session: Session = Depends(get_db)):
    service = AdminService(session)
    service.delete_equipment(equipment_id)


@router.post("/categories/{category_id}/delete", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_category(category_id: int, data: CategoryDeleteRequest, session: Session = Depends(get_db)):
    # Używamy POST dla akcji delete z body, ew. można użyć DELETE i `target_category_id` przekazać w Query param
    service = AdminService(session)
    service.delete_category(category_id, data.target_category_id)


@router.put("/users/{user_id}")
def admin_update_user(user_id: int, data: AdminUserUpdate, session: Session = Depends(get_db)):
    service = AdminService(session)
    return service.update_user(user_id, data)
