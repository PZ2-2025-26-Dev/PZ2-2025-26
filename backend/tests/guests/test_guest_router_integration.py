import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.auth.constants import UserRole
from src.seed import SEED_IDS
from src.users.models import User
from tests.helpers import create_guest_via_api, make_guest_payload

pytestmark = pytest.mark.integration


def test_regular_user_can_create_guest(user_client: TestClient, seeded_db: Session):
    created = create_guest_via_api(user_client, first_name="Nowy", last_name="Gość")

    guest = seeded_db.get(User, created["id"])
    assert guest is not None
    assert guest.role == UserRole.GUEST
    # Gość nie ma konta logowania – brak rekordu UserAccount.
    assert guest.email is None


def test_create_guest_with_duplicate_email_is_rejected(user_client: TestClient):
    response = user_client.post(
        "/guests",
        json=make_guest_payload(email="admin.seed@example.com"),
    )

    assert response.status_code == 400, response.text


def test_observer_cannot_create_guest(observer_client: TestClient):
    response = observer_client.post("/guests", json=make_guest_payload())

    assert response.status_code == 403, response.text


def test_only_admin_can_update_guest(
    user_client: TestClient,
    admin_client: TestClient,
):
    created = create_guest_via_api(user_client)

    forbidden = user_client.put(
        f"/guests/{created['id']}",
        json={"first_name": "Zmieniony"},
    )
    assert forbidden.status_code == 403, forbidden.text

    allowed = admin_client.put(
        f"/guests/{created['id']}",
        json={"first_name": "Zmieniony"},
    )
    assert allowed.status_code == 200, allowed.text
    assert allowed.json()["first_name"] == "Zmieniony"


def test_only_admin_can_delete_guest(
    user_client: TestClient,
    admin_client: TestClient,
    seeded_db: Session,
):
    created = create_guest_via_api(user_client)

    forbidden = user_client.delete(f"/guests/{created['id']}")
    assert forbidden.status_code == 403, forbidden.text

    allowed = admin_client.delete(f"/guests/{created['id']}")
    assert allowed.status_code == 204, allowed.text
    assert seeded_db.get(User, created["id"]) is None


def test_list_guests_returns_seeded_guest(user_client: TestClient):
    response = user_client.get("/guests")

    assert response.status_code == 200, response.text
    ids = [guest["id"] for guest in response.json()["guests"]]
    assert SEED_IDS.guest_user in ids
