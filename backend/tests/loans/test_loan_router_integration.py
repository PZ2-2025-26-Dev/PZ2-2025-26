from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.items.constants import ItemStatus
from src.seed import SEED_IDS
from tests.helpers import admin_headers, auth_headers, create_item_via_api, get_item_or_fail

pytestmark = pytest.mark.integration


RETURN_DATE = datetime(2026, 7, 10, 12, 0, tzinfo=UTC).isoformat()


def test_user_request_owner_approval_and_confirmed_return(api_client: TestClient, seeded_db: Session) -> None:
    item = create_item_via_api(
        api_client,
        user_id=SEED_IDS.admin_user,
        owner_id=SEED_IDS.admin_user,
        name="Kamera do wypożyczenia",
    )

    create_response = api_client.post(
        "/loans",
        json={
            "item_id": item["id"],
            "declared_return_date": RETURN_DATE,
            "note": "Potrzebna na zajęcia laboratoryjne",
        },
        headers=auth_headers(SEED_IDS.regular_user),
    )
    assert create_response.status_code == 201, create_response.text
    loan = create_response.json()
    assert loan["status"] == "pending_approval"
    assert loan["borrower"]["id"] == SEED_IDS.regular_user
    assert loan["note"] == "Potrzebna na zajęcia laboratoryjne"
    assert get_item_or_fail(seeded_db, item["id"]).status == ItemStatus.PENDING_APPROVAL

    approve_response = api_client.post(
        f"/loans/{loan['id']}/approve",
        json={"approved": True, "note": "Zgoda"},
        headers=admin_headers(),
    )
    assert approve_response.status_code == 200, approve_response.text
    assert approve_response.json()["status"] == "active"
    assert get_item_or_fail(seeded_db, item["id"]).status == ItemStatus.LOANED

    return_response = api_client.post(
        f"/loans/{loan['id']}/return",
        json={"condition": "ok", "note": "Oddane w sekretariacie"},
        headers=auth_headers(SEED_IDS.regular_user),
    )
    assert return_response.status_code == 200, return_response.text
    returned = return_response.json()
    assert returned["status"] == "return_pending_confirmation"
    assert returned["return_condition"] == "ok"
    assert get_item_or_fail(seeded_db, item["id"]).status == ItemStatus.LOANED

    confirm_response = api_client.post(
        f"/loans/{loan['id']}/confirm-return",
        json={"approved": True, "condition": "broken", "note": "Pęknięta obudowa"},
        headers=admin_headers(),
    )
    assert confirm_response.status_code == 200, confirm_response.text
    confirmed = confirm_response.json()
    assert confirmed["status"] == "closed"
    assert confirmed["return_condition"] == "broken"
    assert confirmed["return_confirmation_note"] == "Pęknięta obudowa"
    assert get_item_or_fail(seeded_db, item["id"]).status == ItemStatus.BROKEN


def test_owner_can_create_active_guest_loan_and_list_owned_scope(
    api_client: TestClient,
    seeded_db: Session,
) -> None:
    item = create_item_via_api(
        api_client,
        user_id=SEED_IDS.regular_user,
        owner_id=SEED_IDS.regular_user,
        name="Rejestrator dla gościa",
    )

    response = api_client.post(
        "/loans",
        json={
            "item_id": item["id"],
            "guest_id": SEED_IDS.guest_user,
            "declared_return_date": RETURN_DATE,
            "note": "Wydanie zewnętrzne",
        },
        headers=auth_headers(SEED_IDS.regular_user),
    )
    assert response.status_code == 201, response.text
    loan = response.json()
    assert loan["status"] == "active"
    assert loan["is_external"] is True
    assert loan["borrower"]["role"] == "guest"
    assert get_item_or_fail(seeded_db, item["id"]).status == ItemStatus.LOANED

    list_response = api_client.get(
        "/loans",
        params={"scope": "owned", "status": "active"},
        headers=auth_headers(SEED_IDS.regular_user),
    )
    assert list_response.status_code == 200, list_response.text
    assert [entry["id"] for entry in list_response.json()["loans"]] == [loan["id"]]

    close_response = api_client.post(
        f"/loans/{loan['id']}/return",
        json={"condition": "missing", "note": "Gość zgłosił zagubienie"},
        headers=auth_headers(SEED_IDS.regular_user),
    )
    assert close_response.status_code == 200, close_response.text
    assert close_response.json()["status"] == "closed"
    assert get_item_or_fail(seeded_db, item["id"]).status == ItemStatus.MISSING


def test_owner_can_reject_return_confirmation(api_client: TestClient, seeded_db: Session) -> None:
    item = create_item_via_api(
        api_client,
        user_id=SEED_IDS.admin_user,
        owner_id=SEED_IDS.admin_user,
        name="Projektor z niezaakceptowanym zwrotem",
    )

    create_response = api_client.post(
        "/loans",
        json={
            "item_id": item["id"],
            "declared_return_date": RETURN_DATE,
            "note": "Prezentacja",
        },
        headers=auth_headers(SEED_IDS.regular_user),
    )
    assert create_response.status_code == 201, create_response.text
    loan = create_response.json()

    approve_response = api_client.post(
        f"/loans/{loan['id']}/approve",
        json={"approved": True},
        headers=admin_headers(),
    )
    assert approve_response.status_code == 200, approve_response.text

    return_response = api_client.post(
        f"/loans/{loan['id']}/return",
        json={"condition": "ok", "note": "Zostawione pod salą"},
        headers=auth_headers(SEED_IDS.regular_user),
    )
    assert return_response.status_code == 200, return_response.text
    assert return_response.json()["status"] == "return_pending_confirmation"

    reject_response = api_client.post(
        f"/loans/{loan['id']}/confirm-return",
        json={"approved": False, "note": "Nie znaleziono sprzętu w miejscu zwrotu"},
        headers=admin_headers(),
    )
    assert reject_response.status_code == 200, reject_response.text
    rejected = reject_response.json()
    assert rejected["status"] == "active"
    assert rejected["return_condition"] is None
    assert rejected["return_note"] is None
    assert rejected["return_confirmation_note"] == "Nie znaleziono sprzętu w miejscu zwrotu"
    assert get_item_or_fail(seeded_db, item["id"]).status == ItemStatus.LOANED


def test_owner_cannot_borrow_own_item(api_client: TestClient, seeded_db: Session) -> None:
    item = create_item_via_api(
        api_client,
        user_id=SEED_IDS.regular_user,
        owner_id=SEED_IDS.regular_user,
        name="Sprzęt właściciela",
    )

    request_response = api_client.post(
        "/loans",
        json={
            "item_id": item["id"],
            "declared_return_date": RETURN_DATE,
            "note": "Próba wypożyczenia własnego sprzętu",
        },
        headers=auth_headers(SEED_IDS.regular_user),
    )
    assert request_response.status_code == 403, request_response.text

    direct_loan_response = api_client.post(
        "/loans",
        json={
            "item_id": item["id"],
            "borrower_user_id": SEED_IDS.regular_user,
            "declared_return_date": RETURN_DATE,
            "note": "Próba wskazania właściciela jako wypożyczającego",
        },
        headers=auth_headers(SEED_IDS.regular_user),
    )
    assert direct_loan_response.status_code == 403, direct_loan_response.text
    assert get_item_or_fail(seeded_db, item["id"]).status == ItemStatus.AVAILABLE


def test_non_admin_cannot_list_all_loans(api_client: TestClient, seeded_db: Session) -> None:
    # seeded_db creates the user referenced by auth_headers; otherwise auth stops at 401.
    response = api_client.get(
        "/loans",
        params={"scope": "all"},
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 403
