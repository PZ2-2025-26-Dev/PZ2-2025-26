from sqlalchemy import select

from src.items.models import Item
from src.locations.constants import LocationHistoryChangeType, LocationType
from src.locations.models import Location, LocationHistory
from src.locations.schemas import LocationCreate, LocationUpdate
from src.locations.service import LocationService
from src.seed import SEED_IDS


def test_build_location_path_uses_full_parent_chain(seeded_db):
    service = LocationService(seeded_db)

    path = service.build_location_path(SEED_IDS.cabinet)

    assert path == "Budynek D / Sala D10 / Szafa A"


def test_update_location_saves_history(seeded_db):
    service = LocationService(seeded_db)

    updated = service.update_location(
        SEED_IDS.room,
        LocationUpdate(name="Sala 204", description="Nowy opis"),
    )

    history = seeded_db.scalars(
        select(LocationHistory).where(
            LocationHistory.location_id == SEED_IDS.room,
            LocationHistory.change_type == LocationHistoryChangeType.UPDATED,
        )
    ).all()

    assert updated.name == "Sala 204"
    assert updated.path == "Budynek D / Sala 204"
    assert len(history) == 1


def test_delete_location_moves_items_to_replacement(seeded_db):
    replacement = Location(
        name="Sala zastępcza",
        type=LocationType.ROOM,
        parent_id=SEED_IDS.building,
        description=None,
        is_active=True,
    )
    seeded_db.add(replacement)
    seeded_db.commit()

    service = LocationService(seeded_db)
    migrated_items_count = service.delete_location(SEED_IDS.cabinet, replacement.id)
    moved_items = seeded_db.scalars(select(Item).where(Item.location_id == replacement.id)).all()
    history = seeded_db.scalars(
        select(LocationHistory).where(
            LocationHistory.location_id == SEED_IDS.cabinet,
            LocationHistory.change_type == LocationHistoryChangeType.DELETED,
        )
    ).all()

    assert migrated_items_count == 2
    assert {item.id for item in moved_items} >= {SEED_IDS.laptop, SEED_IDS.adapter}
    assert len(history) == 1


def test_create_location_returns_path(seeded_db):
    service = LocationService(seeded_db)

    created = service.create_location(
        LocationCreate(
            name="Półka 1",
            type=LocationType.SHELF,
            parent_id=SEED_IDS.cabinet,
        )
    )

    assert created.path == "Budynek D / Sala D10 / Szafa A / Półka 1"


def test_list_location_items_includes_descendants(seeded_db):
    service = LocationService(seeded_db)

    result = service.list_location_items(SEED_IDS.building, page=1, limit=20)

    assert result.pagination.total == 3
    assert {item.id for item in result.items} == {SEED_IDS.laptop, SEED_IDS.projector, SEED_IDS.adapter}
