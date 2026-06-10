from sqlalchemy import Boolean, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base
from src.locations.constants import LOCATION_NAME_MAX_LENGTH, LocationType


class Location(Base):
    __tablename__ = "location"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(LOCATION_NAME_MAX_LENGTH))
    type: Mapped[LocationType] = mapped_column(Enum(LocationType), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # "RESTRICT" żeby nie usunąć przypadkowo rodzica
    # najpierw trzeba przenieść dzieci do innego rodzica, potem dopiero można usunąć
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("location.id", ondelete="RESTRICT"))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # To pomaga w recursive CTE
    children: Mapped[list[Location]] = relationship("Location", back_populates="parent")
    parent: Mapped[Location | None] = relationship("Location", back_populates="children", remote_side=[id])
