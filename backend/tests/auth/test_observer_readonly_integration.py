import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.seed import SEED_IDS
from tests.helpers import auth_headers

pytestmark = pytest.mark.integration


def test_observer_can_list_all_loans(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        "/loans",
        params={"scope": "all"},
        headers=auth_headers(SEED_IDS.observer_user),
    )

    assert response.status_code == 200
    assert "loans" in response.json()


def test_observer_cannot_create_loan(api_client: TestClient, seeded_db: Session):
    response = api_client.post(
        "/loans",
        json={
            "item_id": str(SEED_IDS.projector_uuid),
            "declared_return_date": "2030-01-01T00:00:00",
        },
        headers=auth_headers(SEED_IDS.observer_user),
    )

    assert response.status_code == 403


def test_observer_can_browse_users(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        "/users/browse",
        headers=auth_headers(SEED_IDS.observer_user),
    )

    assert response.status_code == 200
    assert "users" in response.json()


def test_loans_list_requires_authentication(api_client: TestClient, seeded_db: Session):
    response = api_client.get("/loans")

    assert response.status_code == 401


def test_item_attachments_list_requires_authentication(api_client: TestClient, seeded_db: Session):
    response = api_client.get(f"/items/{SEED_IDS.laptop_uuid}/attachments")

    assert response.status_code == 401


def test_observer_can_list_item_attachments(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        f"/items/{SEED_IDS.laptop_uuid}/attachments",
        headers=auth_headers(SEED_IDS.observer_user),
    )

    assert response.status_code == 200
    assert "attachments" in response.json()


def test_observer_can_read_location_history(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        f"/locations/{SEED_IDS.building}/history",
        headers=auth_headers(SEED_IDS.observer_user),
    )

    assert response.status_code == 200
    assert isinstance(response.json(), list)
