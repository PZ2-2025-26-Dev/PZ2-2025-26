import enum
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)

from database import Base


class BorrowStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    RETURNED = "RETURNED"


class Guest(Base):
    __tablename__ = "guests"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    contact_info = Column(String(255), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)


class BorrowRequest(Base):
    __tablename__ = "borrow_requests"
    __table_args__ = (
        CheckConstraint(
            "(requester_id IS NOT NULL AND guest_id IS NULL) OR (requester_id IS NULL AND guest_id IS NOT NULL)",
            name="check_requester_or_guest",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)

    # Kto wypożycza (jeden z dwóch musi być wypełniony)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=True)

    status = Column(Enum(BorrowStatus), default=BorrowStatus.PENDING, nullable=False)

    expected_return_date = Column(DateTime, nullable=False)
    actual_return_date = Column(DateTime, nullable=True)

    # Ocena stanu po zwrocie
    condition_rating = Column(Integer, nullable=True)  # np. 1-5
    return_comment = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
