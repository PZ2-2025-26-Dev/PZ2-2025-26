from typing import Any
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.jwt import create_access_token
from src.items.constants import ItemStatus
from src.items.models import Item, ItemHistory
from src.seed import SEED_IDS


def auth_headers(user_id: int = SEED_IDS.regular_user) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def admin_headers() -> dict[str, str]:
    return auth_headers(SEED_IDS.admin_user)

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


def create_item_via_api(
    client: TestClient,
    *,
    user_id: int = SEED_IDS.regular_user,
    **overrides: Any,
) -> dict[str, Any]:
    """Create an item through the API and fail the test if the request is rejected."""
    response = client.post(
        "/items",
        json=make_item_payload(**overrides),
        headers=auth_headers(user_id),
    )
    assert response.status_code == 201, response.text
    return response.json()


def get_item_or_fail(db: Session, item_uuid: UUID | str) -> Item:
    """Fetch an item from the test database by public UUID or fail the test immediately."""
    if isinstance(item_uuid, str):
        item_uuid = UUID(item_uuid)
    item = db.scalar(select(Item).where(Item.uuid == item_uuid))
    assert item is not None
    return item


def assert_item_created_with_history(db: Session, item_uuid: UUID | str) -> Item:
    """Assert that an API-created item exists with the expected creation history."""
    item = get_item_or_fail(db, item_uuid)
    assert item.status == ItemStatus.AVAILABLE

    history = db.query(ItemHistory).filter_by(item_id=item.id).one()
    assert history.updated_by == item.owner_id
    assert history.description == "Item created"

    return item
