import argparse
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from argon2 import PasswordHasher
from sqlalchemy import Engine, Select, select
from sqlalchemy.orm import Session

from src.auth.constants import AuthProvider, UserRole, UserStatus
from src.auth.models import UserAccount
from src.categories.models import Category
from src.config import config
from src.constants import Environment
from src.database import Base, SessionLocal, engine
from src.guests import models as guest_models  # noqa: F401
from src.items.constants import ItemStatus
from src.items.models import Item
from src.loans import models as loan_models  # noqa: F401
from src.locations.constants import LocationType
from src.locations.models import Location
from src.users.models import User

SEED_PASSWORD = "SeedPassword123!"


@dataclass(frozen=True)
class SeedIds:
    admin_user: int = 10_001
    regular_user: int = 10_002
    observer_user: int = 10_003

    building: int = 20_001
    room: int = 20_002
    cabinet: int = 20_003

    electronics: int = 30_001
    computers: int = 30_002
    accessories: int = 30_003

    laptop: int = 40_001
    projector: int = 40_002
    adapter: int = 40_003


SEED_IDS = SeedIds()


class SeedConflictError(RuntimeError):
    """Raised when a seed identifier is already used by a different record."""


def _get_existing(
    session: Session,
    model: type[Any],
    record_id: int,
    natural_key: Select[tuple[Any]],
) -> Any | None:
    existing = session.get(model, record_id)
    matching_natural_key = session.scalar(natural_key)

    if existing is not None and matching_natural_key not in (None, existing):
        raise SeedConflictError(f"{model.__name__} seed keys point to two different records")
    if existing is not None:
        return existing
    if matching_natural_key is not None:
        raise SeedConflictError(
            f"{model.__name__} seed record exists with id={matching_natural_key.id}, expected id={record_id}"
        )
    return None


def _upsert(
    session: Session,
    model: type[Any],
    record_id: int,
    natural_key: Select[tuple[Any]],
    **values: Any,
) -> Any:
    record = _get_existing(session, model, record_id, natural_key)
    if record is None:
        record = model(id=record_id, **values)
        session.add(record)
    else:
        for field, value in values.items():
            setattr(record, field, value)
    return record


