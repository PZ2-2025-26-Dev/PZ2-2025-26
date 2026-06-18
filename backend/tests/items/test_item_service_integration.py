from src.seed import SEED_IDS
import pytest
from sqlalchemy import exc as sql_exc
from sqlalchemy.orm import Session

from src.auth.constants import UserRole, UserStatus
from src.categories.models import Category
from src.items.models import Item
from src.items.constants import ItemStatus
from src.items.schemas import ItemCreate
from src.items.service import ItemService
from src.locations.constants import LocationType
from src.locations.models import Location
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
    assert new_item.inventory_number is not None
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

    item = service.get_item(SEED_IDS.laptop)

    assert item.id == SEED_IDS.laptop

def test_get_item_missing(
seeded_db: Session,
):
    service = ItemService(seeded_db)

    with pytest.raises(ValueError, match="Item not found"):
        service.get_item(999999)

def test_delete_item_success(
seeded_db: Session,
):
    service = ItemService(seeded_db)

    service.delete_item(SEED_IDS.laptop)

    assert seeded_db.get(Item, SEED_IDS.laptop) is None

def test_search_items_by_owner(
seeded_db: Session,
):
    service = ItemService(seeded_db)

    items, total = service.search_items(
        name=None,
        description=None,
        category_id=None,
        location_id=None,
        owner_id=SEED_IDS.regular_user,
        status=None,
        page=1,
        limit=20,
    )

    assert total > 0
    assert len(items) > 0

    for item in items:
        assert item.owner_id == SEED_IDS.regular_user

def test_search_items_by_name(
seeded_db: Session,
):
    service = ItemService(seeded_db)

    items, total = service.search_items(
        name="Laptop",
        description=None,
        category_id=None,
        location_id=None,
        owner_id=None,
        status=None,
        page=1,
        limit=20,
    )

    assert total >= 0
    assert isinstance(items, list)

def test_search_items_pagination(
seeded_db: Session,
):
    service = ItemService(seeded_db)

    items, total = service.search_items(
        name=None,
        description=None,
        category_id=None,
        location_id=None,
        owner_id=None,
        status=None,
        page=1,
        limit=1,
    )

    assert len(items) <= 1
    assert total >= len(items)