from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.categories.models import Category
from src.database import Base
from src.items.constants import (
    ITEM_DESC_LENGTH,
    ITEM_NAME_LENGTH,
    ItemChangeLogType,
    ItemPermissionType,
    ItemStatus,
)
from src.locations.models import Location
from src.users.models import User


class Item(Base):
    __tablename__ = "item"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(ITEM_NAME_LENGTH))
    inventory_number: Mapped[UUID] = mapped_column(Uuid, unique=True, index=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("location.id"), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("category.id"), index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("user.id"), index=True)

    owner: Mapped[User] = relationship()
    category: Mapped[Category] = relationship()
    location: Mapped[Location] = relationship()

    status: Mapped[ItemStatus] = mapped_column(Enum(ItemStatus))

    description: Mapped[str | None] = mapped_column(String(ITEM_DESC_LENGTH))


class ItemHistory(Base):
    __tablename__ = "item_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("item.id", ondelete="CASCADE"))

    updated_at: Mapped[datetime] = mapped_column(DateTime)
    updated_by: Mapped[int] = mapped_column(ForeignKey("user.id"))

    change_type: Mapped[ItemChangeLogType] = mapped_column(Enum(ItemChangeLogType))

    description: Mapped[str | None] = mapped_column(String(512))


class ItemACL(Base):
    __tablename__ = "item_acl"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("item.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    permission: Mapped[ItemPermissionType] = mapped_column(Enum(ItemPermissionType))
