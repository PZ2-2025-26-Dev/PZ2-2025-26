import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.items.models import Item
from src.seed import SEED_IDS
from tests.helpers import assert_item_created_with_history, make_item_payload

pytestmark = pytest.mark.integration


def test_create_item_endpoint_persists_item_and_history(api_client: TestClient, seeded_db: Session):
    payload = make_item_payload(name="Kamera dokumentacyjna")

    response = api_client.post("/items", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == payload["name"]

    item = assert_item_created_with_history(seeded_db, body["id"])
    assert item.category_id == SEED_IDS.electronics
    assert item.location_id == SEED_IDS.room
    assert item.owner_id == SEED_IDS.regular_user


def test_update_item_endpoint_updates_live_database(api_client: TestClient, seeded_db: Session):
    response = api_client.patch(
        f"/items/{SEED_IDS.laptop}",
        json={"description": "Opis zmieniony przez API"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": SEED_IDS.laptop,
        "description": "Opis zmieniony przez API",
    }
    assert seeded_db.get(Item, SEED_IDS.laptop).description == "Opis zmieniony przez API"


def test_item_history_endpoint_reads_database_rows(api_client: TestClient, seeded_db: Session):
    created = api_client.post("/items", json=make_item_payload(name="Czytnik kodow")).json()

    response = api_client.get(f"/items/{created['id']}/history")

    assert response.status_code == 200
    history = response.json()
    assert len(history) == 1
    assert history[0]["updated_by"] == SEED_IDS.regular_user
    assert seeded_db.get(Item, created["id"]) is not None
