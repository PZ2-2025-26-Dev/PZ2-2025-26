from datetime import datetime

import pytest
from sqlalchemy.orm import Session

from src.items.constants import ItemStatus
from src.items.models import Item
from src.loans.constants import LoanStatus
from src.loans.exceptions import (
    ItemNotAvailableError,
    LoanAlreadyReturnedError,
    LoanBorrowerNotGuestError,
)
from src.loans.service import LoanService
from src.seed import SEED_IDS

pytestmark = pytest.mark.integration

FUTURE_DATE = datetime(2099, 12, 31, 12, 0, 0)


def test_register_loan_sets_active_status(seeded_db: Session):
    service = LoanService(seeded_db)

    loan = service.register_loan(
        item_id=SEED_IDS.laptop,
        borrower_id=SEED_IDS.guest_user,
        registered_by_id=SEED_IDS.admin_user,
        declared_return_date=FUTURE_DATE,
        loan_purpose="Test",
    )

    assert loan.status == LoanStatus.ACTIVE
    assert seeded_db.get(Item, SEED_IDS.laptop).status == ItemStatus.LOANED


def test_register_loan_rejects_non_guest_borrower(seeded_db: Session):
    service = LoanService(seeded_db)

    with pytest.raises(LoanBorrowerNotGuestError):
        service.register_loan(
            item_id=SEED_IDS.laptop,
            borrower_id=SEED_IDS.regular_user,
            registered_by_id=SEED_IDS.admin_user,
            declared_return_date=FUTURE_DATE,
            loan_purpose=None,
        )


def test_register_loan_rejects_unavailable_item(seeded_db: Session):
    service = LoanService(seeded_db)

    with pytest.raises(ItemNotAvailableError):
        service.register_loan(
            item_id=SEED_IDS.adapter,  # BROKEN
            borrower_id=SEED_IDS.guest_user,
            registered_by_id=SEED_IDS.admin_user,
            declared_return_date=FUTURE_DATE,
            loan_purpose=None,
        )


def test_return_loan_is_idempotent_guarded(seeded_db: Session):
    service = LoanService(seeded_db)

    loan = service.register_loan(
        item_id=SEED_IDS.projector,
        borrower_id=SEED_IDS.guest_user,
        registered_by_id=SEED_IDS.admin_user,
        declared_return_date=FUTURE_DATE,
        loan_purpose=None,
    )

    service.return_loan(loan.id, returned_by_id=SEED_IDS.admin_user)

    with pytest.raises(LoanAlreadyReturnedError):
        service.return_loan(loan.id, returned_by_id=SEED_IDS.admin_user)
