from datetime import timedelta

import pytest
from sqlalchemy.orm import Session

from src.items.constants import ItemStatus
from src.items.models import Item
from src.loans.constants import LoanStatus, ReturnCondition
from src.loans.models import Loan
from src.loans.schemas import LoanReturn
from src.loans.service import LoanService, mark_overdue_items
from src.seed import SEED_IDS
from src.users.models import User
from src.utils import now

pytestmark = pytest.mark.integration


def _create_active_loan(db: Session, item_id: int, declared_return_date) -> Loan:
    item = db.get(Item, item_id)
    item.status = ItemStatus.LOANED
    ts = now()
    loan = Loan(
        item_id=item_id,
        user_id=SEED_IDS.admin_user,
        created_at=ts - timedelta(days=7),
        declared_return_date=declared_return_date,
        status=LoanStatus.ACTIVE,
        borrowed_at=ts - timedelta(days=7),
        decision_by=SEED_IDS.regular_user,
        decision_at=ts - timedelta(days=7),
    )
    db.add(loan)
    db.commit()
    return loan


def _item_status(db: Session, item_id: int) -> ItemStatus:
    db.expire_all()
    return db.get(Item, item_id).status


def test_sweep_marks_past_due_loaned_item_as_overdue(seeded_db: Session) -> None:
    _create_active_loan(seeded_db, SEED_IDS.laptop, now() - timedelta(days=1))

    assert mark_overdue_items(seeded_db) == 1
    assert _item_status(seeded_db, SEED_IDS.laptop) == ItemStatus.OVERDUE

    assert mark_overdue_items(seeded_db) == 0
    assert _item_status(seeded_db, SEED_IDS.laptop) == ItemStatus.OVERDUE


def test_sweep_ignores_loan_with_future_return_date(seeded_db: Session) -> None:
    _create_active_loan(seeded_db, SEED_IDS.laptop, now() + timedelta(days=1))

    assert mark_overdue_items(seeded_db) == 0
    assert _item_status(seeded_db, SEED_IDS.laptop) == ItemStatus.LOANED


def test_owner_return_restores_overdue_item_to_available(seeded_db: Session) -> None:
    loan = _create_active_loan(seeded_db, SEED_IDS.laptop, now() - timedelta(days=1))
    mark_overdue_items(seeded_db)
    assert _item_status(seeded_db, SEED_IDS.laptop) == ItemStatus.OVERDUE

    owner = seeded_db.get(User, SEED_IDS.regular_user)
    response = LoanService(seeded_db).return_loan(loan.id, owner, LoanReturn(condition=ReturnCondition.OK))

    assert response.status == LoanStatus.CLOSED
    assert _item_status(seeded_db, SEED_IDS.laptop) == ItemStatus.AVAILABLE
