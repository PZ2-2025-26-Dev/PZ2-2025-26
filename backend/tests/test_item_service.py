import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import exc as sql_exc
from src.database import Base
from src.items.service import ItemService
from src.items.schemas import ItemCreate
from src.categories.models import Category
from src.locations.models import Location
from src.locations.constants import LocationType
from src.users.models import User
from src.auth.constants import UserRole, UserStatus
from src.items.constants import ItemStatus


pytestmark = pytest.mark.integration


def test_add_item_success(db: Session):
    cat = Category(name="TestCat", parent_id=None)
    loc = Location(name="D10", type=LocationType.BUILDING, description=None, parent_id=None, is_active=True)
    user = User(first_name="Adam", last_name="Nowak", email="adam@example.com", role=UserRole.USER, status=UserStatus.ACTIVE)

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
