import pytest
from fastapi import HTTPException
from sqlalchemy import exc as sql_exc
from sqlalchemy.orm import Session

from src.auth.constants import UserRole, UserStatus
from src.categories.models import Category
from src.items.constants import ItemStatus
from src.items.models import Item, ItemHistory
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


def test_delete_item_success(db: Session):
    cat = Category(name="TestCat", parent_id=None)
    loc = Location(name="D10", type=LocationType.BUILDING, description=None, parent_id=None, is_active=True)
    user = User(
        first_name="Adam", last_name="Nowak", email="adam@example.com", role=UserRole.USER, status=UserStatus.ACTIVE
    )
    db.add_all([cat, loc, user])
    db.commit()

    data = ItemCreate(name="ToDelete", category_id=cat.id, location_id=loc.id, owner_id=user.id, description="Test")

    service = ItemService(db)
    item = service.add_item(data)

    hist = ItemHistory(item_id=item.id, description="test")
    db.add(hist)
    db.commit()

    service.delete_item(item.id)

    assert db.get(Item, item.id) is None
    assert db.query(ItemHistory).filter_by(item_id=item.id).count() == 0


def test_delete_item_not_found(db: Session):
    service = ItemService(db)

    with pytest.raises(HTTPException) as exc:
        service.delete_item(999)

    assert exc.value.status_code == 404


def test_delete_item_loaned(db: Session):
    cat = Category(name="TestCat", parent_id=None)
    loc = Location(name="D10", type=LocationType.BUILDING, description=None, parent_id=None, is_active=True)
    user = User(
        first_name="Adam", last_name="Nowak", email="adam@example.com", role=UserRole.USER, status=UserStatus.ACTIVE
    )
    db.add_all([cat, loc, user])
    db.commit()

    data = ItemCreate(name="Loaned", category_id=cat.id, location_id=loc.id, owner_id=user.id, description=None)

    service = ItemService(db)
    item = service.add_item(data)

    item.status = ItemStatus.LOANED
    db.commit()

    with pytest.raises(HTTPException) as exc:
        service.delete_item(item.id)

    assert exc.value.status_code == 400


def test_get_item(db: Session):
    cat = Category(name="TestCat", parent_id=None)
    loc = Location(name="D10", type=LocationType.BUILDING, description=None, parent_id=None, is_active=True)
    user = User(
        first_name="Adam", last_name="Nowak", email="adam@example.com", role=UserRole.USER, status=UserStatus.ACTIVE
    )
    db.add_all([cat, loc, user])
    db.commit()

    data = ItemCreate(name="GetItem", category_id=cat.id, location_id=loc.id, owner_id=user.id, description="Test")

    service = ItemService(db)
    item = service.add_item(data)

    fetched = service.get_item(item.id)

    assert fetched is not None
    assert fetched.id == item.id
