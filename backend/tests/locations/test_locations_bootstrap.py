from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from src.database import Base
from src.locations.bootstrap import ensure_default_root_locations
from src.locations.constants import DEFAULT_ROOT_LOCATION_NAMES, LocationType
from src.locations.models import Location


def test_ensure_default_root_locations_creates_buildings_once():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    with session_factory() as session:
        ensure_default_root_locations(session)
        ensure_default_root_locations(session)

        locations = session.scalars(select(Location).order_by(Location.name)).all()

    assert [location.name for location in locations] == list(DEFAULT_ROOT_LOCATION_NAMES)
    assert all(location.type == LocationType.BUILDING for location in locations)
    assert all(location.parent_id is None for location in locations)
    assert all(location.is_active for location in locations)
