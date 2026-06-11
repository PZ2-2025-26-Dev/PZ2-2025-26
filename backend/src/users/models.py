from sqlalchemy import Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from src.auth.constants import UserRole, UserStatus
from src.database import Base
from src.users.constants import (
    FIRST_NAME_MAX_LENGTH,
    LAST_NAME_MAX_LENGTH,
    EMAIL_MAX_LENGTH,
)

class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True)

    first_name: Mapped[str] = mapped_column(
        String(FIRST_NAME_MAX_LENGTH)
    )

    last_name: Mapped[str | None] = mapped_column(
        String(LAST_NAME_MAX_LENGTH)
    )

    email: Mapped[str] = mapped_column(
        String(EMAIL_MAX_LENGTH),
        unique=True,
    )

    role: Mapped[UserRole] = mapped_column(Enum(UserRole))
    status: Mapped[UserStatus] = mapped_column(Enum(UserStatus))