def seed_database(session: Session) -> SeedIds:
    """Add or refresh the deterministic development dataset in a transaction."""
    users = (
        (
            SEED_IDS.admin_user,
            "admin.seed@example.com",
            {
                "first_name": "Anna",
                "last_name": "Admin",
                "role": UserRole.ADMIN,
                "status": UserStatus.ACTIVE,
            },
        ),
        (
            SEED_IDS.regular_user,
            "user.seed@example.com",
            {
                "first_name": "Jan",
                "last_name": "User",
                "role": UserRole.USER,
                "status": UserStatus.ACTIVE,
            },
        ),
        (
            SEED_IDS.observer_user,
            "observer.seed@example.com",
            {
                "first_name": "Olga",
                "last_name": "Observer",
                "role": UserRole.OBSERVER,
                "status": UserStatus.ACTIVE,
            },
        ),
    )
    for user_id, email, values in users:
        _upsert(
            session,
            User,
            user_id,
            select(User).where(User.email == email),
            email=email,
            **values,
        )
    session.flush()

    password_hash = PasswordHasher().hash(SEED_PASSWORD)
    for account_id, user_id in enumerate(
        (SEED_IDS.admin_user, SEED_IDS.regular_user, SEED_IDS.observer_user),
        start=11_001,
    ):
        existing_account = _upsert(
            session,
            UserAccount,
            account_id,
            select(UserAccount).where(
                UserAccount.user_id == user_id,
                UserAccount.provider == AuthProvider.LOCAL,
            ),
            user_id=user_id,
            provider=AuthProvider.LOCAL,
            provider_user_id=None,
            pwd_hash=password_hash,
        )
        if existing_account.pwd_hash is None:
            existing_account.pwd_hash = password_hash

    _upsert(
        session,
        Location,
        SEED_IDS.building,
        select(Location).where(Location.parent_id.is_(None), Location.name == "Budynek D"),
        name="Budynek D",
        type=LocationType.BUILDING,
        description="Główny budynek zestawu danych developerskich",
        parent_id=None,
        is_active=True,
    )
    session.flush()
    _upsert(
        session,
        Location,
        SEED_IDS.room,
        select(Location).where(
            Location.parent_id == SEED_IDS.building,
            Location.name == "Sala D10",
        ),
        name="Sala D10",
        type=LocationType.ROOM,
        description="Pracownia testowa",
        parent_id=SEED_IDS.building,
        is_active=True,
    )
    session.flush()
    _upsert(
        session,
        Location,
        SEED_IDS.cabinet,
        select(Location).where(
            Location.parent_id == SEED_IDS.room,
            Location.name == "Szafa A",
        ),
        name="Szafa A",
        type=LocationType.CABINET,
        description=None,
        parent_id=SEED_IDS.room,
        is_active=True,
    )

    _upsert(
        session,
        Category,
        SEED_IDS.electronics,
        select(Category).where(Category.parent_id.is_(None), Category.name == "Elektronika"),
        name="Elektronika",
        parent_id=None,
    )
    session.flush()
    _upsert(
        session,
        Category,
        SEED_IDS.computers,
        select(Category).where(
            Category.parent_id == SEED_IDS.electronics,
            Category.name == "Komputery",
        ),
        name="Komputery",
        parent_id=SEED_IDS.electronics,
    )
    _upsert(
        session,
        Category,
        SEED_IDS.accessories,
        select(Category).where(
            Category.parent_id == SEED_IDS.electronics,
            Category.name == "Akcesoria",
        ),
        name="Akcesoria",
        parent_id=SEED_IDS.electronics,
    )
    session.flush()

    items = (
        (
            SEED_IDS.laptop,
            UUID("00000000-0000-0000-0000-000000040001"),
            {
                "name": "Laptop developerski",
                "location_id": SEED_IDS.cabinet,
                "category_id": SEED_IDS.computers,
                "owner_id": SEED_IDS.regular_user,
                "status": ItemStatus.AVAILABLE,
                "description": "Przykładowy przedmiot dostępny do wypożyczenia",
            },
        ),
        (
            SEED_IDS.projector,
            UUID("00000000-0000-0000-0000-000000040002"),
            {
                "name": "Projektor",
                "location_id": SEED_IDS.room,
                "category_id": SEED_IDS.electronics,
                "owner_id": SEED_IDS.admin_user,
                "status": ItemStatus.AVAILABLE,
                "description": "Przykładowy projektor",
            },
        ),
        (
            SEED_IDS.adapter,
            UUID("00000000-0000-0000-0000-000000040003"),
            {
                "name": "Adapter USB-C",
                "location_id": SEED_IDS.cabinet,
                "category_id": SEED_IDS.accessories,
                "owner_id": SEED_IDS.regular_user,
                "status": ItemStatus.BROKEN,
                "description": "Przykładowy uszkodzony przedmiot",
            },
        ),
    )
    for item_id, inventory_number, values in items:
        _upsert(
            session,
            Item,
            item_id,
            select(Item).where(Item.inventory_number == inventory_number),
            inventory_number=inventory_number,
            **values,
        )

    session.flush()
    return SEED_IDS


def reset_database(database_engine: Engine = engine) -> SeedIds:
    """Recreate all tables and restore the deterministic development dataset."""
    Base.metadata.drop_all(bind=database_engine)
    Base.metadata.create_all(bind=database_engine)
    with Session(database_engine, expire_on_commit=False) as session:
        seed_ids = seed_database(session)
        session.commit()
        return seed_ids


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Manage the development database seed.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("seed", help="Add or refresh deterministic seed records.")
    reset_parser = subparsers.add_parser("reset", help="Drop all tables and restore the seed state.")
    reset_parser.add_argument(
        "--yes",
        action="store_true",
        help="Confirm the destructive reset.",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()

    if args.command == "seed":
        with SessionLocal() as session:
            seed_database(session)
            session.commit()
        print("Development seed applied.")
        return

    if config.env == Environment.PROD:
        raise SystemExit("Database reset is disabled when PZ_ENV=prod.")
    if not args.yes:
        raise SystemExit("Reset drops all tables. Run again with --yes to confirm.")

    reset_database()
    print("Database reset to the development seed state.")


if __name__ == "__main__":
    main()
