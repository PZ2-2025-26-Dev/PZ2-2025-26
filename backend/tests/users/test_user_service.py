from collections.abc import Iterator
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.auth.constants import AuthProvider, UserRole, UserStatus
from src.auth.models import UserAccount
from src.categories.models import Category
from src.database import Base, engine
from src.items.constants import ItemChangeLogType, ItemPermissionType, ItemStatus
from src.items.models import Item, ItemACL, ItemHistory
from src.locations.constants import LocationType
from src.locations.models import Location
from src.users.models import User
from src.users.schemas import BaseUserDetails
from src.users.service import (
    InvalidUserApprovalRoleError,
    UserHasHistoricalReferencesError,
    UserOwnsItemsError,
    UserService,
)


@pytest.fixture(autouse=True)
def user_tables() -> Iterator[None]:
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def add_users(db: Session) -> None:
    db.add_all(
        [
            User(
                first_name="Anna",
                last_name="Admin",
                email="anna.admin@example.com",
                role=UserRole.ADMIN,
                status=UserStatus.ACTIVE,
            ),
            User(
                first_name="Jan",
                last_name="Kowalski",
                email="jan.kowalski@example.com",
                role=UserRole.USER,
                status=UserStatus.PENDING_APPROVAL,
            ),
            User(
                first_name="Olga",
                last_name="Observer",
                email="olga.observer@example.com",
                role=UserRole.OBSERVER,
                status=UserStatus.INACTIVE,
            ),
        ]
    )
    db.commit()


def add_item(db: Session, owner_id: int) -> Item:
    category = Category(name=f"Category {owner_id}", parent_id=None)
    location = Location(
        name=f"Location {owner_id}",
        type=LocationType.ROOM,
        description=None,
        parent_id=None,
        is_active=True,
    )
    db.add_all([category, location])
    db.flush()

    item = Item(
        name=f"Item {owner_id}",
        inventory_number=uuid4(),
        location_id=location.id,
        category_id=category.id,
        owner_id=owner_id,
        status=ItemStatus.AVAILABLE,
        description=None,
    )
    db.add(item)
    db.commit()

    return item


def test_list_users_filters_by_role(db: Session):
    add_users(db)

    users, total_count = UserService(db).list_users(page=1, limit=20, role=UserRole.ADMIN)

    assert total_count == 1
    assert users[0].email == "anna.admin@example.com"


def test_list_users_filters_by_status(db: Session):
    add_users(db)

    users, total_count = UserService(db).list_users(page=1, limit=20, status=UserStatus.INACTIVE)

    assert total_count == 1
    assert users[0].email == "olga.observer@example.com"


def test_list_users_searches_name_and_email(db: Session):
    add_users(db)

    users_by_last_name, total_by_last_name = UserService(db).list_users(page=1, limit=20, search="kowal")
    users_by_email, total_by_email = UserService(db).list_users(page=1, limit=20, search="observer@example")

    assert total_by_last_name == 1
    assert users_by_last_name[0].email == "jan.kowalski@example.com"
    assert total_by_email == 1
    assert users_by_email[0].email == "olga.observer@example.com"


def test_update_user_updates_user_details(db: Session):
    add_users(db)
    pending_user = db.query(User).filter_by(email="jan.kowalski@example.com").one()

    updated_user = UserService(db).update_user(
        pending_user.id,
        BaseUserDetails(
            email="jan.nowak@example.com",
            first_name="Jan",
            last_name="Nowak",
            role=UserRole.USER,
            status=UserStatus.ACTIVE,
        ),
    )

    assert updated_user.email == "jan.nowak@example.com"
    assert updated_user.last_name == "Nowak"
    assert updated_user.role == UserRole.USER
    assert updated_user.status == UserStatus.ACTIVE


def test_update_pending_user_to_active_requires_user_or_observer_role(db: Session):
    add_users(db)
    pending_user = db.query(User).filter_by(email="jan.kowalski@example.com").one()

    with pytest.raises(InvalidUserApprovalRoleError):
        UserService(db).update_user(
            pending_user.id,
            BaseUserDetails(
                email=pending_user.email,
                first_name=pending_user.first_name,
                last_name=pending_user.last_name,
                role=UserRole.ADMIN,
                status=UserStatus.ACTIVE,
            ),
        )


def test_update_pending_user_to_active_accepts_observer_role(db: Session):
    add_users(db)
    pending_user = db.query(User).filter_by(email="jan.kowalski@example.com").one()

    updated_user = UserService(db).update_user(
        pending_user.id,
        BaseUserDetails(
            email=pending_user.email,
            first_name=pending_user.first_name,
            last_name=pending_user.last_name,
            role=UserRole.OBSERVER,
            status=UserStatus.ACTIVE,
        ),
    )

    assert updated_user.role == UserRole.OBSERVER
    assert updated_user.status == UserStatus.ACTIVE


def test_delete_user_removes_user_accounts_and_item_acl(db: Session):
    add_users(db)
    admin = db.query(User).filter_by(email="anna.admin@example.com").one()
    item_owner = db.query(User).filter_by(email="jan.kowalski@example.com").one()
    item = add_item(db, owner_id=item_owner.id)

    db.add_all(
        [
            UserAccount(
                user_id=admin.id,
                pwd_hash="hash",
                provider=AuthProvider.LOCAL,
                provider_user_id=None,
            ),
            ItemACL(
                item_id=item.id,
                user_id=admin.id,
                permission=ItemPermissionType.EDIT_LOCATION,
            ),
        ]
    )
    db.commit()

    UserService(db).delete_user(admin.id)

    assert db.get(User, admin.id) is None
    assert db.scalar(select(func.count(UserAccount.id)).where(UserAccount.user_id == admin.id)) == 0
    assert db.scalar(select(func.count(ItemACL.id)).where(ItemACL.user_id == admin.id)) == 0


def test_delete_user_rejects_item_owner(db: Session):
    add_users(db)
    owner = db.query(User).filter_by(email="jan.kowalski@example.com").one()
    add_item(db, owner_id=owner.id)

    with pytest.raises(UserOwnsItemsError):
        UserService(db).delete_user(owner.id)


def test_delete_user_rejects_historical_references(db: Session):
    add_users(db)
    history_user = db.query(User).filter_by(email="olga.observer@example.com").one()
    item_owner = db.query(User).filter_by(email="jan.kowalski@example.com").one()
    item = add_item(db, owner_id=item_owner.id)

    db.add(
        ItemHistory(
            item_id=item.id,
            updated_at=datetime.now(tz=UTC),
            updated_by=history_user.id,
            change_type=ItemChangeLogType.CREATED,
            description=None,
        )
    )
    db.commit()

    with pytest.raises(UserHasHistoricalReferencesError):
        UserService(db).delete_user(history_user.id)
