import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.seed import SEED_IDS
from tests.helpers import admin_headers, auth_headers

pytestmark = pytest.mark.integration


def test_export_items_xlsx_allows_regular_user(api_client: TestClient, seeded_db: Session):
    response = api_client.get("/exports/items/xlsx", headers=auth_headers(SEED_IDS.regular_user))

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def test_export_items_xlsx_allows_admin(api_client: TestClient, seeded_db: Session):
    response = api_client.get("/exports/items/xlsx", headers=admin_headers())

    assert response.status_code == 200


def test_export_items_xlsx_rejects_observer(api_client: TestClient, seeded_db: Session):
    response = api_client.get("/exports/items/xlsx", headers=auth_headers(SEED_IDS.observer_user))

    assert response.status_code == 403


def test_export_items_xlsx_requires_authentication(api_client: TestClient, seeded_db: Session):
    response = api_client.get("/exports/items/xlsx")

    assert response.status_code == 401
