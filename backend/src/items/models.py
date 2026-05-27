from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base
from src.items.constants import ItemChangeLogType, ItemPermissionType, ItemStatus


class Item(Base):
    __tablename__ = "item"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))

    location_id: Mapped[int] = mapped_column(ForeignKey("location.id"), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("category.id"), index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("user.id"), index=True)

    status: Mapped[ItemStatus] = mapped_column(Enum(ItemStatus))

    # TODO:
    # public_id: Mapped[UUID]


class ItemHistory(Base):
    __tablename__ = "item_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("item.id"))

    updated_at: Mapped[datetime] = mapped_column(DateTime)
    updated_by: Mapped[int] = mapped_column(ForeignKey("user.id"))

    change_type: Mapped[ItemChangeLogType] = mapped_column(Enum(ItemChangeLogType))
    
    description: Mapped[str | None] = mapped_column(String(512))


class ItemACL(Base):
    __tablename__ = "item_acl"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("item.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    permission: Mapped[ItemPermissionType] = mapped_column(Enum(ItemPermissionType))
