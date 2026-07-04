from sqlalchemy import Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from src.auth.constants import UserRole, UserStatus
from src.database import Base
from src.users.constants import (
    EMAIL_MAX_LENGTH,
    FIRST_NAME_MAX_LENGTH,
    LAST_NAME_MAX_LENGTH,
)

DEFAULT_UI_ACCENT = "agh-green"
DEFAULT_UI_FONT = "sans"
DEFAULT_UI_THEME = "light"


class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True)

    first_name: Mapped[str] = mapped_column(String(FIRST_NAME_MAX_LENGTH))

    last_name: Mapped[str | None] = mapped_column(String(LAST_NAME_MAX_LENGTH))

    email: Mapped[str | None] = mapped_column(
        String(EMAIL_MAX_LENGTH),
        unique=True,
    )

    role: Mapped[UserRole] = mapped_column(Enum(UserRole))
    status: Mapped[UserStatus] = mapped_column(Enum(UserStatus))
    ui_theme: Mapped[str] = mapped_column(String(16), default=DEFAULT_UI_THEME, server_default=DEFAULT_UI_THEME)
    ui_font: Mapped[str] = mapped_column(String(16), default=DEFAULT_UI_FONT, server_default=DEFAULT_UI_FONT)
    ui_accent: Mapped[str] = mapped_column(String(32), default=DEFAULT_UI_ACCENT, server_default=DEFAULT_UI_ACCENT)
