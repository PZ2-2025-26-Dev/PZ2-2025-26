import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.auth.constants import UserRole
from src.seed import SEED_IDS
from src.users.models import User
from tests.helpers import auth_headers, create_guest_via_api, make_guest_payload

pytestmark = pytest.mark.integration


@pytest.fixture()
def user_client(api_client: TestClient) -> TestClient:
    return api_client


@pytest.fixture()
def admin_client(api_client: TestClient) -> TestClient:
    return api_client


@pytest.fixture()
def observer_client(api_client: TestClient) -> TestClient:
    return api_client


def test_regular_user_can_create_guest(user_client: TestClient, seeded_db: Session):
    created = create_guest_via_api(user_client, first_name="Nowy", last_name="Gość")

    guest = seeded_db.get(User, created["id"])
    assert guest is not None
    assert guest.role == UserRole.GUEST
    assert guest.email is None


def test_create_guest_with_duplicate_email_is_rejected(user_client: TestClient, seeded_db: Session):
    response = user_client.post(
        "/users/guests",
        json=make_guest_payload(email="admin.seed@example.com"),
        headers=auth_headers(),
    )

    assert response.status_code == 400, response.text


def test_observer_cannot_create_guest(observer_client: TestClient, seeded_db: Session):
    response = observer_client.post(
        "/users/guests",
        json=make_guest_payload(),
        headers=auth_headers(SEED_IDS.observer_user),
    )

    assert response.status_code == 403, response.text


def test_only_admin_can_update_guest(
    user_client: TestClient,
    admin_client: TestClient,
    seeded_db: Session,
):
    created = create_guest_via_api(user_client)

    forbidden = user_client.put(
        f"/users/{created['id']}",
        json={"first_name": "Zmieniony"},
        headers=auth_headers(),
    )
    assert forbidden.status_code == 403, forbidden.text

    allowed = admin_client.put(
        f"/users/{created['id']}",
        json={"first_name": "Zmieniony"},
        headers=auth_headers(SEED_IDS.admin_user),
    )
    assert allowed.status_code == 200, allowed.text
    assert allowed.json()["first_name"] == "Zmieniony"


def test_only_admin_can_delete_guest(
    user_client: TestClient,
    admin_client: TestClient,
    seeded_db: Session,
):
    created = create_guest_via_api(user_client)

    forbidden = user_client.delete(
        f"/users/{created['id']}",
        headers=auth_headers(),
    )
    assert forbidden.status_code == 403, forbidden.text

    allowed = admin_client.delete(
        f"/users/{created['id']}",
        headers=auth_headers(SEED_IDS.admin_user),
    )
    assert allowed.status_code == 204, allowed.text
    assert seeded_db.get(User, created["id"]) is None


def test_browse_users_hides_details_for_regular_users(user_client: TestClient, seeded_db: Session):
    response = user_client.get("/users/browse", headers=auth_headers())

    assert response.status_code == 200, response.text
    body = response.json()
    regular_users = [user for user in body["users"] if user.get("role") != "guest"]

    assert len(regular_users) >= 1
    for user in regular_users:
        assert "id" in user
        assert "email" not in user
        assert "first_name" in user


def test_browse_users_shows_guest_contact_details(user_client: TestClient, seeded_db: Session):
    response = user_client.get("/users/browse", headers=auth_headers())

    assert response.status_code == 200, response.text
    guests = [user for user in response.json()["users"] if user.get("role") == "guest"]

    assert len(guests) >= 1
    seed_guest = next(user for user in guests if user["first_name"] == "Grzegorz")
    assert seed_guest["email"] == "guest.seed@example.com"
    assert "id" in seed_guest


def test_admin_list_users_excludes_guests(admin_client: TestClient, seeded_db: Session):
    response = admin_client.get("/users", headers=auth_headers(SEED_IDS.admin_user))

    assert response.status_code == 200, response.text
    roles = {user["role"] for user in response.json()["users"]}
    assert UserRole.GUEST.value not in roles
