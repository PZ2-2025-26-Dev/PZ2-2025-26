from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base
from src.loans.constants import LOAN_PURPOSE_MAX_LENGTH, LoanStatus


class Loan(Base):
    """Pojedyncze wypożyczenie obiektu Gościowi.

    Każde wypożyczenie to osobny rekord, dzięki czemu ten sam przedmiot może
    być wielokrotnie wypożyczany tej samej osobie (temu samemu Gościowi),
    a pełna historia pozostaje zachowana.
    """

    __tablename__ = "loan"

    id: Mapped[int] = mapped_column(primary_key=True)

    item_id: Mapped[int] = mapped_column(ForeignKey("item.id", ondelete="RESTRICT"), index=True)

    # Gość, któremu wypożyczono sprzęt (User z rolą GUEST).
    borrower_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), index=True)

    # Właściciel/Administrator, który zarejestrował wypożyczenie.
    registered_by: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime)

    declared_return_date: Mapped[datetime] = mapped_column(DateTime)
    loan_purpose: Mapped[str | None] = mapped_column(String(LOAN_PURPOSE_MAX_LENGTH))

    returned_at: Mapped[datetime | None] = mapped_column(DateTime)

    status: Mapped[LoanStatus] = mapped_column(Enum(LoanStatus))
