from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.items.constants import ItemStatus
from src.items.models import Item, ItemHistory
from src.seed import SEED_IDS

# Valid payload built from deterministic seed records. Tests can override only
# fields relevant to the scenario instead of repeating all foreign keys.
DEFAULT_ITEM_PAYLOAD: dict[str, Any] = {
    "name": "Monitor testowy",
    "category_id": SEED_IDS.electronics,
    "location_id": SEED_IDS.room,
    "owner_id": SEED_IDS.regular_user,
    "description": "Dane tworzone przez test integracyjny",
}


def make_item_payload(**overrides: Any) -> dict[str, Any]:
    """Return a valid item creation payload with optional field overrides."""
    payload = DEFAULT_ITEM_PAYLOAD.copy()
    payload.update(overrides)
    return payload


def create_item_via_api(client: TestClient, **overrides: Any) -> dict[str, Any]:
    """Create an item through the API and fail the test if the request is rejected."""
    response = client.post("/items", json=make_item_payload(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


def get_item_or_fail(db: Session, item_id: int) -> Item:
    """Fetch an item from the test database or fail the test immediately."""
    item = db.get(Item, item_id)
    assert item is not None
    return item


def assert_item_created_with_history(db: Session, item_id: int) -> Item:
    """Assert that an API-created item exists with the expected creation history."""
    item = get_item_or_fail(db, item_id)
    assert item.status == ItemStatus.AVAILABLE

    history = db.query(ItemHistory).filter_by(item_id=item_id).one()
    assert history.updated_by == item.owner_id
    assert history.description == "Item created"

    return item


# Deterministyczna, przyszła data zwrotu używana w testach wypożyczeń.
DEFAULT_DECLARED_RETURN_DATE = "2099-12-31T12:00:00"


def make_guest_payload(**overrides: Any) -> dict[str, Any]:
    """Return a valid guest creation payload with optional field overrides."""
    payload: dict[str, Any] = {
        "first_name": "Gość",
        "last_name": "Testowy",
    }
    payload.update(overrides)
    return payload


def create_guest_via_api(client: TestClient, **overrides: Any) -> dict[str, Any]:
    """Create a guest through the API and fail the test if the request is rejected."""
    response = client.post("/users", json=make_guest_payload(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


def make_loan_payload(item_id: int, borrower_id: int, **overrides: Any) -> dict[str, Any]:
    """Return a valid loan registration payload with optional field overrides."""
    payload: dict[str, Any] = {
        "item_id": item_id,
        "borrower_id": borrower_id,
        "declared_return_date": DEFAULT_DECLARED_RETURN_DATE,
        "loan_purpose": "Prezentacja u podmiotu zewnętrznego",
    }
    payload.update(overrides)
    return payload
