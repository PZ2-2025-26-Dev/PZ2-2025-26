from uuid import uuid7

import pytest
from sqlalchemy.orm import Session

from src.auth.constants import UserRole, UserStatus
from src.categories.models import Category
from src.items.constants import ItemStatus
from src.items.models import Item, LegacyIdentifier
from src.items.service import ItemService
from src.locations.constants import LocationType
from src.locations.models import Location
from src.locations.service import LocationService, build_tree
from src.users.models import User

pytestmark = pytest.mark.integration


def _seed_location_hierarchy(db: Session) -> dict[str, Location]:
    building = Location(name="D10", type=LocationType.BUILDING, parent_id=None, is_active=True)
    room = Location(name="204", type=LocationType.ROOM, parent_id=None, is_active=True)
    cabinet = Location(name="Szafa A", type=LocationType.CABINET, parent_id=None, is_active=True)
    db.add_all([building, room, cabinet])
    db.flush()

    room.parent_id = building.id
    cabinet.parent_id = room.id
    db.commit()
    db.refresh(building)
    db.refresh(room)
    db.refresh(cabinet)
    return {"building": building, "room": room, "cabinet": cabinet}


def test_build_tree_returns_nested_structure(db: Session):
    locations = _seed_location_hierarchy(db)
    all_locations = db.query(Location).all()

    tree = build_tree(all_locations)

    assert len(tree) == 1
    assert tree[0].id == locations["building"].id
    assert len(tree[0].children) == 1
    assert tree[0].children[0].id == locations["room"].id
    assert tree[0].children[0].children[0].id == locations["cabinet"].id


def test_get_location_tree_filters_by_search_on_name(db: Session):
    _seed_location_hierarchy(db)
    service = LocationService(db)

    tree = service.get_location_tree(search="Szafa")

    assert len(tree) == 1
    assert tree[0].name == "D10"
    assert tree[0].children[0].children[0].name == "Szafa A"


def test_list_items_filters_by_location_status_and_search(db: Session):
    locations = _seed_location_hierarchy(db)
    category = Category(name="Oscyloskopy", parent_id=None)
    user = User(
        first_name="Jan",
        last_name="Kowalski",
        email="jan@example.com",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
    )
    db.add_all([category, user])
    db.flush()

    available_item = Item(
        name="Oscyloskop Keysight",
        inventory_number=uuid7(),
        location_id=locations["room"].id,
        category_id=category.id,
        owner_id=user.id,
        status=ItemStatus.AVAILABLE,
    )
    loaned_item = Item(
        name="Generator Tektronix",
        inventory_number=uuid7(),
        location_id=locations["room"].id,
        category_id=category.id,
        owner_id=user.id,
        status=ItemStatus.LOANED,
    )
    other_room_item = Item(
        name="Zasilacz Rigol",
        inventory_number=uuid7(),
        location_id=locations["cabinet"].id,
        category_id=category.id,
        owner_id=user.id,
        status=ItemStatus.AVAILABLE,
    )
    db.add_all([available_item, loaned_item, other_room_item])
    db.flush()
    db.add(LegacyIdentifier(item_id=available_item.id, legacy_id="AGH-WFIIS-0042"))
    db.commit()

    service = ItemService(db)

    room_items, total = service.list_items(location_id=locations["room"].id)
    assert total == 2
    assert {item.name for item in room_items} == {"Oscyloskop Keysight", "Generator Tektronix"}

    available_only, available_total = service.list_items(
        location_id=locations["room"].id,
        statuses=[ItemStatus.AVAILABLE],
    )
    assert available_total == 1
    assert available_only[0].name == "Oscyloskop Keysight"

    by_legacy, legacy_total = service.list_items(search="AGH-WFIIS-0042")
    assert legacy_total == 1
    assert by_legacy[0].legacy_id == "AGH-WFIIS-0042"
