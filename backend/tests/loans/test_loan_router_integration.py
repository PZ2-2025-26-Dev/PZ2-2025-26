import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.items.constants import ItemChangeLogType, ItemStatus
from src.items.models import Item, ItemHistory
from src.loans.constants import LoanStatus
from src.loans.models import Loan
from src.seed import SEED_IDS
from tests.helpers import make_loan_payload

pytestmark = pytest.mark.integration


def _item_history_types(db: Session, item_id: int) -> list[ItemChangeLogType]:
    rows = (
        db.execute(select(ItemHistory.change_type).where(ItemHistory.item_id == item_id).order_by(ItemHistory.id))
        .scalars()
        .all()
    )
    return list(rows)


def test_register_loan_marks_item_loaned_and_logs_history(
    user_client: TestClient,
    seeded_db: Session,
):
    response = user_client.post(
        "/loans",
        json=make_loan_payload(SEED_IDS.laptop, SEED_IDS.guest_user),
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == LoanStatus.ACTIVE.value
    assert body["borrower_id"] == SEED_IDS.guest_user
    assert body["registered_by"] == SEED_IDS.regular_user

    item = seeded_db.get(Item, SEED_IDS.laptop)
    assert item.status == ItemStatus.LOANED
    assert ItemChangeLogType.LOANED in _item_history_types(seeded_db, SEED_IDS.laptop)


def test_cannot_loan_unavailable_item(user_client: TestClient):
    # Adapter w danych seedowych jest BROKEN.
    response = user_client.post(
        "/loans",
        json=make_loan_payload(SEED_IDS.adapter, SEED_IDS.guest_user),
    )

    assert response.status_code == 409, response.text


def test_borrower_must_be_a_guest(user_client: TestClient):
    response = user_client.post(
        "/loans",
        json=make_loan_payload(SEED_IDS.laptop, SEED_IDS.regular_user),
    )

    assert response.status_code == 400, response.text


def test_observer_cannot_register_loan(observer_client: TestClient):
    response = observer_client.post(
        "/loans",
        json=make_loan_payload(SEED_IDS.laptop, SEED_IDS.guest_user),
    )

    assert response.status_code == 403, response.text


def test_return_then_reloan_same_guest_keeps_full_history(
    user_client: TestClient,
    seeded_db: Session,
):
    first = user_client.post(
        "/loans",
        json=make_loan_payload(SEED_IDS.laptop, SEED_IDS.guest_user),
    )
    assert first.status_code == 201, first.text
    first_loan_id = first.json()["id"]

    returned = user_client.post(f"/loans/{first_loan_id}/return")
    assert returned.status_code == 200, returned.text
    assert returned.json()["status"] == LoanStatus.RETURNED.value
    assert seeded_db.get(Item, SEED_IDS.laptop).status == ItemStatus.AVAILABLE

    # Ten sam przedmiot wypożyczony ponownie temu samemu Gościowi.
    second = user_client.post(
        "/loans",
        json=make_loan_payload(SEED_IDS.laptop, SEED_IDS.guest_user),
    )
    assert second.status_code == 201, second.text
    second_loan_id = second.json()["id"]

    assert first_loan_id != second_loan_id

    loans = (
        seeded_db.execute(
            select(Loan).where(
                Loan.item_id == SEED_IDS.laptop,
                Loan.borrower_id == SEED_IDS.guest_user,
            )
        )
        .scalars()
        .all()
    )
    assert len(loans) == 2

    history = _item_history_types(seeded_db, SEED_IDS.laptop)
    assert history.count(ItemChangeLogType.LOANED) == 2
    assert history.count(ItemChangeLogType.RETURNED) == 1


def test_double_return_is_rejected(user_client: TestClient):
    created = user_client.post(
        "/loans",
        json=make_loan_payload(SEED_IDS.projector, SEED_IDS.guest_user),
    )
    assert created.status_code == 201, created.text
    loan_id = created.json()["id"]

    assert user_client.post(f"/loans/{loan_id}/return").status_code == 200
    assert user_client.post(f"/loans/{loan_id}/return").status_code == 400


def test_list_loans_filters_by_borrower(user_client: TestClient):
    user_client.post(
        "/loans",
        json=make_loan_payload(SEED_IDS.laptop, SEED_IDS.guest_user),
    )

    response = user_client.get("/loans", params={"borrower_id": SEED_IDS.guest_user})

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total_count"] >= 1
    assert all(loan["borrower_id"] == SEED_IDS.guest_user for loan in body["loans"])
