import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from src.database import Base
from src.locations.constants import LocationType
from src.locations.models import Location
from src.locations.schemas import LocationCreate
from src.locations.service import InvalidLocationParentError, LocationService


@pytest.fixture()
def db() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    with session_factory() as session:
        yield session


def test_create_location_returns_generated_path(db: Session):
    service = LocationService(db)
    building = Location(name="D10", type=LocationType.BUILDING, description=None, parent_id=None, is_active=True)
    room = Location(name="Sala 101", type=LocationType.ROOM, description=None, parent=building, is_active=True)
    db.add_all([building, room])
    db.commit()

    cabinet, path = service.create_location(
        LocationCreate(
            name="Szafa A",
            type=LocationType.CABINET,
            parent_id=room.id,
        )
    )

    assert cabinet.id is not None
    assert cabinet.parent_id == room.id
    assert path == "D10 / Sala 101 / Szafa A"


def test_create_location_accepts_api_enum_case(db: Session):
    service = LocationService(db)
    building = Location(name="D10", type=LocationType.BUILDING, description=None, parent_id=None, is_active=True)
    db.add(building)
    db.commit()

    room, path = service.create_location(
        LocationCreate(
            name="Sala 102",
            type="ROOM",
            parent_id=building.id,
        )
    )

    assert room.type == LocationType.ROOM
    assert path == "D10 / Sala 102"


def test_get_tree_returns_nested_locations(db: Session):
    service = LocationService(db)
    building = Location(name="D10", type=LocationType.BUILDING, description=None, parent_id=None, is_active=True)
    room = Location(name="Sala 101", type=LocationType.ROOM, description=None, parent=building, is_active=True)
    cabinet = Location(name="Szafa A", type=LocationType.CABINET, description=None, parent=room, is_active=True)
    db.add_all([building, room, cabinet])
    db.commit()

    tree = service.get_tree()

    assert len(tree) == 1
    assert tree[0].name == "D10"
    assert tree[0].children[0].name == "Sala 101"
    assert tree[0].children[0].children[0].name == "Szafa A"


def test_create_location_allows_multiple_shelves_under_one_cabinet(db: Session):
    service = LocationService(db)
    building = Location(name="D10", type=LocationType.BUILDING, description=None, parent_id=None, is_active=True)
    room = Location(name="Sala 101", type=LocationType.ROOM, description=None, parent=building, is_active=True)
    cabinet = Location(name="Szafa A", type=LocationType.CABINET, description=None, parent=room, is_active=True)
    db.add_all([building, room, cabinet])
    db.commit()

    first_shelf, _ = service.create_location(
        LocationCreate(
            name="Półka 1",
            type=LocationType.SHELF,
            parent_id=cabinet.id,
        )
    )
    second_shelf, _ = service.create_location(
        LocationCreate(
            name="Półka 2",
            type=LocationType.SHELF,
            parent_id=cabinet.id,
        )
    )

    assert first_shelf.parent_id == cabinet.id
    assert second_shelf.parent_id == cabinet.id


def test_create_location_rejects_invalid_parent_type(db: Session):
    service = LocationService(db)
    building = Location(name="D10", type=LocationType.BUILDING, description=None, parent_id=None, is_active=True)
    db.add(building)
    db.commit()

    with pytest.raises(InvalidLocationParentError):
        service.create_location(
            LocationCreate(
                name="Szafa A",
                type=LocationType.CABINET,
                parent_id=building.id,
            )
        )
