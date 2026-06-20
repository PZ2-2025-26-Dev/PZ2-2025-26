import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.items.models import Item
from src.seed import SEED_IDS, seed_database
from src.users.models import User

pytestmark = pytest.mark.integration


def test_seed_database_is_idempotent(db: Session):
    seed_database(db)
    seed_database(db)

    # 3 użytkowników z kontami logowania + 1 Gość (rola GUEST, bez konta).
    assert db.scalar(select(func.count(User.id))) == 4
    assert db.scalar(select(func.count(Item.id))) == 3
    assert db.get(User, SEED_IDS.admin_user).email == "admin.seed@example.com"


def test_seed_database_refreshes_seed_records(seeded_db: Session):
    seeded_db.get(User, SEED_IDS.admin_user).first_name = "Changed"
    seeded_db.flush()

    seed_database(seeded_db)

    assert seeded_db.get(User, SEED_IDS.admin_user).first_name == "Anna"
