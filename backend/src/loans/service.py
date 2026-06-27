from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from src.auth.constants import UserRole
from src.items.constants import ItemStatus
from src.items.models import Item
from src.loans.constants import LoanStatus
from src.loans.models import Loan
from src.loans.schemas import (
    LoanBorrowerInfo,
    LoanCreate,
    LoanCreateExternal,
    LoanDecision,
    LoanItemInfo,
    LoanItemOwner,
    LoanResponse,
)
from src.users.models import User
from src.utils import now


class LoanError(Exception):
    pass


class ItemNotFoundError(LoanError):
    pass


class LoanNotFoundError(LoanError):
    pass


class ItemNotAvailableError(LoanError):
    pass


class AccessDeniedError(LoanError):
    pass


class InvalidLoanStatusError(LoanError):
    pass


class GuestNotFoundError(LoanError):
    pass


class LoanService:
    def __init__(self, db: Session):
        self.db = db

    def _get_item_by_uuid(self, item_uuid: UUID) -> Item:
        item = self.db.execute(select(Item).where(Item.uuid == item_uuid)).scalar_one_or_none()
        if item is None:
            raise ItemNotFoundError()
        return item

    def _get_loan(self, loan_id: int) -> Loan:
        loan = self.db.get(Loan, loan_id)
        if loan is None:
            raise LoanNotFoundError()
        return loan

    def _user_display_name(self, user: User) -> str:
        if user.last_name:
            return f"{user.first_name} {user.last_name}"
        return user.first_name

    def _is_owner_or_admin(self, user: User, item: Item) -> bool:
        return user.role == UserRole.ADMIN or item.owner_id == user.id

    def _build_response(self, loan: Loan) -> LoanResponse:
        item = self.db.execute(select(Item).where(Item.id == loan.item_id)).scalar_one()
        owner = self.db.get(User, item.owner_id)

        borrower = None
        borrower_id = loan.user_id or loan.guest_id
        if borrower_id:
            borrower_user = self.db.get(User, borrower_id)
            if borrower_user:
                borrower = LoanBorrowerInfo(
                    id=borrower_user.id,
                    name=self._user_display_name(borrower_user),
                )

        return LoanResponse(
            id=loan.id,
            item=LoanItemInfo(
                id=item.uuid,
                name=item.name,
                owner=LoanItemOwner(
                    id=owner.id,
                    name=self._user_display_name(owner),
                ),
            ),
            borrower=borrower,
            status=loan.status,
            is_external=loan.guest_id is not None,
            created_at=loan.created_at,
            declared_return_date=loan.declared_return_date,
            loan_purpose=loan.loan_purpose,
            borrowed_at=loan.borrowed_at,
            returned_at=loan.returned_at,
            decision_by=loan.decision_by,
            decision_at=loan.decision_at,
            decision_comment=loan.decision_comment,
        )

    def create_loan(self, data: LoanCreate, user: User) -> LoanResponse:
        item = self._get_item_by_uuid(data.item_id)

        if item.status != ItemStatus.AVAILABLE:
            raise ItemNotAvailableError("Przedmiot nie jest dostępny do wypożyczenia")

        loan = Loan(
            item_id=item.id,
            user_id=user.id,
            guest_id=None,
            created_at=now(),
            declared_return_date=data.declared_return_date,
            loan_purpose=data.loan_purpose,
            status=LoanStatus.PENDING,
        )

        item.status = ItemStatus.PENDING_APPROVAL

        self.db.add(loan)
        self.db.commit()
        self.db.refresh(loan)

        return self._build_response(loan)

    def create_external_loan(self, data: LoanCreateExternal, owner: User) -> LoanResponse:
        item = self._get_item_by_uuid(data.item_id)

        if not self._is_owner_or_admin(owner, item):
            raise AccessDeniedError("Tylko właściciel przedmiotu może tworzyć zewnętrzne wypożyczenia")

        if item.status != ItemStatus.AVAILABLE:
            raise ItemNotAvailableError("Przedmiot nie jest dostępny do wypożyczenia")

        guest = self.db.get(User, data.guest_id)
        if guest is None or guest.role != UserRole.GUEST:
            raise GuestNotFoundError("Nie znaleziono gościa")

        ts = now()
        loan = Loan(
            item_id=item.id,
            user_id=None,
            guest_id=data.guest_id,
            created_at=ts,
            declared_return_date=data.declared_return_date,
            loan_purpose=data.loan_purpose,
            status=LoanStatus.LOANED,
            borrowed_at=ts,
            decision_by=owner.id,
            decision_at=ts,
        )

        item.status = ItemStatus.LOANED

        self.db.add(loan)
        self.db.commit()
        self.db.refresh(loan)

        return self._build_response(loan)

    def approve_loan(self, loan_id: int, user: User, data: LoanDecision) -> LoanResponse:
        loan = self._get_loan(loan_id)
        item = self.db.get(Item, loan.item_id)

        if not self._is_owner_or_admin(user, item):
            raise AccessDeniedError("Tylko właściciel przedmiotu może zatwierdzać wnioski")

        if loan.status != LoanStatus.PENDING:
            raise InvalidLoanStatusError("Wniosek nie jest w statusie oczekującym")

        loan.status = LoanStatus.APPROVED
        loan.decision_by = user.id
        loan.decision_at = now()
        loan.decision_comment = data.comment
        item.status = ItemStatus.RESERVED

        self.db.commit()
        self.db.refresh(loan)

        return self._build_response(loan)

    def deny_loan(self, loan_id: int, user: User, data: LoanDecision) -> LoanResponse:
        loan = self._get_loan(loan_id)
        item = self.db.get(Item, loan.item_id)

        if not self._is_owner_or_admin(user, item):
            raise AccessDeniedError("Tylko właściciel przedmiotu może odrzucać wnioski")

        if loan.status != LoanStatus.PENDING:
            raise InvalidLoanStatusError("Wniosek nie jest w statusie oczekującym")

        loan.status = LoanStatus.DENIED
        loan.decision_by = user.id
        loan.decision_at = now()
        loan.decision_comment = data.comment
        item.status = ItemStatus.AVAILABLE

        self.db.commit()
        self.db.refresh(loan)

        return self._build_response(loan)

    def activate_loan(self, loan_id: int, user: User) -> LoanResponse:
        loan = self._get_loan(loan_id)
        item = self.db.get(Item, loan.item_id)

        if not self._is_owner_or_admin(user, item):
            raise AccessDeniedError("Tylko właściciel przedmiotu może potwierdzać wydanie")

        if loan.status != LoanStatus.APPROVED:
            raise InvalidLoanStatusError("Wniosek musi być zatwierdzony przed potwierdzeniem wydania")

        loan.status = LoanStatus.LOANED
        loan.borrowed_at = now()
        item.status = ItemStatus.LOANED

        self.db.commit()
        self.db.refresh(loan)

        return self._build_response(loan)

    def return_loan(self, loan_id: int, user: User, data: LoanDecision) -> LoanResponse:
        loan = self._get_loan(loan_id)
        item = self.db.get(Item, loan.item_id)

        if not self._is_owner_or_admin(user, item):
            raise AccessDeniedError("Tylko właściciel przedmiotu może potwierdzać zwrot")

        if loan.status != LoanStatus.LOANED:
            raise InvalidLoanStatusError("Przedmiot musi być w statusie wypożyczonego")

        loan.status = LoanStatus.RETURNED
        loan.returned_at = now()
        if data.comment:
            loan.decision_comment = data.comment
        item.status = ItemStatus.AVAILABLE

        self.db.commit()
        self.db.refresh(loan)

        return self._build_response(loan)

    def list_loans(self, user: User, loan_status: LoanStatus | None = None) -> list[LoanResponse]:
        stmt = select(Loan)

        if user.role == UserRole.ADMIN:
            pass
        elif user.role == UserRole.USER:
            owned_items_subq = select(Item.id).where(Item.owner_id == user.id).scalar_subquery()
            stmt = stmt.where(
                or_(
                    Loan.user_id == user.id,
                    Loan.item_id.in_(owned_items_subq),
                )
            )
        else:
            return []

        if loan_status is not None:
            stmt = stmt.where(Loan.status == loan_status)

        stmt = stmt.order_by(Loan.created_at.desc())
        loans = self.db.execute(stmt).scalars().all()

        return [self._build_response(loan) for loan in loans]

    def get_loan(self, loan_id: int, user: User) -> LoanResponse:
        loan = self._get_loan(loan_id)
        item = self.db.get(Item, loan.item_id)

        if user.role != UserRole.ADMIN:
            is_borrower = loan.user_id == user.id or loan.guest_id == user.id
            is_owner = item.owner_id == user.id
            if not is_borrower and not is_owner:
                raise AccessDeniedError("Brak dostępu do tego wypożyczenia")

        return self._build_response(loan)
