import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.items.models import Item
from src.locations.constants import LocationHistoryChangeType
from src.locations.models import Location, LocationHistory
from src.seed import SEED_IDS

pytestmark = pytest.mark.integration


def test_create_location_endpoint_persists_location_and_history(api_client: TestClient, seeded_db: Session):
    payload = {
        "name": "Polka testowa",
        "type": "shelf",
        "parent_id": SEED_IDS.cabinet,
        "description": "Dodana przez API",
    }

    response = api_client.post("/locations", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == payload["name"]
    assert body["type"] == payload["type"]
    assert body["parent_id"] == SEED_IDS.cabinet
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
        "total": 3,
    }


def test_location_details_endpoint_returns_full_path(api_client: TestClient, seeded_db: Session):
    assert seeded_db.get(Location, SEED_IDS.cabinet) is not None

    response = api_client.get(f"/locations/{SEED_IDS.cabinet}")

    assert response.status_code == 200
    assert response.json()["path"] == "Budynek D / Sala D10 / Szafa A"


def test_update_location_endpoint_updates_database_and_history(api_client: TestClient, seeded_db: Session):
    response = api_client.put(
        f"/locations/{SEED_IDS.room}",
        json={"name": "Sala 204", "description": "Opis z API"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Sala 204"
    assert body["description"] == "Opis z API"
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


def test_delete_location_endpoint_moves_items_to_replacement(api_client: TestClient, seeded_db: Session):
    replacement_response = api_client.post(
        "/locations",
        json={
            "name": "Sala zastepcza",
            "type": "room",
            "parent_id": SEED_IDS.building,
        },
    )
    replacement_id = replacement_response.json()["id"]

    response = api_client.request(
        "DELETE",
        f"/locations/{SEED_IDS.cabinet}",
        json={"replacement_location_id": replacement_id},
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": SEED_IDS.cabinet,
        "replacement_location_id": replacement_id,
        "migrated_items_count": 2,
    }
    assert seeded_db.get(Location, SEED_IDS.cabinet) is None

    moved_items = seeded_db.scalars(select(Item).where(Item.location_id == replacement_id)).all()
    assert {item.id for item in moved_items} >= {SEED_IDS.laptop, SEED_IDS.adapter}


def test_location_items_endpoint_includes_descendant_items(api_client: TestClient, seeded_db: Session):
    assert seeded_db.get(Location, SEED_IDS.building) is not None

    response = api_client.get(f"/locations/{SEED_IDS.building}/items")

    assert response.status_code == 200
    body = response.json()
    assert body["pagination"]["total"] == 3
    assert {item["id"] for item in body["items"]} == {
        SEED_IDS.laptop,
        SEED_IDS.projector,
        SEED_IDS.adapter,
    }
