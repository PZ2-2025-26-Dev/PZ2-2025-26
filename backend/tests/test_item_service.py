import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
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


def setup_inmemory_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


def test_add_item_success():
    Session = setup_inmemory_db()
    with Session() as session:
        # create required relations
        cat = Category(name="TestCat", parent_id=None)
        loc = Location(name="D10", type=LocationType.BUILDING, description=None, parent_id=None, is_active=True)
        user = User(first_name="Adam", last_name="Nowak", email="adam@example.com", role=UserRole.USER, status=UserStatus.ACTIVE)

        session.add_all([cat, loc, user])
        session.commit()

        data = ItemCreate(
            name="Oscyloskop test",
            category_id=cat.id,
            location_id=loc.id,
            owner_id=user.id,
            description="Test description",
        )

        service = ItemService(session)
        new_item = service.add_item(data)

        assert new_item.id is not None
        assert new_item.inventory_number is not None
        assert new_item.status == ItemStatus.AVAILABLE


def test_add_item_missing_relations():
    Session = setup_inmemory_db()
    with Session() as session:
        # do not create relations
        data = ItemCreate(
            name="NoRel",
            category_id=999,
            location_id=999,
            owner_id=999,
            description=None,
        )

        service = ItemService(session)
        with pytest.raises(sql_exc.IntegrityError):
            service.add_item(data)