from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base
from src.loans.constants import LoanStatus, ReturnCondition


class Loan(Base):
    __tablename__ = "loan"

    id: Mapped[int] = mapped_column(primary_key=True)

    item_id: Mapped[int] = mapped_column(ForeignKey("item.id", ondelete="RESTRICT"), index=True)

    user_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), index=True)
    guest_id: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"), index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime)

    declared_return_date: Mapped[datetime] = mapped_column(DateTime)
    note: Mapped[str | None] = mapped_column(Text)

    borrowed_at: Mapped[datetime | None] = mapped_column(DateTime)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime)

    status: Mapped[LoanStatus] = mapped_column(Enum(LoanStatus))
    decision_by: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"))
    decision_at: Mapped[datetime | None] = mapped_column(DateTime)
    decision_comment: Mapped[str | None] = mapped_column(Text)

    return_reported_by: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"))
    return_reported_at: Mapped[datetime | None] = mapped_column(DateTime)
    return_condition: Mapped[ReturnCondition | None] = mapped_column(Enum(ReturnCondition))
    return_note: Mapped[str | None] = mapped_column(Text)

    return_confirmed_by: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="RESTRICT"))
    return_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime)
    return_confirmation_note: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint(
            "(user_id IS NOT NULL AND guest_id IS NULL) OR (user_id IS NULL AND guest_id IS NOT NULL)",
            name="ck_loan_has_one_borrower",
        ),
    )
