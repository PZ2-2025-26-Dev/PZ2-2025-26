from sqlalchemy.orm import Session
from src.equipment.models import Category, Equipment, EquipmentDescriptionHistory
from src.equipment.schemas import CategoryCreate, EquipmentCreate
from fastapi import HTTPException

class EquipmentService:
    def __init__(self, session: Session):
        self.session = session

    def create_category(self, data: CategoryCreate) -> Category:
        if data.parent_id:
            parent = self.session.get(Category, data.parent_id)
            if not parent:
                raise HTTPException(status_code=404, detail="Parent category not found")
            
            if parent.parent_id:
                grandparent = self.session.get(Category, parent.parent_id)
                if grandparent.parent_id:
                    raise HTTPException(status_code=400, detail="Maximum category depth (3) exceeded")

        category = Category(**data.model_dump())
        self.session.add(category)
        self.session.commit()
        self.session.refresh(category)
        return category

    def register_equipment(self, data: EquipmentCreate, current_user_id: int) -> Equipment:
        if self.session.query(Equipment).filter_by(serial_number=data.serial_number).first():
            raise HTTPException(status_code=400, detail="Serial number already exists")

        equipment = Equipment(**data.model_dump())
        self.session.add(equipment)
        self.session.flush() # Wymuszamy wygenerowanie ID dla equipment bez kończenia transakcji

        if equipment.description:
            history_entry = EquipmentDescriptionHistory(
                equipment_id=equipment.id,
                description=equipment.description,
                changed_by_id=current_user_id
            )
            self.session.add(history_entry)

        self.session.commit()
        self.session.refresh(equipment)
        return equipment

    def update_description(self, equipment_id: int, new_description: str, current_user_id: int) -> Equipment:
        equipment = self.session.get(Equipment, equipment_id)
        if not equipment:
            raise HTTPException(status_code=404, detail="Equipment not found")

        equipment.description = new_description

        history_entry = EquipmentDescriptionHistory(
            equipment_id=equipment.id,
            description=new_description,
            changed_by_id=current_user_id
        )
        self.session.add(history_entry)
        
        self.session.commit()
        self.session.refresh(equipment)
        return equipment

    def get_description_history(self, equipment_id: int):
        equipment = self.session.get(Equipment, equipment_id)
        if not equipment:
            raise HTTPException(status_code=404, detail="Equipment not found")
        
        return self.session.query(EquipmentDescriptionHistory).filter_by(equipment_id=equipment_id).order_by(EquipmentDescriptionHistory.changed_at.desc()).all()
