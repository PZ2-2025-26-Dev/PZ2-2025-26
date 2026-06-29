import re
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.auth.constants import UserRole, UserStatus
from src.items.constants import BASIC_LENGTH, ItemChangeLogType, ItemPermissionType, ItemStatus
from src.items.models import Item, ItemACL, ItemHistory
from src.seed import SEED_IDS, SEED_LAPTOP_OLD_ID, SEED_LAPTOP_PARAMETERS
from src.users.models import User
from tests.helpers import (
    admin_headers,
    assert_item_created_with_history,
    auth_headers,
    get_item_or_fail,
    make_item_payload,
)

pytestmark = pytest.mark.integration


def _create_delegate_user(db: Session) -> User:
    user = User(
        email="delegate.acl@test.example",
        first_name="Delegat",
        last_name="ACL",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.flush()
    return user


def test_create_item_endpoint_persists_item_and_history(api_client: TestClient, seeded_db: Session):
    payload = make_item_payload(name="Kamera dokumentacyjna")

    response = api_client.post("/items", json=payload, headers=auth_headers())

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
        json={"name": "Laptop zaktualizowany przez API"},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    item = seeded_db.get(Item, SEED_IDS.laptop)
    assert body["name"] == item.name
    assert body["owner_id"] == item.owner_id
    assert body["category_id"] == item.category_id
    assert body["location_id"] == item.location_id


def test_item_history_endpoint_reads_database_rows(api_client: TestClient, seeded_db: Session):
    created = api_client.post(
        "/items",
        json=make_item_payload(name="Czytnik kodow"),
        headers=auth_headers(),
    ).json()

    response = api_client.get(f"/items/{created['id']}/history", headers=auth_headers())

    assert response.status_code == 200
    history = response.json()["entries"]
    assert len(history) == 1
    assert history[0]["updated_by"] == SEED_IDS.regular_user
    assert response.json()["pagination"] == {"page": 1, "limit": 10, "total": 1}
    assert get_item_or_fail(seeded_db, created["id"]) is not None


def test_get_item_endpoint_returns_item_details(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get(f"/items/{SEED_IDS.laptop_uuid}", headers=auth_headers(SEED_IDS.observer_user))

    assert response.status_code == 200

    body = response.json()

    assert body["name"]

    assert body["owner"]["id"]
    assert body["owner"]["name"]

    assert body["category"]["id"]
    assert body["category"]["name"]

    assert body["location"]["id"]
    assert body["location"]["path"]


def test_scan_item_endpoint_returns_item(
    api_client: TestClient,
    seeded_db: Session,
):
    created = api_client.post(
        "/items",
        json=make_item_payload(name="Czytnik QR"),
        headers=auth_headers(),
    ).json()

    response = api_client.get(f"/items/scan/{created['id']}", headers=auth_headers())

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == created["id"]
    assert body["name"] == created["name"]


def test_scan_item_endpoint_returns_seed_item_by_uuid(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get(f"/items/scan/{SEED_IDS.laptop_uuid}", headers=auth_headers())

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(SEED_IDS.laptop_uuid)
    assert body["name"] == "Laptop developerski"


def test_scan_item_endpoint_returns_seed_item_by_legacy_old_id(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get(f"/items/scan/{SEED_LAPTOP_OLD_ID}", headers=auth_headers())

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(SEED_IDS.laptop_uuid)
    assert body["oldID"] == SEED_LAPTOP_OLD_ID


def test_scan_item_endpoint_returns_400_for_invalid_code(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get("/items/scan/%20", headers=auth_headers())

    assert response.status_code == 400
    assert response.json() == {"code": 400, "detail": "Invalid QR code"}


def test_scan_item_endpoint_returns_400_for_non_canonical_uuid(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get(
        "/items/scan/00000000000000000000000000040001",
        headers=auth_headers(),
    )

    assert response.status_code == 400
    assert response.json() == {"code": 400, "detail": "Invalid QR code"}


def test_scan_item_endpoint_returns_404_for_missing_item(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get(
        "/items/scan/018f6f23-5b56-7b88-9ac1-5a02c63c5c11",
        headers=auth_headers(),
    )

    assert response.status_code == 404
    assert response.json() == {"code": 404, "detail": "Item not found"}


def test_scan_item_endpoint_returns_404_for_missing_legacy_old_id(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get("/items/scan/LEG-MISSING-001", headers=auth_headers())

    assert response.status_code == 404
    assert response.json() == {"code": 404, "detail": "Item not found"}


def test_scan_item_endpoint_returns_400_for_code_exceeding_length_limit(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get(
        f"/items/scan/{'A' * (BASIC_LENGTH + 1)}",
        headers=auth_headers(),
    )

    assert response.status_code == 400
    assert response.json() == {"code": 400, "detail": "Invalid QR code"}


def test_download_item_qr_png_endpoint_returns_png(
    api_client: TestClient,
    seeded_db: Session,
):
    created = api_client.post(
        "/items",
        json=make_item_payload(name="Terminal mobilny"),
        headers=auth_headers(),
    ).json()

    response = api_client.get(f"/items/{created['id']}/qr.png", headers=auth_headers())

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content.startswith(b"\x89PNG")


def test_download_item_qr_pdf_endpoint_returns_pdf(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get(
        f"/items/{SEED_IDS.laptop_uuid}/qr.pdf",
        headers=auth_headers(),
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


@pytest.mark.parametrize(
    ("method", "path_suffix"),
    [
        ("GET", "qr.png"),
        ("GET", "qr.pdf"),
        ("POST", "label.pdf"),
        ("POST", "label.png"),
    ],
)
def test_item_asset_endpoints_allow_admin(
    api_client: TestClient,
    seeded_db: Session,
    method: str,
    path_suffix: str,
):
    response = api_client.request(
        method,
        f"/items/{SEED_IDS.laptop_uuid}/{path_suffix}",
        headers=admin_headers(),
        json={"fields": []},
    )

    assert response.status_code == 200


@pytest.mark.parametrize(
    ("method", "path_suffix"),
    [
        ("GET", "qr.png"),
        ("GET", "qr.pdf"),
        ("POST", "label.pdf"),
        ("POST", "label.png"),
    ],
)
def test_item_asset_endpoints_reject_non_owner(
    api_client: TestClient,
    seeded_db: Session,
    method: str,
    path_suffix: str,
):
    response = api_client.request(
        method,
        f"/items/{SEED_IDS.projector_uuid}/{path_suffix}",
        headers=auth_headers(),
        json={"fields": []},
    )

    assert response.status_code == 403


def test_item_asset_endpoint_requires_authentication(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get(f"/items/{SEED_IDS.laptop_uuid}/qr.png")

    assert response.status_code == 401


def test_download_item_label_pdf_endpoint_returns_pdf(
    api_client: TestClient,
    seeded_db: Session,
):
    created = api_client.post(
        "/items",
        json=make_item_payload(name="Projektor mobilny"),
        headers=auth_headers(),
    ).json()

    response = api_client.post(
        f"/items/{created['id']}/label.pdf",
        json={"fields": ["name", "category", "location"]},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_download_item_label_png_endpoint_returns_png(
    api_client: TestClient,
    seeded_db: Session,
):
    created = api_client.post(
        "/items",
        json=make_item_payload(name="Adapter HDMI"),
        headers=auth_headers(),
    ).json()

    response = api_client.post(
        f"/items/{created['id']}/label.png",
        json={"fields": ["status", "description"]},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content.startswith(b"\x89PNG")


def test_download_item_label_endpoint_accepts_empty_fields(
    api_client: TestClient,
    seeded_db: Session,
):
    created = api_client.post(
        "/items",
        json=make_item_payload(name="Statyw"),
        headers=auth_headers(),
    ).json()

    response = api_client.post(
        f"/items/{created['id']}/label.png",
        json={"fields": []},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"


def test_download_item_label_pdf_endpoint_accepts_missing_body(
    api_client: TestClient,
    seeded_db: Session,
):
    created = api_client.post(
        "/items",
        json=make_item_payload(name="Etykieta bez konfiguracji"),
        headers=auth_headers(),
    ).json()

    response = api_client.post(f"/items/{created['id']}/label.pdf", headers=auth_headers())

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_download_item_label_png_endpoint_accepts_missing_body(
    api_client: TestClient,
    seeded_db: Session,
):
    created = api_client.post(
        "/items",
        json=make_item_payload(name="PNG bez konfiguracji"),
        headers=auth_headers(),
    ).json()

    response = api_client.post(f"/items/{created['id']}/label.png", headers=auth_headers())

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content.startswith(b"\x89PNG")


def test_download_item_label_endpoint_supports_parameters_fields(
    api_client: TestClient,
    seeded_db: Session,
):
    created = api_client.post(
        "/items",
        json=make_item_payload(name="Router", parameters={"serial_number": "SN-123"}),
        headers=auth_headers(),
    ).json()

    response = api_client.post(
        f"/items/{created['id']}/label.png",
        json={"fields": ["parameters.serial_number"]},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"


def test_download_item_label_endpoint_supports_nested_parameters_fields(
    api_client: TestClient,
    seeded_db: Session,
):
    created = api_client.post(
        "/items",
        json=make_item_payload(
            name="Serwer",
            parameters={
                "hardware": {"cpu": "AMD EPYC", "ram": {"size_gb": 128}},
                "interfaces": [{"mac": "00:11:22:33:44:55"}],
            },
        ),
        headers=auth_headers(),
    ).json()

    response = api_client.post(
        f"/items/{created['id']}/label.png",
        json={
            "fields": [
                "parameters.hardware.cpu",
                "parameters.hardware.ram.size_gb",
                "parameters.interfaces.0.mac",
            ]
        },
        headers=auth_headers(),
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"


def test_download_item_label_endpoint_returns_400_for_missing_nested_parameter(
    api_client: TestClient,
    seeded_db: Session,
):
    created = api_client.post(
        "/items",
        json=make_item_payload(name="Serwer", parameters={"hardware": {"cpu": "AMD EPYC"}}),
        headers=auth_headers(),
    ).json()

    response = api_client.post(
        f"/items/{created['id']}/label.png",
        json={"fields": ["parameters.hardware.gpu"]},
        headers=auth_headers(),
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": 400,
        "detail": "Unsupported label parameter: hardware.gpu",
    }


def test_download_item_label_endpoint_returns_400_for_missing_parameter_key(
    api_client: TestClient,
    seeded_db: Session,
):
    created = api_client.post(
        "/items",
        json=make_item_payload(name="Router", parameters={"serial_number": "SN-123"}),
        headers=auth_headers(),
    ).json()

    response = api_client.post(
        f"/items/{created['id']}/label.png",
        json={"fields": ["parameters.asset_tag"]},
        headers=auth_headers(),
    )

    assert response.status_code == 400
    assert response.json() == {"code": 400, "detail": "Unsupported label parameter: asset_tag"}


def test_download_item_label_endpoint_returns_400_for_parameter_field_without_parameters(
    api_client: TestClient,
    seeded_db: Session,
):
    created = api_client.post(
        "/items",
        json=make_item_payload(name="Router bez parametrów"),
        headers=auth_headers(),
    ).json()

    response = api_client.post(
        f"/items/{created['id']}/label.png",
        json={"fields": ["parameters.serial_number"]},
        headers=auth_headers(),
    )

    assert response.status_code == 400
    assert response.json() == {"code": 400, "detail": "Unsupported label parameter: serial_number"}


def test_download_item_label_pdf_endpoint_uses_requested_size(
    api_client: TestClient,
    seeded_db: Session,
):
    created = api_client.post(
        "/items",
        json=make_item_payload(name="Etykieta PDF"),
        headers=auth_headers(),
    ).json()

    response = api_client.post(
        f"/items/{created['id']}/label.pdf",
        json={"fields": ["name"], "width_mm": 50, "height_mm": 25},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    pdf_text = response.content.decode("latin-1")
    media_box = re.search(r"/MediaBox \[ 0 0 ([0-9.]+) ([0-9.]+) \]", pdf_text)
    assert media_box is not None
    assert round(float(media_box.group(1)), 1) == 141.7
    assert round(float(media_box.group(2)), 1) == 70.9


def test_download_item_label_png_endpoint_uses_requested_size(
    api_client: TestClient,
    seeded_db: Session,
):
    created = api_client.post(
        "/items",
        json=make_item_payload(name="Etykieta PNG"),
        headers=auth_headers(),
    ).json()

    response = api_client.post(
        f"/items/{created['id']}/label.png",
        json={"fields": ["name"], "width_mm": 50, "height_mm": 25},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    image = Image.open(BytesIO(response.content))
    assert image.size == (591, 295)


def test_download_item_label_png_endpoint_handles_minimum_size(
    api_client: TestClient,
    seeded_db: Session,
):
    created = api_client.post(
        "/items",
        json=make_item_payload(name="Minimalna etykieta"),
        headers=auth_headers(),
    ).json()

    response = api_client.post(
        f"/items/{created['id']}/label.png",
        json={"fields": [], "width_mm": 20, "height_mm": 10},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    image = Image.open(BytesIO(response.content))
    assert image.size == (236, 118)


def test_download_item_label_png_endpoint_handles_maximum_size(
    api_client: TestClient,
    seeded_db: Session,
):
    created = api_client.post(
        "/items",
        json=make_item_payload(name="Maksymalna etykieta"),
        headers=auth_headers(),
    ).json()

    response = api_client.post(
        f"/items/{created['id']}/label.png",
        json={"fields": ["name", "category", "location", "owner"], "width_mm": 200, "height_mm": 150},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    image = Image.open(BytesIO(response.content))
    assert image.size == (2362, 1772)


def test_download_item_label_endpoint_returns_error_response_for_missing_item(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.post(
        "/items/00000000-0000-0000-0000-000099999999/label.pdf",
        json={"fields": ["name"]},
        headers=auth_headers(),
    )

    assert response.status_code == 404
    assert response.json() == {"code": 404, "detail": "Item not found"}


def test_download_item_label_endpoint_returns_error_response_for_unknown_field(
    api_client: TestClient,
    seeded_db: Session,
):
    created = api_client.post(
        "/items",
        json=make_item_payload(name="Nieznane pole"),
        headers=auth_headers(),
    ).json()

    response = api_client.post(
        f"/items/{created['id']}/label.png",
        json={"fields": ["unknown"]},
        headers=auth_headers(),
    )

    assert response.status_code == 400
    assert response.json() == {"code": 400, "detail": "Unsupported label field: unknown"}


def test_get_item_endpoint_returns_404_for_missing_item(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get(
        "/items/00000000-0000-0000-0000-000099999999",
        headers=auth_headers(),
    )

    assert response.status_code == 404


def test_delete_item_endpoint_removes_item(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.delete(
        f"/items/{SEED_IDS.laptop_uuid}",
        headers=admin_headers(),
    )

    assert response.status_code == 204

    assert seeded_db.get(Item, SEED_IDS.laptop) is None


def test_read_items_filters_by_owner(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get(
        "/items",
        params={"owner_id": SEED_IDS.regular_user},
        headers=auth_headers(SEED_IDS.observer_user),
    )

    print("\nSTATUS:", response.status_code)
    print("\nRAW BODY:", response.text)

    assert response.status_code == 200

    body = response.json()

    print("\nPARSED BODY:", body)
    print("\nOWNERS IN RESPONSE:", [item.get("owner", {}).get("id") for item in body.get("items", [])])

    assert "items" in body
    assert len(body["items"]) > 0

    item = body["items"][0]

    print("\nFIRST ITEM OWNER:", item.get("owner"))

    assert item["owner"]["id"] == SEED_IDS.regular_user


def test_read_items_filters_by_name(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get(
        "/items",
        params={"name": "Laptop"},
        headers=auth_headers(),
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
    seeded_db: Session,
):
    response = api_client.get(
        "/items",
        params={
            "page": 1,
            "limit": 2,
        },
        headers=auth_headers(),
    )

    assert response.status_code == 200

    body = response.json()

    assert body["pagination"]["page"] == 1
    assert body["pagination"]["limit"] == 2


def test_get_item_returns_nested_objects(
    api_client: TestClient,
    seeded_db: Session,
):
    response = api_client.get(f"/items/{SEED_IDS.laptop_uuid}", headers=auth_headers(SEED_IDS.observer_user))

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

    response = api_client.post("/items", json=payload, headers=auth_headers())

    assert response.status_code == 201
    body = response.json()
    assert body["parameters"] == payload["parameters"]
    assert body["oldID"] == payload["oldID"]
    assert body["status"] == ItemStatus.AVAILABLE.value

    item = get_item_or_fail(seeded_db, body["id"])
    assert item.parameters == payload["parameters"]
    assert item.oldID == payload["oldID"]


def test_get_item_endpoint_returns_parameters_and_old_id(api_client: TestClient, seeded_db: Session):
    response = api_client.get(f"/items/{SEED_IDS.laptop_uuid}", headers=auth_headers(SEED_IDS.observer_user))

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
        headers=auth_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["parameters"] == new_parameters

    item = seeded_db.get(Item, SEED_IDS.laptop)
    assert item.parameters == new_parameters


def test_update_item_endpoint_returns_404_for_missing_item(api_client: TestClient, seeded_db: Session):
    response = api_client.patch(
        "/items/00000000-0000-0000-0000-000099999999",
        json={"name": "Nieistniejący"},
        headers=auth_headers(),
    )

    assert response.status_code == 404


def test_delete_item_endpoint_returns_404_for_missing_item(api_client: TestClient, seeded_db: Session):
    response = api_client.delete(
        "/items/00000000-0000-0000-0000-000099999999",
        headers=admin_headers(),
    )

    assert response.status_code == 404


def test_item_history_endpoint_returns_seed_history(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        f"/items/{SEED_IDS.laptop_uuid}/history",
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["entries"]) == 10
    assert body["entries"][0]["change_type"] == ItemChangeLogType.LOANED.value
    assert body["entries"][0]["updated_by"] == SEED_IDS.regular_user
    assert body["pagination"]["total"] == 12


def test_item_history_endpoint_allows_admin(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        f"/items/{SEED_IDS.laptop_uuid}/history",
        headers=admin_headers(),
    )

    assert response.status_code == 200


def test_item_history_endpoint_rejects_non_owner(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        f"/items/{SEED_IDS.projector_uuid}/history",
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 403


def test_item_history_endpoint_rejects_observer(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        f"/items/{SEED_IDS.laptop_uuid}/history",
        headers=auth_headers(SEED_IDS.observer_user),
    )

    assert response.status_code == 403


def test_item_history_endpoint_supports_pagination_and_type_filter(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        f"/items/{SEED_IDS.laptop_uuid}/history",
        params={"type": ItemChangeLogType.CREATED.value, "page": 1, "limit": 1},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["entries"]) == 1
    assert body["entries"][0]["change_type"] == ItemChangeLogType.CREATED.value
    assert body["pagination"] == {"page": 1, "limit": 1, "total": 1}


def test_item_history_endpoint_returns_404_for_missing_item(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        "/items/00000000-0000-0000-0000-000099999999/history",
        headers=auth_headers(),
    )

    assert response.status_code == 404


def test_update_item_endpoint_creates_history_on_category_change(api_client: TestClient, seeded_db: Session):
    history_count = seeded_db.scalar(
        select(func.count(ItemHistory.id)).where(
            ItemHistory.item_id == SEED_IDS.laptop,
            ItemHistory.change_type == ItemChangeLogType.CATEGORY_CHANGED,
        )
    )

    response = api_client.patch(
        f"/items/{SEED_IDS.laptop_uuid}",
        json={"category_id": SEED_IDS.accessories},
        headers=admin_headers(),
    )

    assert response.status_code == 200

    updated_history_count = seeded_db.scalar(
        select(func.count(ItemHistory.id)).where(
            ItemHistory.item_id == SEED_IDS.laptop,
            ItemHistory.change_type == ItemChangeLogType.CATEGORY_CHANGED,
        )
    )
    assert updated_history_count == history_count + 1


def test_read_items_filters_by_category(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        "/items",
        params={"category_id": SEED_IDS.computers},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) >= 1
    assert all(item["category"]["id"] == SEED_IDS.computers for item in body["items"])


def test_read_items_filters_by_location(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        "/items",
        params={"location_id": SEED_IDS.cabinet},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) >= 1
    assert all(item["location"]["id"] == SEED_IDS.cabinet for item in body["items"])


def test_read_items_filters_by_status(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        "/items",
        params={"status": ItemStatus.BROKEN.value},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) >= 1
    assert all(item["status"] == ItemStatus.BROKEN.value for item in body["items"])


def test_read_items_filters_by_description(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        "/items",
        params={"description": "projektor"},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) >= 1
    assert all("projektor" in item["description"].lower() for item in body["items"] if item["description"])


def test_read_items_returns_old_id_in_search_response(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        "/items",
        params={"name": "Laptop"},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["items"]
    assert body["items"][0]["oldID"] == SEED_LAPTOP_OLD_ID


def test_read_items_pagination_returns_total(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        "/items",
        params={"page": 1, "limit": 2},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["pagination"]["total"] >= len(body["items"])
    assert len(body["items"]) <= 2


def test_create_item_endpoint_requires_authentication(api_client: TestClient):
    response = api_client.post("/items", json=make_item_payload())

    assert response.status_code == 401


def test_observer_cannot_create_item(api_client: TestClient, seeded_db: Session):
    response = api_client.post(
        "/items",
        json=make_item_payload(),
        headers=auth_headers(SEED_IDS.observer_user),
    )

    assert response.status_code == 403


def test_observer_cannot_update_item(api_client: TestClient, seeded_db: Session):
    response = api_client.patch(
        f"/items/{SEED_IDS.laptop_uuid}",
        json={"description": "Próba edycji przez obserwatora"},
        headers=auth_headers(SEED_IDS.observer_user),
    )

    assert response.status_code == 403


def test_observer_cannot_delete_item(api_client: TestClient, seeded_db: Session):
    response = api_client.delete(
        f"/items/{SEED_IDS.laptop_uuid}",
        headers=auth_headers(SEED_IDS.observer_user),
    )

    assert response.status_code == 403


def test_user_cannot_modify_item_owned_by_someone_else(api_client: TestClient, seeded_db: Session):
    response = api_client.patch(
        f"/items/{SEED_IDS.projector_uuid}",
        json={"description": "Próba edycji cudzego sprzętu"},
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 403


def test_user_can_delete_own_item(api_client: TestClient, seeded_db: Session):
    response = api_client.delete(
        f"/items/{SEED_IDS.adapter_uuid}",
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 204
    assert seeded_db.get(Item, SEED_IDS.adapter) is None


def test_user_cannot_delete_item_owned_by_someone_else(api_client: TestClient, seeded_db: Session):
    response = api_client.delete(
        f"/items/{SEED_IDS.projector_uuid}",
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 403


def test_owner_can_update_name_location_parameters(api_client: TestClient, seeded_db: Session):
    new_parameters = {"cpu": "Intel i9", "ram_gb": 32}

    response = api_client.patch(
        f"/items/{SEED_IDS.laptop_uuid}",
        json={
            "name": "Laptop zaktualizowany",
            "location_id": SEED_IDS.room,
            "parameters": new_parameters,
        },
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Laptop zaktualizowany"
    assert body["location_id"] == SEED_IDS.room
    assert body["parameters"] == new_parameters

    item = seeded_db.get(Item, SEED_IDS.laptop)
    assert item.name == "Laptop zaktualizowany"
    assert item.location_id == SEED_IDS.room
    assert item.parameters == new_parameters


def test_owner_cannot_update_description_or_category(api_client: TestClient, seeded_db: Session):
    response = api_client.patch(
        f"/items/{SEED_IDS.laptop_uuid}",
        json={"description": "Nowy opis właściciela"},
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 403

    response = api_client.patch(
        f"/items/{SEED_IDS.laptop_uuid}",
        json={"category_id": SEED_IDS.accessories},
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 403


def test_user_cannot_create_item_for_another_owner(api_client: TestClient, seeded_db: Session):
    response = api_client.post(
        "/items",
        json=make_item_payload(owner_id=SEED_IDS.admin_user),
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 403


def test_user_cannot_change_item_owner(api_client: TestClient, seeded_db: Session):
    response = api_client.patch(
        f"/items/{SEED_IDS.laptop_uuid}",
        json={"owner_id": SEED_IDS.admin_user},
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 403


def test_admin_can_change_item_owner(api_client: TestClient, seeded_db: Session):
    response = api_client.patch(
        f"/items/{SEED_IDS.laptop_uuid}",
        json={"owner_id": SEED_IDS.admin_user},
        headers=admin_headers(),
    )

    assert response.status_code == 200
    assert response.json()["owner_id"] == SEED_IDS.admin_user
    assert seeded_db.get(Item, SEED_IDS.laptop).owner_id == SEED_IDS.admin_user


def test_admin_can_modify_any_item(api_client: TestClient, seeded_db: Session):
    response = api_client.patch(
        f"/items/{SEED_IDS.projector_uuid}",
        json={"description": "Opis zmieniony przez administratora"},
        headers=admin_headers(),
    )

    assert response.status_code == 200
    assert seeded_db.get(Item, SEED_IDS.projector).description == "Opis zmieniony przez administratora"


def test_admin_can_create_item_for_any_owner(api_client: TestClient, seeded_db: Session):
    response = api_client.post(
        "/items",
        json=make_item_payload(name="Sprzęt przypisany przez admina", owner_id=SEED_IDS.observer_user),
        headers=admin_headers(),
    )

    assert response.status_code == 201
    item = get_item_or_fail(seeded_db, response.json()["id"])
    assert item.owner_id == SEED_IDS.observer_user


def test_user_with_edit_location_permission_can_update_location(api_client: TestClient, seeded_db: Session):
    seeded_db.add(
        ItemACL(
            item_id=SEED_IDS.projector,
            user_id=SEED_IDS.regular_user,
            permission=ItemPermissionType.EDIT_LOCATION,
        )
    )
    seeded_db.flush()

    response = api_client.patch(
        f"/items/{SEED_IDS.projector_uuid}",
        json={"location_id": SEED_IDS.cabinet},
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 200
    assert response.json()["location_id"] == SEED_IDS.cabinet
    assert seeded_db.get(Item, SEED_IDS.projector).location_id == SEED_IDS.cabinet


def test_user_with_edit_location_permission_cannot_update_other_fields(api_client: TestClient, seeded_db: Session):
    seeded_db.add(
        ItemACL(
            item_id=SEED_IDS.projector,
            user_id=SEED_IDS.regular_user,
            permission=ItemPermissionType.EDIT_LOCATION,
        )
    )
    seeded_db.flush()

    response = api_client.patch(
        f"/items/{SEED_IDS.projector_uuid}",
        json={"description": "Próba edycji bez uprawnień właściciela"},
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 403


def test_user_with_edit_description_permission_can_update_description(api_client: TestClient, seeded_db: Session):
    seeded_db.add(
        ItemACL(
            item_id=SEED_IDS.projector,
            user_id=SEED_IDS.regular_user,
            permission=ItemPermissionType.EDIT_DESCRIPTION,
        )
    )
    seeded_db.flush()

    response = api_client.patch(
        f"/items/{SEED_IDS.projector_uuid}",
        json={"description": "Opis zmieniony przez delegata"},
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 200
    assert response.json()["description"] == "Opis zmieniony przez delegata"
    assert seeded_db.get(Item, SEED_IDS.projector).description == "Opis zmieniony przez delegata"


def test_user_with_edit_description_permission_cannot_update_location(api_client: TestClient, seeded_db: Session):
    seeded_db.add(
        ItemACL(
            item_id=SEED_IDS.projector,
            user_id=SEED_IDS.regular_user,
            permission=ItemPermissionType.EDIT_DESCRIPTION,
        )
    )
    seeded_db.flush()

    response = api_client.patch(
        f"/items/{SEED_IDS.projector_uuid}",
        json={"location_id": SEED_IDS.cabinet},
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 403


def test_user_with_edit_parameters_permission_can_update_parameters(api_client: TestClient, seeded_db: Session):
    new_parameters = {"lumens": 4000, "resolution": "1920x1080"}

    seeded_db.add(
        ItemACL(
            item_id=SEED_IDS.projector,
            user_id=SEED_IDS.regular_user,
            permission=ItemPermissionType.EDIT_PARAMETERS,
        )
    )
    seeded_db.flush()

    response = api_client.patch(
        f"/items/{SEED_IDS.projector_uuid}",
        json={"parameters": new_parameters},
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 200
    assert response.json()["parameters"] == new_parameters
    assert seeded_db.get(Item, SEED_IDS.projector).parameters == new_parameters


def test_user_with_edit_parameters_permission_cannot_update_description(api_client: TestClient, seeded_db: Session):
    seeded_db.add(
        ItemACL(
            item_id=SEED_IDS.projector,
            user_id=SEED_IDS.regular_user,
            permission=ItemPermissionType.EDIT_PARAMETERS,
        )
    )
    seeded_db.flush()

    response = api_client.patch(
        f"/items/{SEED_IDS.projector_uuid}",
        json={"description": "Próba edycji opisu bez uprawnień"},
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 403


def test_delegated_user_cannot_update_critical_fields(api_client: TestClient, seeded_db: Session):
    seeded_db.add(
        ItemACL(
            item_id=SEED_IDS.projector,
            user_id=SEED_IDS.regular_user,
            permission=ItemPermissionType.EDIT_DESCRIPTION,
        )
    )
    seeded_db.flush()

    response = api_client.patch(
        f"/items/{SEED_IDS.projector_uuid}",
        json={"name": "Zmieniona nazwa projektora"},
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 403


def test_owner_can_update_item_name(api_client: TestClient, seeded_db: Session):
    response = api_client.patch(
        f"/items/{SEED_IDS.laptop_uuid}",
        json={"name": "Laptop po aktualizacji nazwy"},
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Laptop po aktualizacji nazwy"
    assert seeded_db.get(Item, SEED_IDS.laptop).name == "Laptop po aktualizacji nazwy"


def test_owner_can_list_item_acl(api_client: TestClient, seeded_db: Session):
    delegate = _create_delegate_user(seeded_db)
    seeded_db.add(
        ItemACL(
            item_id=SEED_IDS.laptop,
            user_id=delegate.id,
            permission=ItemPermissionType.EDIT_DESCRIPTION,
        )
    )
    seeded_db.flush()

    response = api_client.get(
        f"/items/{SEED_IDS.laptop_uuid}/acl",
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["entries"]) == 1
    assert body["entries"][0]["permission"] == ItemPermissionType.EDIT_DESCRIPTION.value


def test_owner_can_grant_item_acl(api_client: TestClient, seeded_db: Session):
    delegate = _create_delegate_user(seeded_db)

    response = api_client.post(
        f"/items/{SEED_IDS.laptop_uuid}/acl",
        json={
            "user_id": delegate.id,
            "permission": ItemPermissionType.EDIT_LOCATION.value,
        },
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["user_id"] == delegate.id
    assert body["permission"] == ItemPermissionType.EDIT_LOCATION.value


def test_owner_can_revoke_item_acl(api_client: TestClient, seeded_db: Session):
    delegate = _create_delegate_user(seeded_db)
    acl = ItemACL(
        item_id=SEED_IDS.laptop,
        user_id=delegate.id,
        permission=ItemPermissionType.EDIT_PARAMETERS,
    )
    seeded_db.add(acl)
    seeded_db.flush()

    response = api_client.delete(
        f"/items/{SEED_IDS.laptop_uuid}/acl/{acl.id}",
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 204
    assert seeded_db.execute(select(ItemACL).where(ItemACL.id == acl.id)).scalar_one_or_none() is None


def test_cannot_grant_item_acl_to_observer(api_client: TestClient, seeded_db: Session):
    response = api_client.post(
        f"/items/{SEED_IDS.laptop_uuid}/acl",
        json={
            "user_id": SEED_IDS.observer_user,
            "permission": ItemPermissionType.EDIT_LOCATION.value,
        },
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 400


def test_non_owner_cannot_grant_item_acl(api_client: TestClient, seeded_db: Session):
    response = api_client.post(
        f"/items/{SEED_IDS.projector_uuid}/acl",
        json={
            "user_id": SEED_IDS.regular_user,
            "permission": ItemPermissionType.EDIT_DESCRIPTION.value,
        },
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 403


def test_delegated_user_sees_only_own_acl_entries(api_client: TestClient, seeded_db: Session):
    delegate = _create_delegate_user(seeded_db)
    seeded_db.add_all(
        [
            ItemACL(
                item_id=SEED_IDS.projector,
                user_id=delegate.id,
                permission=ItemPermissionType.EDIT_DESCRIPTION,
            ),
            ItemACL(
                item_id=SEED_IDS.projector,
                user_id=SEED_IDS.admin_user,
                permission=ItemPermissionType.EDIT_LOCATION,
            ),
        ]
    )
    seeded_db.flush()

    response = api_client.get(
        f"/items/{SEED_IDS.projector_uuid}/acl",
        headers=auth_headers(delegate.id),
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["entries"]) == 1
    assert body["entries"][0]["user_id"] == delegate.id
    assert body["entries"][0]["permission"] == ItemPermissionType.EDIT_DESCRIPTION.value


def test_grant_duplicate_item_acl_returns_400(api_client: TestClient, seeded_db: Session):
    delegate = _create_delegate_user(seeded_db)
    seeded_db.add(
        ItemACL(
            item_id=SEED_IDS.laptop,
            user_id=delegate.id,
            permission=ItemPermissionType.AUTO_APPROVED_LOAN,
        )
    )
    seeded_db.flush()

    response = api_client.post(
        f"/items/{SEED_IDS.laptop_uuid}/acl",
        json={
            "user_id": delegate.id,
            "permission": ItemPermissionType.AUTO_APPROVED_LOAN.value,
        },
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 400
