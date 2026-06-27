from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from src.loans.schemas import LoanCreate
from src.seed import SEED_IDS


def test_loan_create_rejects_user_and_guest_borrower() -> None:
    with pytest.raises(ValidationError):
        LoanCreate(
            item_id=SEED_IDS.laptop_uuid,
            declared_return_date=datetime(2026, 7, 1, tzinfo=UTC),
            borrower_user_id=SEED_IDS.regular_user,
            guest_id=SEED_IDS.guest_user,
        )
