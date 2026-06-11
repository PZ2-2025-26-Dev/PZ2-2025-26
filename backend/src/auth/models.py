from sqlalchemy import Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.auth.constants import AuthProvider
from src.database import Base

from src.auth.constants import PROVIDER_USER_ID_MAX_LENGTH

class UserAccount(Base):
    __tablename__ = "user_account"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"), index=True)

    # 'str | None' bo jak przez Google to nie przechowujemy hasła
    pwd_hash: Mapped[str | None] = mapped_column(Text)

    provider: Mapped[AuthProvider] = mapped_column(
        Enum(AuthProvider, name="auth_provider_enum")
    )

    # jeżeli provider="local", to tutaj null
    provider_user_id: Mapped[str | None] = mapped_column(String(PROVIDER_USER_ID_MAX_LENGTH), index=True)

    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_user_provider"),)
