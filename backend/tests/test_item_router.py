from unittest.mock import Mock

from fastapi.testclient import TestClient
from datetime import datetime
from src.items.constants import ItemChangeLogType
from src.main import app
from src.items.service import ItemService

client = TestClient(app)

def test_update_item_success(monkeypatch):
    def mock_update_item(self, item_id, data):
        item = Mock()
        item.id = item_id
        item.description = data.description
        return item

    monkeypatch.setattr(
        ItemService,
        "update_item",
        mock_update_item,
    )

    response = client.patch(
        "/items/1",
        json={
            "description": "Nowy opis"
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 1
    assert body["description"] == "Nowy opis"

def test_update_item_not_found(monkeypatch):
    def mock_update_item(self, item_id, data):
        raise ValueError("Item not found")

    monkeypatch.setattr(
        ItemService,
        "update_item",
        mock_update_item,
    )

    response = client.patch(
        "/items/999",
        json={
            "description": "Nowy opis"
        },
    )

    assert response.status_code == 404

def test_get_item_history_success(monkeypatch):
    def mock_get_item_history(self, item_id):
        entry = Mock()
        entry.id = 1
        entry.updated_at = datetime(2024, 1, 1, 12, 0, 0)
        entry.updated_by = 5
        entry.change_type = ItemChangeLogType.CREATED
        entry.description = "Item created"

        return [entry]

    monkeypatch.setattr(
        ItemService,
        "get_item_history",
        mock_get_item_history,
    )

    response = client.get("/items/1/history")

    assert response.status_code == 200

    body = response.json()

    assert len(body) == 1
    assert body[0]["id"] == 1
    assert body[0]["updated_by"] == 5
    assert body[0]["description"] == "Item created"

def test_get_item_history_not_found(monkeypatch):
    def mock_get_item_history(self, item_id):
        raise ValueError("Item not found")

    monkeypatch.setattr(
        ItemService,
        "get_item_history",
        mock_get_item_history,
    )

    response = client.get("/items/99999/history")

    assert response.status_code == 404

    body = response.json()

    assert body["detail"] == "Item not found"