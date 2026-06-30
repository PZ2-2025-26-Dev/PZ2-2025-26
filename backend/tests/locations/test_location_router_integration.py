import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.jwt import create_access_token
from src.locations.constants import LocationHistoryChangeType, LocationType
from src.locations.models import Location, LocationHistory
from src.seed import SEED_IDS

pytestmark = pytest.mark.integration


def auth_headers(user_id: int) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def admin_headers() -> dict[str, str]:
    return auth_headers(SEED_IDS.admin_user)


def test_create_location_endpoint_persists_location_and_history(api_client: TestClient, seeded_db: Session):
    payload = {
        "name": "Polka testowa",
        "type": "shelf",
        "parent_id": SEED_IDS.cabinet,
        "description": "Dodana przez API",
        "address": "Adres testowy",
    }

    response = api_client.post("/locations", json=payload, headers=admin_headers())

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == payload["name"]
    assert body["type"] == payload["type"]
    assert body["parent_id"] == SEED_IDS.cabinet
    assert body["address"] == "Adres testowy"
    assert body["path"] == "Budynek D / Sala D10 / Szafa A / Polka testowa"

    location = seeded_db.get(Location, body["id"])
    assert location is not None

    history = seeded_db.scalars(
        select(LocationHistory).where(
            LocationHistory.location_id == body["id"],
            LocationHistory.change_type == LocationHistoryChangeType.CREATED,
        )
    ).all()
    assert len(history) == 1


def test_create_location_endpoint_requires_admin_role(api_client: TestClient, seeded_db: Session):
    response = api_client.post(
        "/locations",
        json={"name": "Magazyn", "type": "building"},
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 403


def test_create_remote_location_endpoint_allows_regular_user(api_client: TestClient, seeded_db: Session):
    response = api_client.post(
        "/locations",
        json={
            "name": "Domowe laboratorium",
            "type": "remote",
            "address": "ul. Testowa 1",
            "description": "Lokalizacja zewnętrzna właściciela",
        },
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Domowe laboratorium"
    assert body["type"] == "remote"
    assert body["parent_id"] is None
    assert body["owner_id"] == SEED_IDS.regular_user
    assert body["address"] == "ul. Testowa 1"


def test_create_remote_location_endpoint_rejects_observer(api_client: TestClient, seeded_db: Session):
    response = api_client.post(
        "/locations",
        json={"name": "Lokalizacja obserwatora", "type": "remote"},
        headers=auth_headers(SEED_IDS.observer_user),
    )

    assert response.status_code == 403


def test_list_locations_endpoint_returns_paged_locations(api_client: TestClient, seeded_db: Session):
    assert seeded_db.get(Location, SEED_IDS.building) is not None

    response = api_client.get("/locations", params={"page": 1, "limit": 2}, headers=admin_headers())

    assert response.status_code == 200
    body = response.json()
    assert len(body["locations"]) == 2
    assert body["pagination"] == {
        "page": 1,
        "limit": 2,
        "total": 4,
    }


def test_list_locations_endpoint_allows_regular_user(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        "/locations", params={"page": 1, "limit": 10}, headers=auth_headers(SEED_IDS.regular_user)
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["locations"]) == 4
    assert body["pagination"]["total"] == 4


def test_list_locations_endpoint_requires_authentication(api_client: TestClient):
    response = api_client.get("/locations")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_location_details_endpoint_returns_full_path(api_client: TestClient, seeded_db: Session):
    assert seeded_db.get(Location, SEED_IDS.cabinet) is not None

    response = api_client.get(f"/locations/{SEED_IDS.cabinet}", headers=admin_headers())

    assert response.status_code == 200
    assert response.json()["path"] == "Budynek D / Sala D10 / Szafa A"


def test_location_details_endpoint_allows_regular_user(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        f"/locations/{SEED_IDS.cabinet}",
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 200
    assert response.json()["path"] == "Budynek D / Sala D10 / Szafa A"


def test_location_details_endpoint_requires_authentication(api_client: TestClient):
    response = api_client.get(f"/locations/{SEED_IDS.cabinet}")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_update_location_endpoint_updates_database_and_history(api_client: TestClient, seeded_db: Session):
    response = api_client.put(
        f"/locations/{SEED_IDS.room}",
        json={"name": "Sala 204", "description": "Opis z API", "address": "Adres z API"},
        headers=admin_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Sala 204"
    assert body["description"] == "Opis z API"
    assert body["address"] == "Adres z API"
    assert body["path"] == "Budynek D / Sala 204"

    location = seeded_db.get(Location, SEED_IDS.room)
    assert location.name == "Sala 204"

    history = seeded_db.scalars(
        select(LocationHistory).where(
            LocationHistory.location_id == SEED_IDS.room,
            LocationHistory.change_type == LocationHistoryChangeType.UPDATED,
        )
    ).all()
    assert len(history) == 1


def test_update_location_endpoint_blocks_hiding_subtree_with_items(api_client: TestClient, seeded_db: Session):
    response = api_client.put(
        f"/locations/{SEED_IDS.room}",
        json={"is_active": False},
        headers=admin_headers(),
    )

    assert response.status_code == 400
    assert seeded_db.get(Location, SEED_IDS.room).is_active is True


def test_delete_location_endpoint_blocks_when_subtree_contains_items(api_client: TestClient, seeded_db: Session):
    response = api_client.delete(f"/locations/{SEED_IDS.room}", headers=admin_headers())

    assert response.status_code == 400
    assert seeded_db.get(Location, SEED_IDS.room) is not None
    assert seeded_db.get(Location, SEED_IDS.cabinet) is not None


def test_delete_location_endpoint_removes_empty_subtree(api_client: TestClient, seeded_db: Session):
    empty_room = Location(
        name="Sala bez sprzetu",
        type=LocationType.ROOM,
        parent_id=SEED_IDS.building,
        description=None,
        is_active=True,
    )
    empty_cabinet = Location(
        name="Szafa bez sprzetu",
        type=LocationType.CABINET,
        parent=empty_room,
        description=None,
        is_active=True,
    )
    seeded_db.add_all([empty_room, empty_cabinet])
    seeded_db.commit()

    response = api_client.delete(f"/locations/{empty_room.id}", headers=admin_headers())

    assert response.status_code == 200
    assert response.json() == {
        "id": empty_room.id,
        "deleted_locations_count": 2,
    }
    assert seeded_db.get(Location, empty_room.id) is None
    assert seeded_db.get(Location, empty_cabinet.id) is None

    history = seeded_db.scalars(
        select(LocationHistory).where(
            LocationHistory.location_id == empty_room.id,
            LocationHistory.change_type == LocationHistoryChangeType.DELETED,
        )
    ).all()
    assert len(history) == 1
