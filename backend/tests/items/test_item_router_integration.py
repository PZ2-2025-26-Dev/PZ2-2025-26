import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.items.constants import ItemChangeLogType, ItemStatus
from src.items.models import Item, ItemHistory
from src.seed import SEED_IDS, SEED_LAPTOP_OLD_ID, SEED_LAPTOP_PARAMETERS
from tests.helpers import assert_item_created_with_history, get_item_or_fail, make_item_payload

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
        f"/items/{SEED_IDS.laptop_uuid}",
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
    history = response.json()["entries"]
    assert len(history) == 1
    assert history[0]["updated_by"] == SEED_IDS.regular_user
    assert get_item_or_fail(seeded_db, created["id"]) is not None


def test_get_item_endpoint_returns_item_details(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get(f"/items/{SEED_IDS.laptop_uuid}")

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
    response = api_client.get("/items/00000000-0000-0000-0000-000099999999")

    assert response.status_code == 404


def test_delete_item_endpoint_removes_item(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.delete(f"/items/{SEED_IDS.laptop_uuid}")

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
    response = api_client.get(f"/items/{SEED_IDS.laptop_uuid}")

    assert response.status_code == 200

    body = response.json()

    assert isinstance(body["owner"], dict)
    assert isinstance(body["category"], dict)
    assert isinstance(body["location"], dict)


def test_create_item_endpoint_persists_parameters_and_old_id(api_client: TestClient, seeded_db: Session):
    payload = make_item_payload(
        name="Router z parametrami",
        parameters={"ports": 8, "managed": True},
        oldID="LEG-RT-001",
    )

    response = api_client.post("/items", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["parameters"] == payload["parameters"]
    assert body["oldID"] == payload["oldID"]
    assert body["status"] == ItemStatus.AVAILABLE.value

    item = get_item_or_fail(seeded_db, body["id"])
    assert item.parameters == payload["parameters"]
    assert item.oldID == payload["oldID"]


def test_get_item_endpoint_returns_parameters_and_old_id(api_client: TestClient, seeded_db: Session):
    response = api_client.get(f"/items/{SEED_IDS.laptop_uuid}")

    assert response.status_code == 200
    body = response.json()
    assert body["parameters"] == SEED_LAPTOP_PARAMETERS
    assert body["oldID"] == SEED_LAPTOP_OLD_ID
    assert body["status"] == ItemStatus.AVAILABLE.value


def test_update_item_endpoint_updates_parameters(api_client: TestClient, seeded_db: Session):
    new_parameters = {"cpu": "Intel i9", "ram_gb": 32}

    response = api_client.patch(
        f"/items/{SEED_IDS.laptop_uuid}",
        json={"parameters": new_parameters},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["parameters"] == new_parameters

    item = seeded_db.get(Item, SEED_IDS.laptop)
    assert item.parameters == new_parameters


def test_update_item_endpoint_returns_404_for_missing_item(api_client: TestClient):
    response = api_client.patch(
        "/items/00000000-0000-0000-0000-000099999999",
        json={"name": "Nieistniejący"},
    )

    assert response.status_code == 404


def test_delete_item_endpoint_returns_404_for_missing_item(api_client: TestClient):
    response = api_client.delete("/items/00000000-0000-0000-0000-000099999999")

    assert response.status_code == 404


def test_item_history_endpoint_returns_seed_history(api_client: TestClient, seeded_db: Session):
    response = api_client.get(f"/items/{SEED_IDS.laptop_uuid}/history")

    assert response.status_code == 200
    history = response.json()["entries"]
    assert len(history) >= 1
    assert history[0]["change_type"] == ItemChangeLogType.CREATED.value
    assert history[0]["updated_by"] == SEED_IDS.regular_user


def test_item_history_endpoint_returns_404_for_missing_item(api_client: TestClient):
    response = api_client.get("/items/00000000-0000-0000-0000-000099999999/history")

    assert response.status_code == 404


def test_update_item_endpoint_creates_history_on_category_change(api_client: TestClient, seeded_db: Session):
    response = api_client.patch(
        f"/items/{SEED_IDS.laptop_uuid}",
        json={"category_id": SEED_IDS.accessories},
    )

    assert response.status_code == 200

    history = (
        seeded_db.query(ItemHistory)
        .filter_by(item_id=SEED_IDS.laptop, change_type=ItemChangeLogType.CATEGORY_CHANGED)
        .all()
    )
    assert len(history) == 1


def test_read_items_filters_by_category(api_client: TestClient, seeded_db: Session):
    response = api_client.get("/items", params={"category_id": SEED_IDS.computers})

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) >= 1
    assert all(item["category"]["id"] == SEED_IDS.computers for item in body["items"])


def test_read_items_filters_by_location(api_client: TestClient, seeded_db: Session):
    response = api_client.get("/items", params={"location_id": SEED_IDS.cabinet})

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) >= 1
    assert all(item["location"]["id"] == SEED_IDS.cabinet for item in body["items"])


def test_read_items_filters_by_status(api_client: TestClient, seeded_db: Session):
    response = api_client.get("/items", params={"status": ItemStatus.BROKEN.value})

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) >= 1
    assert all(item["status"] == ItemStatus.BROKEN.value for item in body["items"])


def test_read_items_filters_by_description(api_client: TestClient, seeded_db: Session):
    response = api_client.get("/items", params={"description": "projektor"})

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) >= 1
    assert all("projektor" in item["description"].lower() for item in body["items"] if item["description"])


def test_read_items_returns_old_id_in_search_response(api_client: TestClient, seeded_db: Session):
    response = api_client.get("/items", params={"name": "Laptop"})

    assert response.status_code == 200
    body = response.json()
    assert body["items"]
    assert body["items"][0]["oldID"] == SEED_LAPTOP_OLD_ID


def test_read_items_pagination_returns_total(api_client: TestClient, seeded_db: Session):
    response = api_client.get("/items", params={"page": 1, "limit": 2})

    assert response.status_code == 200
    body = response.json()
    assert body["pagination"]["total"] >= len(body["items"])
    assert len(body["items"]) <= 2
