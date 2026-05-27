from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base


class Guest(Base):
    __tablename__ = "guest"

    id: Mapped[int] = mapped_column(primary_key=True)

    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))

    # bez unique, bo może być ogólny mail firmowy
    email: Mapped[str | None] = mapped_column(String(512))

    registered_by: Mapped[int] = mapped_column(ForeignKey("user.id"), index=True)

    description: Mapped[str | None] = mapped_column(Text)
