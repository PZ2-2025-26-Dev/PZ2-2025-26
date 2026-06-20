import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.categories.models import Category
from src.items.models import Item
from src.seed import SEED_IDS

pytestmark = pytest.mark.integration


def test_create_category_endpoint_persists_category(api_client: TestClient, seeded_db: Session):
    response = api_client.post(
        "/categories",
        json={"name": "Telefony", "parent_id": SEED_IDS.electronics},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Telefony"
    assert body["parent_id"] == SEED_IDS.electronics
    assert body["path"] == "Elektronika / Telefony"
    assert seeded_db.get(Category, body["id"]) is not None


def test_create_category_endpoint_rejects_duplicate_sibling_name(api_client: TestClient, seeded_db: Session):
    response = api_client.post("/categories", json={"name": "Elektronika"})

    assert response.status_code == 409


def test_update_category_endpoint_updates_live_database(api_client: TestClient, seeded_db: Session):
    response = api_client.put(
        f"/categories/{SEED_IDS.accessories}",
        json={"name": "Akcesoria IT", "parent_id": None},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Akcesoria IT"
    assert body["parent_id"] is None
    assert body["path"] == "Akcesoria IT"
    assert seeded_db.get(Category, SEED_IDS.accessories).name == "Akcesoria IT"


def test_update_category_endpoint_rejects_parent_cycle(api_client: TestClient, seeded_db: Session):
    response = api_client.put(
        f"/categories/{SEED_IDS.electronics}",
        json={"name": "Elektronika", "parent_id": SEED_IDS.computers},
    )

    assert response.status_code == 400


def test_delete_category_endpoint_reassigns_items(api_client: TestClient, seeded_db: Session):
    response = api_client.delete(
        f"/categories/{SEED_IDS.accessories}",
        params={"replacement_category_id": SEED_IDS.electronics},
    )

    assert response.status_code == 200
    assert response.json() == {
        "deleted_category_id": SEED_IDS.accessories,
        "replacement_category_id": SEED_IDS.electronics,
        "moved_items_count": 1,
    }
    assert seeded_db.get(Category, SEED_IDS.accessories) is None
    assert seeded_db.get(Item, SEED_IDS.adapter).category_id == SEED_IDS.electronics


def test_delete_category_endpoint_blocks_category_with_children(api_client: TestClient, seeded_db: Session):
    response = api_client.delete(
        f"/categories/{SEED_IDS.electronics}",
        params={"replacement_category_id": SEED_IDS.computers},
    )

    assert response.status_code == 409


def test_read_categories_endpoint_returns_paged_categories(api_client: TestClient, seeded_db: Session):
    response = api_client.get("/categories", params={"page": 1, "limit": 2})

    assert response.status_code == 200
    body = response.json()
    assert body["pagination"]["page"] == 1
    assert body["pagination"]["limit"] == 2
    assert body["pagination"]["total"] >= 3
    assert len(body["categories"]) == 2


def test_read_category_items_endpoint_returns_direct_category_items(api_client: TestClient, seeded_db: Session):
    response = api_client.get(f"/categories/{SEED_IDS.electronics}/items")

    assert response.status_code == 200
    body = response.json()
    assert body["pagination"]["total"] == 1
    assert [item["name"] for item in body["items"]] == ["Projektor"]


def test_read_category_items_count_endpoint_returns_direct_count(api_client: TestClient, seeded_db: Session):
    response = api_client.get(f"/categories/{SEED_IDS.electronics}/items/count")

    assert response.status_code == 200
    assert response.json() == {"category_id": SEED_IDS.electronics, "count": 1}


def test_read_category_items_count_endpoint_returns_404_for_missing_category(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get("/categories/999999/items/count")

    assert response.status_code == 404


def test_categories_openapi_contains_public_category_paths(api_client: TestClient, seeded_db: Session):
    response = api_client.get("/openapi.json")

    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/categories" in paths
    assert "/categories/{category_id}" in paths
    assert "/categories/{category_id}/items" in paths
    assert "/categories/{category_id}/items/count" in paths
