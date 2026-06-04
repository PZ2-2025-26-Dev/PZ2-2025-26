from unittest.mock import Mock

from fastapi.testclient import TestClient

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