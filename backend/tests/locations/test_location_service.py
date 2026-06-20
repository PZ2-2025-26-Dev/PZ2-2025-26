import pytest
from sqlalchemy import select

from src.items.models import Item
from src.locations.constants import LocationHistoryChangeType, LocationType
from src.locations.models import Location, LocationHistory
from src.locations.schemas import LocationCreate, LocationUpdate
from src.locations.service import LocationHasAssignedItemsError, LocationService
from src.seed import SEED_IDS


def test_build_location_path_uses_full_parent_chain(seeded_db):
    service = LocationService(seeded_db)

    path = service.build_location_path(SEED_IDS.cabinet)

    assert path == "Budynek D / Sala D10 / Szafa A"


def test_update_location_saves_history(seeded_db):
    service = LocationService(seeded_db)

    updated = service.update_location(
        SEED_IDS.room,
        LocationUpdate(name="Sala 204", description="Nowy opis", address="Adres pomocniczy"),
    )

    history = seeded_db.scalars(
        select(LocationHistory).where(
            LocationHistory.location_id == SEED_IDS.room,
            LocationHistory.change_type == LocationHistoryChangeType.UPDATED,
        )
    ).all()

    assert updated.name == "Sala 204"
    assert updated.address == "Adres pomocniczy"
    assert updated.path == "Budynek D / Sala 204"
    assert len(history) == 1


def test_delete_location_blocks_when_subtree_contains_items(seeded_db):
    service = LocationService(seeded_db)

    with pytest.raises(LocationHasAssignedItemsError):
        service.delete_location(SEED_IDS.room)

    assert seeded_db.get(Location, SEED_IDS.room) is not None
    assert seeded_db.get(Location, SEED_IDS.cabinet) is not None
    assert (
        seeded_db.scalars(select(Item).where(Item.location_id.in_([SEED_IDS.room, SEED_IDS.cabinet]))).first()
        is not None
    )


def test_delete_location_removes_empty_subtree(seeded_db):
    empty_room = Location(
        name="Pusta sala",
        type=LocationType.ROOM,
        parent_id=SEED_IDS.building,
        description=None,
        is_active=True,
    )
    empty_cabinet = Location(
        name="Pusta szafa",
        type=LocationType.CABINET,
        parent=empty_room,
        description=None,
        is_active=True,
    )
    empty_shelf = Location(
        name="Pusta półka",
        type=LocationType.SHELF,
        parent=empty_cabinet,
        description=None,
        is_active=True,
    )
    seeded_db.add_all([empty_room, empty_cabinet, empty_shelf])
    seeded_db.commit()

    service = LocationService(seeded_db)
    deleted_locations_count = service.delete_location(empty_room.id)
    history = seeded_db.scalars(
        select(LocationHistory).where(
            LocationHistory.location_id == empty_room.id,
            LocationHistory.change_type == LocationHistoryChangeType.DELETED,
        )
    ).all()

    assert deleted_locations_count == 3
    assert seeded_db.get(Location, empty_room.id) is None
    assert seeded_db.get(Location, empty_cabinet.id) is None
    assert seeded_db.get(Location, empty_shelf.id) is None
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


def test_seed_contains_remote_location_with_address(seeded_db):
    service = LocationService(seeded_db)

    remote = service.get_location(SEED_IDS.remote_location)

    assert remote.type == LocationType.REMOTE
    assert remote.address == "ul. Przykładowa 1, 30-001 Kraków"
    assert remote.path == "Lokalizacja zewnętrzna"
