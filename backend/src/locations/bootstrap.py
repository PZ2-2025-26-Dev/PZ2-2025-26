from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.locations.constants import DEFAULT_ROOT_LOCATION_NAMES, LocationType
from src.locations.models import Location


def ensure_default_root_locations(db: Session) -> None:
    existing_names = set(
        db.scalars(
            select(Location.name).where(
                Location.parent_id.is_(None),
                Location.type == LocationType.BUILDING,
                Location.name.in_(DEFAULT_ROOT_LOCATION_NAMES),
            )
        ).all()
    )

    missing_locations = [
        Location(name=name, type=LocationType.BUILDING, description=None, parent_id=None, is_active=True)
        for name in DEFAULT_ROOT_LOCATION_NAMES
        if name not in existing_names
    ]

    if not missing_locations:
        return

    db.add_all(missing_locations)
    db.commit()