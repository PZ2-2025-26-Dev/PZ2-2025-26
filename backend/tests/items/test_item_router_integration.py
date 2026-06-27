import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.constants import UserRole, UserStatus
from src.items.constants import ItemChangeLogType, ItemPermissionType, ItemStatus
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
        json={"description": "Opis zmieniony przez API"},
        headers=auth_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    item = seeded_db.get(Item, SEED_IDS.laptop)
    assert body["description"] == item.description
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

    assert response.status_code == 200

    body = response.json()

    assert "items" in body
    assert len(body["items"]) > 0

    item = body["items"][0]

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
        headers=auth_headers(SEED_IDS.observer_user),
    )

    assert response.status_code == 200
    history = response.json()["entries"]
    assert len(history) >= 1
    assert history[0]["change_type"] == ItemChangeLogType.CREATED.value
    assert history[0]["updated_by"] == SEED_IDS.regular_user


def test_item_history_endpoint_returns_404_for_missing_item(api_client: TestClient, seeded_db: Session):
    response = api_client.get(
        "/items/00000000-0000-0000-0000-000099999999/history",
        headers=auth_headers(),
    )

    assert response.status_code == 404


def test_update_item_endpoint_creates_history_on_category_change(api_client: TestClient, seeded_db: Session):
    response = api_client.patch(
        f"/items/{SEED_IDS.laptop_uuid}",
        json={"category_id": SEED_IDS.accessories},
        headers=auth_headers(),
    )

    assert response.status_code == 200

    history = (
        seeded_db.query(ItemHistory)
        .filter_by(item_id=SEED_IDS.laptop, change_type=ItemChangeLogType.CATEGORY_CHANGED)
        .all()
    )
    assert len(history) == 1


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


def test_user_cannot_delete_own_item(api_client: TestClient, seeded_db: Session):
    response = api_client.delete(
        f"/items/{SEED_IDS.adapter_uuid}",
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 403
    assert seeded_db.get(Item, SEED_IDS.adapter) is not None


def test_user_cannot_delete_item_owned_by_someone_else(api_client: TestClient, seeded_db: Session):
    response = api_client.delete(
        f"/items/{SEED_IDS.projector_uuid}",
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
    seeded_db.add_all(
        [
            ItemACL(
                item_id=SEED_IDS.projector,
                user_id=SEED_IDS.regular_user,
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
        headers=auth_headers(SEED_IDS.regular_user),
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["entries"]) == 1
    assert body["entries"][0]["user_id"] == SEED_IDS.regular_user


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
