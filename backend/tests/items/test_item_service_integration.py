import pytest
from sqlalchemy import exc as sql_exc
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.auth.constants import UserRole, UserStatus
from src.categories.models import Category
from src.items.constants import ItemChangeLogType, ItemStatus
from src.items.exceptions import ItemOnLoanError
from src.items.models import Item, ItemHistory
from src.items.schemas import ItemCreate, ItemHistorySearch, ItemSearch, ItemUpdate
from src.items.service import ItemService
from src.locations.constants import LocationType
from src.locations.models import Location
from src.seed import SEED_IDS, SEED_LAPTOP_OLD_ID, SEED_LAPTOP_PARAMETERS
from src.users.models import User

pytestmark = pytest.mark.integration


def test_add_item_success(db: Session):
    cat = Category(name="TestCat", parent_id=None)
    loc = Location(name="D10", type=LocationType.BUILDING, description=None, parent_id=None, is_active=True)
    user = User(
        first_name="Adam", last_name="Nowak", email="adam@example.com", role=UserRole.USER, status=UserStatus.ACTIVE
    )

    db.add_all([cat, loc, user])
    db.commit()

    data = ItemCreate(
        name="Oscyloskop test",
        category_id=cat.id,
        location_id=loc.id,
        owner_id=user.id,
        description="Test description",
    )

    service = ItemService(db)
    new_item = service.add_item(data)

    assert new_item.id is not None
    assert new_item.status == ItemStatus.AVAILABLE


def test_add_item_missing_relations(db: Session):
    data = ItemCreate(
        name="NoRel",
        category_id=999,
        location_id=999,
        owner_id=999,
        description=None,
    )

    service = ItemService(db)
    with pytest.raises(sql_exc.IntegrityError):
        service.add_item(data)


def test_get_item_success(
    seeded_db: Session,
):
    service = ItemService(seeded_db)

    item = service.get_item(SEED_IDS.laptop_uuid)

    assert item.id == SEED_IDS.laptop_uuid


def test_get_item_missing(
    seeded_db: Session,
):
    from uuid import UUID

    service = ItemService(seeded_db)

    with pytest.raises(ValueError, match="Item not found"):
        service.get_item(UUID("00000000-0000-0000-0000-000099999999"))


def test_delete_item_success(
    seeded_db: Session,
):
    service = ItemService(seeded_db)

    service.delete_item(SEED_IDS.laptop_uuid)

    assert seeded_db.get(Item, SEED_IDS.laptop) is None


def test_delete_item_rejects_loaned_item(seeded_db: Session):
    item = seeded_db.get(Item, SEED_IDS.laptop)
    item.status = ItemStatus.LOANED
    seeded_db.flush()

    service = ItemService(seeded_db)

    with pytest.raises(ItemOnLoanError):
        service.delete_item(SEED_IDS.laptop_uuid)


def test_search_items_by_owner(
    seeded_db: Session,
):
    service = ItemService(seeded_db)

    result = service.search_items(
        ItemSearch(
            owner_id=SEED_IDS.regular_user,
            page=1,
            limit=20,
        )
    )

    assert result.pagination.total > 0
    assert len(result.items) > 0

    for item in result.items:
        assert item.owner.id == SEED_IDS.regular_user


def test_search_items_by_name(
    seeded_db: Session,
):
    service = ItemService(seeded_db)

    result = service.search_items(
        ItemSearch(
            name="Laptop",
            page=1,
            limit=20,
        )
    )

    assert result.pagination.total >= 0
    assert isinstance(result.items, list)


def test_search_items_pagination(
    seeded_db: Session,
):
    service = ItemService(seeded_db)

    result = service.search_items(
        ItemSearch(
            page=1,
            limit=1,
        )
    )

    assert len(result.items) <= 1
    assert result.pagination.total >= len(result.items)


def test_add_item_persists_parameters_and_old_id(db: Session):
    cat = Category(name="ParamCat", parent_id=None)
    loc = Location(name="ParamLoc", type=LocationType.ROOM, description=None, parent_id=None, is_active=True)
    user = User(
        first_name="Piotr",
        last_name="Param",
        email="piotr.param@example.com",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
    )

    db.add_all([cat, loc, user])
    db.commit()

    parameters = {"weight_kg": 2.5, "color": "black"}
    data = ItemCreate(
        name="Waga laboratoryjna",
        category_id=cat.id,
        location_id=loc.id,
        owner_id=user.id,
        description="Test parameters",
        parameters=parameters,
        oldID="LEG-SCALE-001",
    )

    new_item = ItemService(db).add_item(data)

    assert new_item.parameters == parameters
    assert new_item.oldID == "LEG-SCALE-001"

    stored = db.scalar(select(Item).where(Item.uuid == new_item.id))
    assert stored.parameters == parameters
    assert stored.oldID == "LEG-SCALE-001"


