from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.admin.schemas import (
    AdminEquipmentUpdate,
    AdminUserUpdate,
)
from src.equipment.models import Category, Equipment
from src.models import User


class AdminService:
    def __init__(self, session: Session):
        self.session = session

    def update_equipment_full(self, equipment_id: int, data: AdminEquipmentUpdate) -> Equipment:
        equipment = self.session.get(Equipment, equipment_id)
        if not equipment:
            raise HTTPException(status_code=404, detail="Equipment not found")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(equipment, key, value)

        # Zmiana opisu przez admina mogłaby tu też dodawać wpis do historii (opcjonalnie)

        self.session.commit()
        self.session.refresh(equipment)
        return equipment

    def delete_equipment(self, equipment_id: int):
        equipment = self.session.get(Equipment, equipment_id)
        if not equipment:
            raise HTTPException(status_code=404, detail="Equipment not found")

        self.session.delete(equipment)
        self.session.commit()

    def delete_category(self, category_id: int, target_category_id: int):
        if category_id == target_category_id:
            raise HTTPException(status_code=400, detail="Target category must be different from the deleted one")

        category_to_delete = self.session.get(Category, category_id)
        target_category = self.session.get(Category, target_category_id)

        if not category_to_delete or not target_category:
            raise HTTPException(status_code=404, detail="One or both categories not found")

        # Przepięcie sprzętu do nowej kategorii
        equipments = self.session.query(Equipment).filter(Equipment.category_id == category_id).all()
        for eq in equipments:
            eq.category_id = target_category_id

        # Przepięcie podkategorii usuwanej kategorii do nowej kategorii (żeby nie zerwać drzewa)
        subcategories = self.session.query(Category).filter(Category.parent_id == category_id).all()
        for sub in subcategories:
            sub.parent_id = target_category_id

        # Usunięcie właściwej kategorii
        self.session.delete(category_to_delete)
        self.session.commit()

    # --- UŻYTKOWNICY ---
    def update_user(self, user_id: int, data: AdminUserUpdate):
        # Pseudo-kod dla Usera - dostosuj do swojego modelu User
        user = self.session.get(User, user_id)  # requires import of User
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(user, key, value)

        self.session.commit()
        self.session.refresh(user)
        return user
