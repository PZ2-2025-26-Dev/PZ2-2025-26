import argparse
from dataclasses import dataclass
from datetime import UTC, datetime
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
from src.items.constants import ItemChangeLogType, ItemPermissionType, ItemStatus
from src.items.models import Item, ItemACL, ItemHistory
from src.loans import models as loan_models  # noqa: F401
from src.locations.constants import LocationType
from src.locations.models import Location
from src.users.models import User

SEED_PASSWORD = "SeedPassword123!"
SEED_ITEM_HISTORY_AT = datetime(2025, 1, 1, 12, 0, 0, tzinfo=UTC)

SEED_LAPTOP_OLD_ID = "LEG-LAP-001"
SEED_LAPTOP_PARAMETERS = {"cpu": "Intel i7", "ram_gb": 16, "os": "Linux"}

SEED_PROJECTOR_OLD_ID = "LEG-PROJ-001"
SEED_PROJECTOR_PARAMETERS = {"lumens": 3500, "resolution": "1920x1080"}

SEED_ADAPTER_OLD_ID = "LEG-ADP-001"
SEED_ADAPTER_PARAMETERS = {"ports": ["USB-C", "HDMI"], "watt": 65}


@dataclass(frozen=True)
class SeedIds:
    admin_user: int = 10_001
    regular_user: int = 10_002
    observer_user: int = 10_003
    delegate_user_1: int = 10_004
    delegate_user_2: int = 10_005
    delegate_user_3: int = 10_006
    delegate_user_4: int = 10_007
    delegate_user_5: int = 10_008

    building: int = 20_001
    room: int = 20_002
    cabinet: int = 20_003
    remote_location: int = 20_004

    electronics: int = 30_001
    computers: int = 30_002
    accessories: int = 30_003

    laptop: int = 40_001
    laptop_uuid: UUID = UUID("00000000-0000-0000-0000-000000040001")
    projector: int = 40_002
    projector_uuid: UUID = UUID("00000000-0000-0000-0000-000000040002")
    adapter: int = 40_003
    adapter_uuid: UUID = UUID("00000000-0000-0000-0000-000000040003")

    laptop_history: int = 50_001
    projector_history: int = 50_002
    adapter_history: int = 50_003

    projector_acl_edit_attachments: int = 60_001
    projector_acl_auto_approved_loan: int = 60_002

    guest_user: int = 60_001


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

    extra_users = (
        (
            SEED_IDS.delegate_user_1,
            "piotr.seed@example.com",
            {"first_name": "Piotr", "last_name": "Kowalski", "role": UserRole.USER, "status": UserStatus.ACTIVE},
        ),
        (
            SEED_IDS.delegate_user_2,
            "maria.seed@example.com",
            {"first_name": "Maria", "last_name": "Nowak", "role": UserRole.USER, "status": UserStatus.ACTIVE},
        ),
        (
            SEED_IDS.delegate_user_3,
            "tomek.seed@example.com",
            {"first_name": "Tomek", "last_name": "Wiśniewski", "role": UserRole.USER, "status": UserStatus.ACTIVE},
        ),
        (
            SEED_IDS.delegate_user_4,
            "ewa.seed@example.com",
            {"first_name": "Ewa", "last_name": "Zielińska", "role": UserRole.USER, "status": UserStatus.ACTIVE},
        ),
        (
            SEED_IDS.delegate_user_5,
            "adam.seed@example.com",
            {"first_name": "Adam", "last_name": "Testowy", "role": UserRole.USER, "status": UserStatus.ACTIVE},
        ),
    )
    for user_id, email, values in extra_users:
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
        Location,
        SEED_IDS.remote_location,
        select(Location).where(Location.parent_id.is_(None), Location.name == "Lokalizacja zewnętrzna"),
        name="Lokalizacja zewnętrzna",
        type=LocationType.REMOTE,
        description="Przykładowa lokalizacja poza strukturą budynków AGH",
        address="ul. Przykładowa 1, 30-001 Kraków",
        parent_id=None,
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
            SEED_IDS.laptop_uuid,
            {
                "name": "Laptop developerski",
                "location_id": SEED_IDS.cabinet,
                "category_id": SEED_IDS.computers,
                "owner_id": SEED_IDS.regular_user,
                "status": ItemStatus.AVAILABLE,
                "description": "Przykładowy przedmiot dostępny do wypożyczenia",
                "oldID": SEED_LAPTOP_OLD_ID,
                "parameters": SEED_LAPTOP_PARAMETERS,
            },
        ),
        (
            SEED_IDS.projector,
            SEED_IDS.projector_uuid,
            {
                "name": "Projektor",
                "location_id": SEED_IDS.room,
                "category_id": SEED_IDS.electronics,
                "owner_id": SEED_IDS.admin_user,
                "status": ItemStatus.AVAILABLE,
                "description": "Przykładowy projektor",
                "oldID": SEED_PROJECTOR_OLD_ID,
                "parameters": SEED_PROJECTOR_PARAMETERS,
            },
        ),
        (
            SEED_IDS.adapter,
            SEED_IDS.adapter_uuid,
            {
                "name": "Adapter USB-C",
                "location_id": SEED_IDS.cabinet,
                "category_id": SEED_IDS.accessories,
                "owner_id": SEED_IDS.regular_user,
                "status": ItemStatus.BROKEN,
                "description": "Przykładowy uszkodzony przedmiot",
                "oldID": SEED_ADAPTER_OLD_ID,
                "parameters": SEED_ADAPTER_PARAMETERS,
            },
        ),
    )
    for item_id, item_uuid, values in items:
        _upsert(
            session,
            Item,
            item_id,
            select(Item).where(Item.uuid == item_uuid),
            uuid=item_uuid,
            **values,
        )

    session.flush()

    item_histories = (
        (
            SEED_IDS.laptop_history,
            SEED_IDS.laptop,
            SEED_IDS.regular_user,
            "Laptop developerski utworzony w seedzie",
        ),
        (
            SEED_IDS.projector_history,
            SEED_IDS.projector,
            SEED_IDS.admin_user,
            "Projektor utworzony w seedzie",
        ),
        (
            SEED_IDS.adapter_history,
            SEED_IDS.adapter,
            SEED_IDS.regular_user,
            "Adapter USB-C utworzony w seedzie",
        ),
    )
    for history_id, item_id, updated_by, description in item_histories:
        _upsert(
            session,
            ItemHistory,
            history_id,
            select(ItemHistory).where(
                ItemHistory.item_id == item_id,
                ItemHistory.change_type == ItemChangeLogType.CREATED,
            ),
            item_id=item_id,
            updated_at=SEED_ITEM_HISTORY_AT,
            updated_by=updated_by,
            change_type=ItemChangeLogType.CREATED,
            description=description,
        )

    _upsert(
        session,
        User,
        SEED_IDS.guest_user,
        select(User).where(
            User.role == UserRole.GUEST,
            User.first_name == "Grzegorz",
            User.last_name == "Gość",
        ),
        email="guest.seed@example.com",
        first_name="Grzegorz",
        last_name="Gość",
        role=UserRole.GUEST,
        status=UserStatus.ACTIVE,
    )

    item_acl_entries = (
        (
            SEED_IDS.projector_acl_auto_approved_loan,
            SEED_IDS.projector,
            SEED_IDS.regular_user,
            ItemPermissionType.AUTO_APPROVED_LOAN,
        ),
    )
    for acl_id, item_id, user_id, permission in item_acl_entries:
        _upsert(
            session,
            ItemACL,
            acl_id,
            select(ItemACL).where(
                ItemACL.item_id == item_id,
                ItemACL.user_id == user_id,
                ItemACL.permission == permission,
            ),
            item_id=item_id,
            user_id=user_id,
            permission=permission,
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
