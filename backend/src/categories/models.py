from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.categories.constants import CATEGORY_NAME_LENGTH
from src.database import Base


class Category(Base):
    __tablename__ = "category"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(CATEGORY_NAME_LENGTH))

    # "RESTRICT" żeby nie usunąć przypadkowo rodzica
    # najpierw trzeba przenieść dzieci do innego rodzica, potem dopiero można usunąć
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("category.id", ondelete="RESTRICT"),
        index=True,
    )

    # To pomaga w recursive CTE
    children: Mapped[list[Category]] = relationship("Category", back_populates="parent")
    parent: Mapped[Category | None] = relationship("Category", back_populates="children", remote_side=[id])

    __table_args__ = (UniqueConstraint("parent_id", "name", name="uq_category_parent_name"),)
