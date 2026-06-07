from uuid import uuid7

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from src.auth.constants import UserRole, UserStatus
from src.categories.models import Category
from src.database import Base
from src.items.constants import ItemStatus
from src.items.models import Item
from src.items.service import ItemService
from src.locations.constants import LocationType
from src.locations.models import Location
from src.users.models import User


@pytest.fixture()
def db() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    with session_factory() as session:
        yield session


def test_list_items_builds_path_from_current_location_tree(db: Session):
    category = Category(name="Telefony", parent_id=None)
    building = Location(name="D10", type=LocationType.BUILDING, description=None, parent_id=None, is_active=True)
    room = Location(name="Sala 101", type=LocationType.ROOM, description=None, parent=building, is_active=True)
    owner = User(
        first_name="Adam",
        last_name="Nowak",
        email="listing-owner@example.com",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
    )
    db.add_all([category, building, room, owner])
    db.commit()

    item = Item(
        name="Nokia 3310",
        inventory_number=uuid7(),
        category_id=category.id,
        location_id=room.id,
        owner_id=owner.id,
        status=ItemStatus.AVAILABLE,
        description=None,
    )
    db.add(item)
    db.commit()

    building.name = "D10 renamed"
    db.commit()

    items = ItemService(db).list_items(location_id=room.id)

    assert items.pagination.total == 1
    assert items.items[0].location.id == room.id
    assert items.items[0].location.path == "D10 renamed / Sala 101"
