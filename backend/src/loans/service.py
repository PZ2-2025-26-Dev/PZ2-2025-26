from datetime import datetime, time

from sqlalchemy import select
from sqlalchemy.orm import Session
from src.auth.constants import UserRole
from src.auth.schemas import User
from src.guests.models import Guest
from src.items.constants import (ItemChangeLogType, ItemPermissionType,
                                 ItemStatus)
from src.items.models import Item, ItemACL, ItemHistory
from src.loans.constants import EXTERNAL_LOAN_PURPOSE, LoanStatus
from src.loans.models import Loan
from src.loans.schemas import ExternalLoanCreate
from src.utils import now


class LoanNotFoundError(Exception):
    pass


class LoanForbiddenError(Exception):
    pass


class LoanConflictError(Exception):
    pass


class LoanService:
    def __init__(self, session: Session):
        self.session = session

    def create_external_loan(self, data: ExternalLoanCreate, current_user: User) -> Loan:
        declared_return_datetime = datetime.combine(data.declared_return_date, time.max)

        with self.session.begin():
            item = self.session.get(Item, data.item_id)
            if item is None:
                raise LoanNotFoundError("Item not found")

            if item.status != ItemStatus.AVAILABLE:
                raise LoanConflictError("Item is not available for loan")

            guest = self.session.get(Guest, data.guest_id)
            if guest is None:
                raise LoanNotFoundError("Guest not found")

            has_permission = current_user.role == UserRole.ADMIN
            if not has_permission and item.owner_id == current_user.id:
                has_permission = True

            if not has_permission:
                acl_entry = self.session.execute(
                    select(ItemACL).where(
                        ItemACL.item_id == item.id,
                        ItemACL.user_id == current_user.id,
                        ItemACL.permission == ItemPermissionType.AUTO_APPROVED_LOAN,
                    )
                ).scalar_one_or_none()
                has_permission = acl_entry is not None

            if not has_permission:
                raise LoanForbiddenError("User is not allowed to create this loan")

            loan = Loan(
                item_id=item.id,
                user_id=None,
                guest_id=guest.id,
                created_at=now(),
                declared_return_date=declared_return_datetime,
                loan_purpose=EXTERNAL_LOAN_PURPOSE,
                borrowed_at=now(),
                returned_at=None,
                status=LoanStatus.LOANED,
                decision_by=current_user.id,
                decision_at=now(),
                decision_comment=None,
            )
            self.session.add(loan)
            self.session.flush()

            item.status = ItemStatus.LOANED

            history = ItemHistory(
                item_id=item.id,
                updated_at=now(),
                updated_by=current_user.id,
                change_type=ItemChangeLogType.LOANED,
                description=f"External loan created for guest_id={guest.id}, loan_id={loan.id}",
            )
            self.session.add(history)
            self.session.flush()

            return loan