def test_get_item_returns_parameters_and_old_id(seeded_db: Session):
    item = ItemService(seeded_db).get_item(SEED_IDS.laptop_uuid)

    assert item.parameters == SEED_LAPTOP_PARAMETERS
    assert item.oldID == SEED_LAPTOP_OLD_ID


def test_update_item_updates_parameters(seeded_db: Session):
    new_parameters = {"cpu": "Apple M3", "ram_gb": 24}

    updated = ItemService(seeded_db).update_item(
        SEED_IDS.laptop_uuid,
        ItemUpdate(parameters=new_parameters),
    )

    assert updated.parameters == new_parameters
    assert seeded_db.get(Item, SEED_IDS.laptop).parameters == new_parameters


def test_update_item_category_creates_history(seeded_db: Session):
    history_count = seeded_db.scalar(
        select(func.count(ItemHistory.id)).where(
            ItemHistory.item_id == SEED_IDS.laptop,
            ItemHistory.change_type == ItemChangeLogType.CATEGORY_CHANGED,
        )
    )

    ItemService(seeded_db).update_item(
        SEED_IDS.laptop_uuid,
        ItemUpdate(category_id=SEED_IDS.accessories),
    )

    updated_history_count = seeded_db.scalar(
        select(func.count(ItemHistory.id)).where(
            ItemHistory.item_id == SEED_IDS.laptop,
            ItemHistory.change_type == ItemChangeLogType.CATEGORY_CHANGED,
        )
    )
    assert updated_history_count == history_count + 1


def test_update_item_location_creates_history(seeded_db: Session):
    history_count = seeded_db.scalar(
        select(func.count(ItemHistory.id)).where(
            ItemHistory.item_id == SEED_IDS.laptop,
            ItemHistory.change_type == ItemChangeLogType.LOCATION_CHANGED,
        )
    )

    ItemService(seeded_db).update_item(
        SEED_IDS.laptop_uuid,
        ItemUpdate(location_id=SEED_IDS.room),
    )

    updated_history_count = seeded_db.scalar(
        select(func.count(ItemHistory.id)).where(
            ItemHistory.item_id == SEED_IDS.laptop,
            ItemHistory.change_type == ItemChangeLogType.LOCATION_CHANGED,
        )
    )
    assert updated_history_count == history_count + 1


def test_update_item_owner_creates_history(seeded_db: Session):
    history_count = seeded_db.scalar(
        select(func.count(ItemHistory.id)).where(
            ItemHistory.item_id == SEED_IDS.laptop,
            ItemHistory.change_type == ItemChangeLogType.OWNER_CHANGED,
        )
    )

    ItemService(seeded_db).update_item(
        SEED_IDS.laptop_uuid,
        ItemUpdate(owner_id=SEED_IDS.admin_user),
    )

    updated_history_count = seeded_db.scalar(
        select(func.count(ItemHistory.id)).where(
            ItemHistory.item_id == SEED_IDS.laptop,
            ItemHistory.change_type == ItemChangeLogType.OWNER_CHANGED,
        )
    )
    assert updated_history_count == history_count + 1


def test_get_item_history_returns_seed_entries(seeded_db: Session):
    history = ItemService(seeded_db).get_item_history(
        SEED_IDS.laptop_uuid,
        ItemHistorySearch(change_type=ItemChangeLogType.CREATED),
    )

    assert len(history.entries) >= 1
    assert history.entries[0].change_type == ItemChangeLogType.CREATED
    assert history.entries[0].updated_by == SEED_IDS.regular_user
    assert history.pagination.total >= 1


def test_search_items_by_category(seeded_db: Session):
    result = ItemService(seeded_db).search_items(ItemSearch(category_id=SEED_IDS.computers, page=1, limit=20))

    assert result.pagination.total >= 1
    assert all(item.category.id == SEED_IDS.computers for item in result.items)


def test_search_items_by_location(seeded_db: Session):
    result = ItemService(seeded_db).search_items(ItemSearch(location_id=SEED_IDS.cabinet, page=1, limit=20))

    assert result.pagination.total >= 1
    assert all(item.location.id == SEED_IDS.cabinet for item in result.items)


def test_search_items_by_status(seeded_db: Session):
    result = ItemService(seeded_db).search_items(ItemSearch(status=ItemStatus.BROKEN, page=1, limit=20))

    assert result.pagination.total >= 1
    assert all(item.status == ItemStatus.BROKEN for item in result.items)


def test_search_items_by_description(seeded_db: Session):
    result = ItemService(seeded_db).search_items(ItemSearch(description="projektor", page=1, limit=20))

    assert result.pagination.total >= 1
    assert all("projektor" in (item.description or "").lower() for item in result.items)
