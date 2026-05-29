from sqlalchemy import Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from src.auth.constants import UserRole, UserStatus
from src.database import Base


class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True)

    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))

    email: Mapped[str] = mapped_column(String(512), unique=True)

    role: Mapped[UserRole] = mapped_column(Enum(UserRole))
    status: Mapped[UserStatus] = mapped_column(Enum(UserStatus))
