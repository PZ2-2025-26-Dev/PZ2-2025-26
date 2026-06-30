import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.items.constants import ItemChangeLogType, ItemStatus
from src.items.models import Item, ItemHistory
from src.seed import (
    SEED_ADAPTER_OLD_ID,
    SEED_ADAPTER_PARAMETERS,
    SEED_IDS,
    SEED_LAPTOP_OLD_ID,
    SEED_LAPTOP_PARAMETERS,
    SEED_PROJECTOR_OLD_ID,
    SEED_PROJECTOR_PARAMETERS,
    seed_database,
)
from src.users.models import User

pytestmark = pytest.mark.integration


def test_seed_database_is_idempotent(db: Session):
    seed_database(db)
    seed_database(db)

    assert db.scalar(select(func.count(User.id))) == 9
    assert db.scalar(select(func.count(Item.id))) == 3
    assert db.scalar(select(func.count(ItemHistory.id))) == 14
    assert db.get(User, SEED_IDS.admin_user).email == "admin.seed@example.com"


def test_seed_database_refreshes_seed_records(seeded_db: Session):
    seeded_db.get(User, SEED_IDS.admin_user).first_name = "Changed"
    seeded_db.flush()

    seed_database(seeded_db)

    assert seeded_db.get(User, SEED_IDS.admin_user).first_name == "Anna"


def test_seed_items_have_complete_fields(seeded_db: Session):
    laptop = seeded_db.get(Item, SEED_IDS.laptop)
    projector = seeded_db.get(Item, SEED_IDS.projector)
    adapter = seeded_db.get(Item, SEED_IDS.adapter)

    assert laptop.oldID == SEED_LAPTOP_OLD_ID
    assert laptop.parameters == SEED_LAPTOP_PARAMETERS
    assert laptop.status == ItemStatus.AVAILABLE

    assert projector.oldID == SEED_PROJECTOR_OLD_ID
    assert projector.parameters == SEED_PROJECTOR_PARAMETERS

    assert adapter.oldID == SEED_ADAPTER_OLD_ID
    assert adapter.parameters == SEED_ADAPTER_PARAMETERS
    assert adapter.status == ItemStatus.BROKEN


def test_seed_items_have_creation_history(seeded_db: Session):
    history = seeded_db.scalar(
        select(ItemHistory).where(
            ItemHistory.item_id == SEED_IDS.laptop,
            ItemHistory.change_type == ItemChangeLogType.CREATED,
        )
    )

    assert history is not None
    assert history.updated_by == SEED_IDS.regular_user
    assert history.description == "Laptop developerski utworzony w seedzie"


def test_seed_laptop_has_example_history_for_pagination(seeded_db: Session):
    history = seeded_db.scalars(select(ItemHistory).where(ItemHistory.item_id == SEED_IDS.laptop)).all()

    assert len(history) == 12
    assert {entry.change_type for entry in history} == {
        ItemChangeLogType.CREATED,
        ItemChangeLogType.LOANED,
        ItemChangeLogType.OWNER_CHANGED,
        ItemChangeLogType.LOCATION_CHANGED,
        ItemChangeLogType.CATEGORY_CHANGED,
    }
