from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, String, Uuid, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base
from src.items.constants import (
    ITEM_DESC_LENGTH,
    ITEM_NAME_LENGTH,
    ItemChangeLogType,
    ItemPermissionType,
    ItemStatus,
)


class Item(Base):
    __tablename__ = "item"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(ITEM_NAME_LENGTH), index=True)
    inventory_number: Mapped[UUID] = mapped_column(Uuid, unique=True, index=True)  
    location_id: Mapped[int] = mapped_column(ForeignKey("location.id"), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("category.id"), index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("user.id"), index=True)

    status: Mapped[ItemStatus] = mapped_column(Enum(ItemStatus))

    description: Mapped[str | None] = mapped_column(String(ITEM_DESC_LENGTH))

    category: Mapped["Category"] = relationship()
    location: Mapped["Location"] = relationship()
    owner: Mapped["User"] = relationship()
    legacy_identifier: Mapped["LegacyIdentifier | None"] = relationship(back_populates="item")

    @property
    def legacy_id(self) -> int | None:
        """Wirtualna właściwość ułatwiająca automatyczne mapowanie przez Pydantic."""
        return self.legacy_identifier.legacy_id if self.legacy_identifier else None


class LegacyIdentifier(Base):
    __tablename__ = "legacy_identifier"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("item.id"), unique=True)
    legacy_id: Mapped[int] = mapped_column(Integer, index=True)

    item: Mapped[Item] = relationship(back_populates="legacy_identifier")


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