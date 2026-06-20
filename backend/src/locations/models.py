from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base
from src.locations.constants import (
    LOCATION_HISTORY_DESC_LENGTH,
    LOCATION_NAME_LENGTH,
    LocationHistoryChangeType,
    LocationType,
)


class Location(Base):
    __tablename__ = "location"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(LOCATION_NAME_LENGTH))
    type: Mapped[LocationType] = mapped_column(Enum(LocationType), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # "RESTRICT" żeby nie usunąć przypadkowo rodzica
    # najpierw trzeba przenieść dzieci do innego rodzica, potem dopiero można usunąć
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("location.id", ondelete="RESTRICT"))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # To pomaga w recursive CTE
    children: Mapped[list[Location]] = relationship("Location", back_populates="parent")
    parent: Mapped[Location | None] = relationship("Location", back_populates="children", remote_side=[id])


class LocationHistory(Base):
    __tablename__ = "location_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(index=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime)
    changed_by: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    change_type: Mapped[LocationHistoryChangeType] = mapped_column(Enum(LocationHistoryChangeType), nullable=False)
    description: Mapped[str | None] = mapped_column(String(LOCATION_HISTORY_DESC_LENGTH))
