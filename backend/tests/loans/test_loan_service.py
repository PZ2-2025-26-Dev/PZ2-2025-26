from datetime import date, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.constants import UserRole, UserStatus
from src.auth.schemas import User
from src.categories.models import Category
from src.guests.models import Guest
from src.items.constants import ItemChangeLogType, ItemPermissionType, ItemStatus
from src.items.models import Item, ItemACL, ItemHistory
from src.loans.constants import EXTERNAL_LOAN_PURPOSE, LoanStatus
from src.loans.schemas import ExternalLoanCreate
from src.loans.service import (
    LoanConflictError,
    LoanForbiddenError,
    LoanNotFoundError,
    LoanService,
)
from src.locations.constants import LocationType
from src.locations.models import Location
from src.users.models import User as DBUser

pytestmark = pytest.mark.integration


def _create_user(db: Session, *, role: UserRole, email: str) -> DBUser:
    email_name, email_domain = email.split("@", maxsplit=1)
    unique_email = f"{email_name}+{uuid4().hex[:8]}@{email_domain}"
    user = DBUser(
        first_name="Test",
        last_name="User",
        email=unique_email,
        role=role,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.flush()
    return user


def _create_item(db: Session, *, owner_id: int, status: ItemStatus = ItemStatus.AVAILABLE) -> Item:
    category = Category(name=f"Kategoria-{owner_id}-{status.value}", parent_id=None)
    location = Location(
        name=f"Lokacja-{owner_id}-{status.value}",
        type=LocationType.BUILDING,
        description=None,
        parent_id=None,
        is_active=True,
    )
    db.add_all([category, location])
    db.flush()

    item = Item(
        name=f"Przedmiot-{owner_id}-{status.value}",
        inventory_number=uuid4(),
        location_id=location.id,
        category_id=category.id,
        owner_id=owner_id,
        status=status,
        description="Testowy przedmiot",
    )
    db.add(item)
    db.flush()
    return item


def _create_guest(db: Session, *, registered_by: int, email: str = "guest@example.com") -> Guest:
    guest = Guest(
        first_name="Jan",
        last_name="Gosc",
        email=email,
        registered_by=registered_by,
        description="Gość testowy",
    )
    db.add(guest)
    db.flush()
    return guest


def _external_loan_payload(item_id: int, guest_id: int) -> ExternalLoanCreate:
    return ExternalLoanCreate(
        itemId=item_id,
        guestId=guest_id,
        declaredReturnDate=date.today() + timedelta(days=7),
    )


def test_create_external_loan_success_for_item_owner(db: Session):
    owner = _create_user(db, role=UserRole.USER, email="owner-loan@example.com")
    guest = _create_guest(db, registered_by=owner.id)
    item = _create_item(db, owner_id=owner.id)
    db.commit()

    service = LoanService(db)
    loan = service.create_external_loan(
        _external_loan_payload(item_id=item.id, guest_id=guest.id),
        current_user=User(id=owner.id, role=owner.role),
    )

    refreshed_item = db.get(Item, item.id)
    history_entry = db.execute(select(ItemHistory).where(ItemHistory.item_id == item.id)).scalar_one()

    assert loan.id is not None
    assert loan.item_id == item.id
    assert loan.guest_id == guest.id
    assert loan.user_id is None
    assert loan.loan_purpose == EXTERNAL_LOAN_PURPOSE
    assert loan.status == LoanStatus.LOANED
    assert loan.decision_by == owner.id
    assert refreshed_item is not None
    assert refreshed_item.status == ItemStatus.LOANED
    assert history_entry.change_type == ItemChangeLogType.LOANED
    assert f"guest_id={guest.id}" in (history_entry.description or "")


def test_create_external_loan_raises_when_item_not_available(db: Session):
    owner = _create_user(db, role=UserRole.USER, email="owner-not-available@example.com")
    guest = _create_guest(db, registered_by=owner.id, email="guest-not-available@example.com")
    item = _create_item(db, owner_id=owner.id, status=ItemStatus.LOANED)
    db.commit()

    service = LoanService(db)

    with pytest.raises(LoanConflictError, match="Item is not available for loan"):
        service.create_external_loan(
            _external_loan_payload(item_id=item.id, guest_id=guest.id),
            current_user=User(id=owner.id, role=owner.role),
        )


def test_create_external_loan_raises_when_user_has_no_permission(db: Session):
    owner = _create_user(db, role=UserRole.USER, email="owner-no-perm@example.com")
    operator = _create_user(db, role=UserRole.USER, email="operator-no-perm@example.com")
    guest = _create_guest(db, registered_by=owner.id, email="guest-no-perm@example.com")
    item = _create_item(db, owner_id=owner.id)
    db.commit()

    service = LoanService(db)

    with pytest.raises(LoanForbiddenError, match="User is not allowed to create this loan"):
        service.create_external_loan(
            _external_loan_payload(item_id=item.id, guest_id=guest.id),
            current_user=User(id=operator.id, role=operator.role),
        )


def test_create_external_loan_success_with_acl_permission(db: Session):
    owner = _create_user(db, role=UserRole.USER, email="owner-acl@example.com")
    operator = _create_user(db, role=UserRole.USER, email="operator-acl@example.com")
    guest = _create_guest(db, registered_by=owner.id, email="guest-acl@example.com")
    item = _create_item(db, owner_id=owner.id)
    db.flush()

    acl = ItemACL(item_id=item.id, user_id=operator.id, permission=ItemPermissionType.AUTO_APPROVED_LOAN)
    db.add(acl)
    db.commit()

    service = LoanService(db)
    loan = service.create_external_loan(
        _external_loan_payload(item_id=item.id, guest_id=guest.id),
        current_user=User(id=operator.id, role=operator.role),
    )

    assert loan.id is not None
    assert loan.item_id == item.id
    assert loan.guest_id == guest.id
    assert loan.decision_by == operator.id


def test_create_external_loan_raises_when_item_not_found(db: Session):
    owner = _create_user(db, role=UserRole.USER, email="owner-missing-item@example.com")
    guest = _create_guest(db, registered_by=owner.id, email="guest-missing-item@example.com")
    db.commit()

    service = LoanService(db)

    with pytest.raises(LoanNotFoundError, match="Item not found"):
        service.create_external_loan(
            _external_loan_payload(item_id=999_999, guest_id=guest.id),
            current_user=User(id=owner.id, role=owner.role),
        )


def test_create_external_loan_raises_when_guest_not_found(db: Session):
    owner = _create_user(db, role=UserRole.USER, email="owner-missing-guest@example.com")
    item = _create_item(db, owner_id=owner.id)
    db.commit()

    service = LoanService(db)

    with pytest.raises(LoanNotFoundError, match="Guest not found"):
        service.create_external_loan(
            _external_loan_payload(item_id=item.id, guest_id=999_999),
            current_user=User(id=owner.id, role=owner.role),
        )
