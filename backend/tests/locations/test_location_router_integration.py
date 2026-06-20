import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.locations.constants import LocationHistoryChangeType, LocationType
from src.locations.models import Location, LocationHistory
from src.seed import SEED_IDS

pytestmark = pytest.mark.integration


def test_create_location_endpoint_persists_location_and_history(api_client: TestClient, seeded_db: Session):
    payload = {
        "name": "Polka testowa",
        "type": "shelf",
        "parent_id": SEED_IDS.cabinet,
        "description": "Dodana przez API",
        "address": "Adres testowy",
    }

    response = api_client.post("/locations", json=payload)

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


def test_list_locations_endpoint_returns_paged_locations(api_client: TestClient, seeded_db: Session):
    assert seeded_db.get(Location, SEED_IDS.building) is not None

    response = api_client.get("/locations", params={"page": 1, "limit": 2})

    assert response.status_code == 200
    body = response.json()
    assert len(body["locations"]) == 2
    assert body["pagination"] == {
        "page": 1,
        "limit": 2,
        "total": 4,
    }


def test_location_details_endpoint_returns_full_path(api_client: TestClient, seeded_db: Session):
    assert seeded_db.get(Location, SEED_IDS.cabinet) is not None

    response = api_client.get(f"/locations/{SEED_IDS.cabinet}")

    assert response.status_code == 200
    assert response.json()["path"] == "Budynek D / Sala D10 / Szafa A"


def test_update_location_endpoint_updates_database_and_history(api_client: TestClient, seeded_db: Session):
    response = api_client.put(
        f"/locations/{SEED_IDS.room}",
        json={"name": "Sala 204", "description": "Opis z API", "address": "Adres z API"},
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


def test_delete_location_endpoint_blocks_when_subtree_contains_items(api_client: TestClient, seeded_db: Session):
    response = api_client.delete(f"/locations/{SEED_IDS.room}")

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

    response = api_client.delete(f"/locations/{empty_room.id}")

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
