from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from src.database import Base
from src.items.models import Item
from src.seed import SEED_IDS, reset_database, seed_database
from src.users.models import User


def test_seed_database_is_idempotent():
    database_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(database_engine)

    with Session(database_engine) as session:
        seed_database(session)
        session.commit()
        seed_database(session)
        session.commit()

        assert session.scalar(select(func.count(User.id))) == 3
        assert session.scalar(select(func.count(Item.id))) == 3
        assert session.get(User, SEED_IDS.admin_user).email == "admin.seed@example.com"


def test_reset_database_restores_initial_seed_state():
    database_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(database_engine)

    with Session(database_engine) as session:
        seed_database(session)
        session.commit()
        session.get(User, SEED_IDS.admin_user).first_name = "Changed"
        session.add(
            User(
                first_name="Extra",
                last_name=None,
                email="extra@example.com",
                role=session.get(User, SEED_IDS.regular_user).role,
                status=session.get(User, SEED_IDS.regular_user).status,
            )
        )
        session.commit()

    reset_database(database_engine)

    with Session(database_engine) as session:
        assert session.scalar(select(func.count(User.id))) == 3
        assert session.get(User, SEED_IDS.admin_user).first_name == "Anna"
