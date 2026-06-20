from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.auth.constants import UserRole
from src.items.constants import ItemChangeLogType, ItemStatus
from src.items.models import Item, ItemHistory
from src.loans.constants import LoanStatus
from src.loans.exceptions import (
    ItemNotAvailableError,
    LoanAlreadyReturnedError,
    LoanBorrowerNotFoundError,
    LoanBorrowerNotGuestError,
    LoanItemNotFoundError,
    LoanNotFoundError,
)
from src.loans.models import Loan
from src.users.models import User
from src.utils import now


class LoanService:
    def __init__(self, db: Session):
        self.db = db

    def register_loan(
        self,
        *,
        item_id: int,
        borrower_id: int,
        registered_by_id: int,
        declared_return_date: datetime,
        loan_purpose: str | None,
    ) -> Loan:
        """Zarejestruj wypożyczenie obiektu Gościowi.

        Tworzy rekord wypożyczenia, oznacza przedmiot jako wypożyczony i dopisuje
        wpis do historii przedmiotu – wszystko w jednej transakcji.
        """
        item = self.db.get(Item, item_id)
        if item is None:
            raise LoanItemNotFoundError()

        if item.status != ItemStatus.AVAILABLE:
            raise ItemNotAvailableError()

        borrower = self.db.get(User, borrower_id)
        if borrower is None:
            raise LoanBorrowerNotFoundError()
        if borrower.role != UserRole.GUEST:
            raise LoanBorrowerNotGuestError()

        loan = Loan(
            item_id=item_id,
            borrower_id=borrower_id,
            registered_by=registered_by_id,
            created_at=now(),
            declared_return_date=declared_return_date,
            loan_purpose=loan_purpose,
            returned_at=None,
            status=LoanStatus.ACTIVE,
        )
        self.db.add(loan)

        item.status = ItemStatus.LOANED

        self.db.add(
            ItemHistory(
                item_id=item_id,
                updated_at=now(),
                updated_by=registered_by_id,
                change_type=ItemChangeLogType.LOANED,
                description=f"Wypożyczono Gościowi (id={borrower_id}) do {declared_return_date.isoformat()}",
            )
        )

        self.db.commit()
        self.db.refresh(loan)
        return loan

    def return_loan(self, loan_id: int, returned_by_id: int) -> Loan:
        """Oznacz wypożyczenie jako zwrócone i przywróć dostępność przedmiotu."""
        loan = self.db.get(Loan, loan_id)
        if loan is None:
            raise LoanNotFoundError()

        if loan.status == LoanStatus.RETURNED:
            raise LoanAlreadyReturnedError()

        loan.status = LoanStatus.RETURNED
        loan.returned_at = now()

        item = self.db.get(Item, loan.item_id)
        if item is not None:
            item.status = ItemStatus.AVAILABLE
            self.db.add(
                ItemHistory(
                    item_id=item.id,
                    updated_at=now(),
                    updated_by=returned_by_id,
                    change_type=ItemChangeLogType.RETURNED,
                    description=f"Zwrot wypożyczenia (id={loan.id}) od Gościa (id={loan.borrower_id})",
                )
            )

        self.db.commit()
        self.db.refresh(loan)
        return loan

    def get_loan(self, loan_id: int) -> Loan:
        loan = self.db.get(Loan, loan_id)
        if loan is None:
            raise LoanNotFoundError()
        return loan

    def list_loans(
        self,
        *,
        page: int,
        limit: int,
        item_id: int | None = None,
        borrower_id: int | None = None,
        status: LoanStatus | None = None,
    ) -> tuple[list[Loan], int]:
        filters = []
        if item_id is not None:
            filters.append(Loan.item_id == item_id)
        if borrower_id is not None:
            filters.append(Loan.borrower_id == borrower_id)
        if status is not None:
            filters.append(Loan.status == status)

        total_count = self.db.scalar(select(func.count(Loan.id)).where(*filters)) or 0

        loans = (
            self.db.execute(
                select(Loan)
                .where(*filters)
                .order_by(Loan.created_at.desc(), Loan.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
            .scalars()
            .all()
        )

        return list(loans), total_count
