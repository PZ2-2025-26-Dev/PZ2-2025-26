from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.loans.constants import LoanStatus, ReturnCondition
from src.seed import SEED_IDS
from tests.helpers import admin_headers, auth_headers, make_loan

pytestmark = pytest.mark.integration

XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _item_row(payload: dict, item_uuid) -> dict:
    rows = [row for row in payload["items"] if row["item_uuid"] == str(item_uuid)]
    assert len(rows) == 1
    return rows[0]


def test_statistics_aggregates_for_admin(api_client: TestClient, seeded_db: Session):
    day = datetime(2026, 1, 10, 12, 0)
    # on-time OK return
    make_loan(
        seeded_db,
        item_id=SEED_IDS.laptop,
        borrowed_at=day,
        declared_return_date=day + timedelta(days=7),
        returned_at=day + timedelta(days=3),
        return_condition=ReturnCondition.OK,
    )
    # returned late -> overdue
    make_loan(
        seeded_db,
        item_id=SEED_IDS.laptop,
        borrowed_at=day,
        declared_return_date=day + timedelta(days=1),
        returned_at=day + timedelta(days=5),
        return_condition=ReturnCondition.OK,
    )
    # broken return
    make_loan(
        seeded_db,
        item_id=SEED_IDS.laptop,
        borrowed_at=day,
        declared_return_date=day + timedelta(days=7),
        returned_at=day + timedelta(days=2),
        return_condition=ReturnCondition.BROKEN,
    )
    # missing return
    make_loan(
        seeded_db,
        item_id=SEED_IDS.laptop,
        borrowed_at=day,
        declared_return_date=day + timedelta(days=7),
        returned_at=day + timedelta(days=2),
        return_condition=ReturnCondition.MISSING,
    )

    response = api_client.get("/exports/statistics", headers=admin_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["total_loans"] == 4
    assert payload["summary"]["total_overdue"] == 1
    assert payload["summary"]["total_broken"] == 1
    assert payload["summary"]["total_missing"] == 1

    laptop = _item_row(payload, SEED_IDS.laptop_uuid)
    assert laptop["loan_count"] == 4
    assert laptop["overdue_count"] == 1
    assert laptop["broken_count"] == 1
    assert laptop["missing_count"] == 1


def test_statistics_counts_active_loan_past_due_as_overdue(api_client: TestClient, seeded_db: Session):
    day = datetime.now() - timedelta(days=10)
    make_loan(
        seeded_db,
        item_id=SEED_IDS.laptop,
        borrowed_at=day,
        declared_return_date=day + timedelta(days=1),
        status=LoanStatus.ACTIVE,
    )

    response = api_client.get("/exports/statistics", headers=admin_headers())

    assert response.status_code == 200
    laptop = _item_row(response.json(), SEED_IDS.laptop_uuid)
    assert laptop["loan_count"] == 1
    assert laptop["overdue_count"] == 1


def test_statistics_scopes_regular_user_to_owned_items(api_client: TestClient, seeded_db: Session):
    day = datetime(2026, 1, 10, 12, 0)
    # laptop is owned by the regular user, projector by the admin
    make_loan(
        seeded_db,
        item_id=SEED_IDS.laptop,
        borrowed_at=day,
        declared_return_date=day + timedelta(days=7),
        returned_at=day + timedelta(days=1),
        return_condition=ReturnCondition.OK,
    )
    make_loan(
        seeded_db,
        item_id=SEED_IDS.projector,
        borrowed_at=day,
        declared_return_date=day + timedelta(days=7),
        returned_at=day + timedelta(days=1),
        return_condition=ReturnCondition.OK,
    )

    response = api_client.get("/exports/statistics", headers=auth_headers(SEED_IDS.regular_user))

    assert response.status_code == 200
    payload = response.json()
    item_uuids = {row["item_uuid"] for row in payload["items"]}
    assert str(SEED_IDS.laptop_uuid) in item_uuids
    assert str(SEED_IDS.projector_uuid) not in item_uuids
    assert payload["summary"]["total_loans"] == 1


def test_statistics_date_filter_is_inclusive(api_client: TestClient, seeded_db: Session):
    january = datetime(2026, 1, 15, 12, 0)
    february = datetime(2026, 2, 15, 12, 0)
    for day in (january, february):
        make_loan(
            seeded_db,
            item_id=SEED_IDS.laptop,
            borrowed_at=day,
            declared_return_date=day + timedelta(days=7),
            returned_at=day + timedelta(days=1),
            return_condition=ReturnCondition.OK,
        )

    response = api_client.get(
        "/exports/statistics",
        params={"date_from": "2026-01-01", "date_to": "2026-01-15"},
        headers=admin_headers(),
    )

    assert response.status_code == 200
    laptop = _item_row(response.json(), SEED_IDS.laptop_uuid)
    assert laptop["loan_count"] == 1


def test_statistics_rejects_observer(api_client: TestClient, seeded_db: Session):
    response = api_client.get("/exports/statistics", headers=auth_headers(SEED_IDS.observer_user))

    assert response.status_code == 403


def test_statistics_requires_authentication(api_client: TestClient, seeded_db: Session):
    response = api_client.get("/exports/statistics")

    assert response.status_code == 401


def test_statistics_xlsx_export(api_client: TestClient, seeded_db: Session):
    response = api_client.get("/exports/statistics/xlsx", headers=admin_headers())

    assert response.status_code == 200
    assert response.headers["content-type"] == XLSX_CONTENT_TYPE


def test_statistics_pdf_export(api_client: TestClient, seeded_db: Session):
    response = api_client.get("/exports/statistics/pdf", headers=admin_headers())

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_statistics_exports_reject_observer(api_client: TestClient, seeded_db: Session):
    for url in ("/exports/statistics/xlsx", "/exports/statistics/pdf"):
        response = api_client.get(url, headers=auth_headers(SEED_IDS.observer_user))

        assert response.status_code == 403
