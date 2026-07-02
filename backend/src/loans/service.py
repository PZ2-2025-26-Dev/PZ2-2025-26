from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.constants import UserRole
from src.items.constants import ItemPermissionType, ItemStatus
from src.items.models import Item, ItemACL
from src.loans.constants import LoanListScope, LoanStatus, ReturnCondition
from src.loans.models import Loan
from src.loans.schemas import (
    LoanBorrowerInfo,
    LoanConfirmReturn,
    LoanCreate,
    LoanCreateExternal,
    LoanDecision,
    LoanItemInfo,
    LoanItemOwner,
    LoanResponse,
    LoanReturn,
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


class BorrowerNotFoundError(LoanError):
    pass


class GuestNotFoundError(BorrowerNotFoundError):
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

    def _has_auto_approval(self, item: Item, user: User) -> bool:
        stmt = select(ItemACL).where(
            ItemACL.item_id == item.id,
            ItemACL.user_id == user.id,
            ItemACL.permission == ItemPermissionType.AUTO_APPROVED_LOAN,
        )
        return self.db.execute(stmt).scalar_one_or_none() is not None

    def _borrower(self, loan: Loan) -> User | None:
        borrower_id = loan.user_id or loan.guest_id
        if borrower_id is None:
            return None
        return self.db.get(User, borrower_id)

    def _build_response(self, loan: Loan) -> LoanResponse:
        item = self.db.get(Item, loan.item_id)
        owner = self.db.get(User, item.owner_id)
        borrower_user = self._borrower(loan)

        borrower = None
        if borrower_user is not None:
            borrower = LoanBorrowerInfo(
                id=borrower_user.id,
                name=self._user_display_name(borrower_user),
                role=borrower_user.role.value,
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
            note=loan.note,
            borrowed_at=loan.borrowed_at,
            returned_at=loan.returned_at,
            decision_by=loan.decision_by,
            decision_at=loan.decision_at,
            decision_comment=loan.decision_comment,
            return_reported_by=loan.return_reported_by,
            return_reported_at=loan.return_reported_at,
            return_condition=loan.return_condition,
            return_note=loan.return_note,
            return_confirmed_by=loan.return_confirmed_by,
            return_confirmed_at=loan.return_confirmed_at,
            return_confirmation_note=loan.return_confirmation_note,
        )

    def _assert_available(self, item: Item) -> None:
        if item.status != ItemStatus.AVAILABLE:
            raise ItemNotAvailableError("Przedmiot nie jest dostępny do wypożyczenia")

    def _assert_borrower_is_not_owner(self, item: Item, borrower_user_id: int) -> None:
        if item.owner_id == borrower_user_id:
            raise AccessDeniedError("Właściciel nie może wypożyczyć własnego przedmiotu")

    def _get_regular_borrower(self, borrower_user_id: int) -> User:
        borrower = self.db.get(User, borrower_user_id)
        if borrower is None or borrower.role != UserRole.USER:
            raise BorrowerNotFoundError("Nie znaleziono użytkownika wypożyczającego")
        return borrower

    def _get_guest_borrower(self, guest_id: int) -> User:
        guest = self.db.get(User, guest_id)
        if guest is None or guest.role != UserRole.GUEST:
            raise GuestNotFoundError("Nie znaleziono gościa")
        return guest

    def _set_item_after_return(self, item: Item, condition: ReturnCondition) -> None:
        if condition == ReturnCondition.OK:
            item.status = ItemStatus.AVAILABLE
        elif condition == ReturnCondition.BROKEN:
            item.status = ItemStatus.BROKEN
        else:
            item.status = ItemStatus.MISSING

    def create_loan(self, data: LoanCreate, user: User) -> LoanResponse:
        item = self._get_item_by_uuid(data.item_id)
        self._assert_available(item)

        owner_creates_for_other = data.borrower_user_id is not None or data.guest_id is not None
        if owner_creates_for_other:
            if not self._is_owner_or_admin(user, item):
                raise AccessDeniedError("Tylko właściciel przedmiotu może wypożyczyć go innej osobie")
            borrower_user_id = data.borrower_user_id
            guest_id = data.guest_id
            if borrower_user_id is not None:
                self._assert_borrower_is_not_owner(item, borrower_user_id)
                self._get_regular_borrower(borrower_user_id)
            if guest_id is not None:
                self._get_guest_borrower(guest_id)

            ts = now()
            loan = Loan(
                item_id=item.id,
                user_id=borrower_user_id,
                guest_id=guest_id,
                created_at=ts,
                declared_return_date=data.declared_return_date,
                note=data.note,
                status=LoanStatus.ACTIVE,
                borrowed_at=ts,
                decision_by=user.id,
                decision_at=ts,
            )
            item.status = ItemStatus.LOANED
        else:
            self._assert_borrower_is_not_owner(item, user.id)
            status = LoanStatus.PENDING_APPROVAL
            item_status = ItemStatus.PENDING_APPROVAL
            ts = now()
            decision_by = None
            decision_at = None
            if self._has_auto_approval(item, user):
                status = LoanStatus.ACTIVE
                item_status = ItemStatus.LOANED
                decision_by = item.owner_id
                decision_at = ts

            loan = Loan(
                item_id=item.id,
                user_id=user.id,
                guest_id=None,
                created_at=ts,
                declared_return_date=data.declared_return_date,
                note=data.note,
                status=status,
                borrowed_at=ts if status == LoanStatus.ACTIVE else None,
                decision_by=decision_by,
                decision_at=decision_at,
            )
            item.status = item_status

        self.db.add(loan)
        self.db.commit()
        self.db.refresh(loan)
        return self._build_response(loan)

    def create_external_loan(self, data: LoanCreateExternal, owner: User) -> LoanResponse:
        return self.create_loan(
            LoanCreate(
                item_id=data.item_id,
                guest_id=data.guest_id,
                declared_return_date=data.declared_return_date,
                note=data.note,
            ),
            owner,
        )

    def decide_loan(self, loan_id: int, user: User, data: LoanDecision) -> LoanResponse:
        loan = self._get_loan(loan_id)
        item = self.db.get(Item, loan.item_id)

        if not self._is_owner_or_admin(user, item):
            raise AccessDeniedError("Tylko właściciel przedmiotu może zatwierdzać wnioski")
        if loan.status != LoanStatus.PENDING_APPROVAL:
            raise InvalidLoanStatusError("Wniosek nie jest w statusie oczekującym na akceptację")

        ts = now()
        loan.decision_by = user.id
        loan.decision_at = ts
        loan.decision_comment = data.note

        if data.approved:
            loan.status = LoanStatus.ACTIVE
            loan.borrowed_at = ts
            item.status = ItemStatus.LOANED
        else:
            loan.status = LoanStatus.REJECTED
            item.status = ItemStatus.AVAILABLE

        self.db.commit()
        self.db.refresh(loan)
        return self._build_response(loan)

    def approve_loan(self, loan_id: int, user: User, data: LoanDecision) -> LoanResponse:
        return self.decide_loan(loan_id, user, data)

    def deny_loan(self, loan_id: int, user: User, data: LoanDecision) -> LoanResponse:
        data.approved = False
        return self.decide_loan(loan_id, user, data)

    def return_loan(self, loan_id: int, user: User, data: LoanReturn) -> LoanResponse:
        loan = self._get_loan(loan_id)
        item = self.db.get(Item, loan.item_id)

        if loan.status != LoanStatus.ACTIVE:
            raise InvalidLoanStatusError("Przedmiot musi mieć aktywne wypożyczenie")

        is_borrower = loan.user_id == user.id
        is_owner = self._is_owner_or_admin(user, item)
        if not is_borrower and not is_owner:
            raise AccessDeniedError("Zwrot może zgłosić wypożyczający albo właściciel przedmiotu")

        ts = now()
        loan.return_reported_by = user.id
        loan.return_reported_at = ts
        loan.return_condition = data.condition
        loan.return_note = data.note

        if is_owner:
            loan.status = LoanStatus.CLOSED
            loan.returned_at = ts
            loan.return_confirmed_by = user.id
            loan.return_confirmed_at = ts
            loan.return_confirmation_note = data.note
            self._set_item_after_return(item, data.condition)
        else:
            loan.status = LoanStatus.RETURN_PENDING_CONFIRMATION

        self.db.commit()
        self.db.refresh(loan)
        return self._build_response(loan)

    def confirm_return(self, loan_id: int, user: User, data: LoanConfirmReturn) -> LoanResponse:
        loan = self._get_loan(loan_id)
        item = self.db.get(Item, loan.item_id)

        if not self._is_owner_or_admin(user, item):
            raise AccessDeniedError("Tylko właściciel przedmiotu może potwierdzać zwrot")
        if loan.status != LoanStatus.RETURN_PENDING_CONFIRMATION:
            raise InvalidLoanStatusError("Zwrot nie oczekuje na potwierdzenie")

        if data.approved:
            condition = data.condition or loan.return_condition
            if condition is None:
                raise InvalidLoanStatusError("Brak stanu przedmiotu do potwierdzenia")
            loan.status = LoanStatus.CLOSED
            loan.returned_at = now()
            loan.return_condition = condition
            loan.return_confirmed_by = user.id
            loan.return_confirmed_at = now()
            loan.return_confirmation_note = data.note
            self._set_item_after_return(item, condition)
        else:
            loan.status = LoanStatus.ACTIVE
            loan.return_reported_by = None
            loan.return_reported_at = None
            loan.return_condition = None
            loan.return_note = None
            loan.return_confirmation_note = data.note

        self.db.commit()
        self.db.refresh(loan)
        return self._build_response(loan)

    def list_loans(
        self,
        user: User,
        loan_status: LoanStatus | None = None,
        scope: LoanListScope = LoanListScope.MY,
    ) -> list[LoanResponse]:
        stmt = select(Loan)

        if scope == LoanListScope.ALL:
            if user.role not in (UserRole.ADMIN, UserRole.OBSERVER):
                raise AccessDeniedError("Brak uprawnień do wyświetlenia wszystkich wypożyczeń")
        elif scope == LoanListScope.OWNED:
            if user.role not in (UserRole.ADMIN, UserRole.USER):
                return []
            owned_items_subq = select(Item.id).where(Item.owner_id == user.id).scalar_subquery()
            stmt = stmt.where(Loan.item_id.in_(owned_items_subq))
        else:
            stmt = stmt.where(Loan.user_id == user.id)

        if loan_status is not None:
            stmt = stmt.where(Loan.status == loan_status)

        stmt = stmt.order_by(Loan.created_at.desc())
        loans = self.db.execute(stmt).scalars().all()
        return [self._build_response(loan) for loan in loans]

    def get_loan(self, loan_id: int, user: User) -> LoanResponse:
        loan = self._get_loan(loan_id)
        item = self.db.get(Item, loan.item_id)

        if user.role == UserRole.OBSERVER:
            return self._build_response(loan)

        if user.role != UserRole.ADMIN:
            is_borrower = loan.user_id == user.id or loan.guest_id == user.id
            is_owner = item.owner_id == user.id
            if not is_borrower and not is_owner:
                raise AccessDeniedError("Brak dostępu do tego wypożyczenia")

        return self._build_response(loan)
