from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from src.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)

    # Samoodwołująca się relacja do budowy drzewa
    subcategories = relationship("Category", backref="parent", remote_side=[id])
    equipment = relationship("Equipment", back_populates="category")


class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    type = Column(String(100), nullable=False)
    serial_number = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    category = relationship("Category", back_populates="equipment")
    description_history = relationship(
        "EquipmentDescriptionHistory", back_populates="equipment", cascade="all, delete-orphan"
    )


class EquipmentDescriptionHistory(Base):
    __tablename__ = "equipment_description_history"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)
    description = Column(Text, nullable=True)
    changed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    equipment = relationship("Equipment", back_populates="description_history")
