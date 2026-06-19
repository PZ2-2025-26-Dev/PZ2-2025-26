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
    body = response.json()
    item = seeded_db.get(Item, SEED_IDS.laptop)
    assert body["description"] == item.description
    assert body["owner_id"] == item.owner_id
    assert body["category_id"] == item.category_id
    assert body["location_id"] == item.location_id


def test_item_history_endpoint_reads_database_rows(api_client: TestClient, seeded_db: Session):
    created = api_client.post("/items", json=make_item_payload(name="Czytnik kodow")).json()

    response = api_client.get(f"/items/{created['id']}/history")

    assert response.status_code == 200
    history = response.json()
    assert len(history) == 1
    assert history[0]["updated_by"] == SEED_IDS.regular_user
    assert seeded_db.get(Item, created["id"]) is not None


def test_get_item_endpoint_returns_item_details(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get(f"/items/{SEED_IDS.laptop}")

    assert response.status_code == 200

    body = response.json()

    assert body["name"]

    assert body["owner"]["id"]
    assert body["owner"]["name"]

    assert body["category"]["id"]
    assert body["category"]["name"]

    assert body["location"]["id"]
    assert body["location"]["path"]


def test_get_item_endpoint_returns_404_for_missing_item(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get("/items/999999")

    assert response.status_code == 404


def test_delete_item_endpoint_removes_item(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.delete(f"/items/{SEED_IDS.laptop}")

    assert response.status_code == 204

    assert seeded_db.get(Item, SEED_IDS.laptop) is None


def test_read_items_filters_by_owner(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get(
        "/items",
        params={"owner_id": SEED_IDS.regular_user},
    )

    assert response.status_code == 200

    body = response.json()

    assert "items" in body
    assert len(body["items"]) > 0

    item = body["items"][0]

    assert item["owner"]["id"] == SEED_IDS.regular_user


def test_read_items_filters_by_name(
    api_client: TestClient,
):
    response = api_client.get(
        "/items",
        params={"name": "Laptop"},
    )

    assert response.status_code == 200

    body = response.json()

    if body["items"]:
        assert body["items"][0]["name"]
        assert body["items"][0]["owner"]
        assert body["items"][0]["category"]
        assert body["items"][0]["location"]


def test_read_items_supports_pagination(
    api_client: TestClient,
):
    response = api_client.get(
        "/items",
        params={
            "page": 1,
            "limit": 2,
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["pagination"]["page"] == 1
    assert body["pagination"]["limit"] == 2


def test_get_item_returns_nested_objects(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get(f"/items/{SEED_IDS.laptop}")

    assert response.status_code == 200

    body = response.json()

    assert isinstance(body["owner"], dict)
    assert isinstance(body["category"], dict)
    assert isinstance(body["location"], dict)
