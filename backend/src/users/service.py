from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.auth.constants import UserRole, UserStatus
from src.auth.models import UserAccount
from src.items.models import Item, ItemACL, ItemHistory
from src.loans.models import Loan
from src.users.models import User
from src.users.schemas import BaseUserDetails


class UserNotFoundError(Exception):
    pass


class InvalidUserApprovalRoleError(Exception):
    pass


class UserOwnsItemsError(Exception):
    pass


class UserHasHistoricalReferencesError(Exception):
    pass


class UserService:
    def __init__(self, db: Session):
        self.db = db

    def list_users(
        self,
        *,
        page: int,
        limit: int,
        role: UserRole | None = None,
        status: UserStatus | None = None,
        search: str | None = None,
    ) -> tuple[list[User], int]:
        # Goście są zarządzani osobnym endpointem (/guests) i nie pojawiają się
        # na liście "zwykłych" użytkowników.
        filters = [User.role != UserRole.GUEST]

        if role is not None:
            filters.append(User.role == role)

        if status is not None:
            filters.append(User.status == status)

        if search is not None:
            search_pattern = f"%{search.lower()}%"
            filters.append(
                or_(
                    func.lower(User.first_name).like(search_pattern),
                    func.lower(User.last_name).like(search_pattern),
                    func.lower(User.email).like(search_pattern),
                )
            )

        total_count = self.db.scalar(select(func.count(User.id)).where(*filters)) or 0
        users = (
            self.db.execute(select(User).where(*filters).order_by(User.id).offset((page - 1) * limit).limit(limit))
            .scalars()
            .all()
        )

        return list(users), total_count

    def get_user(self, user_id: int) -> User:
        user = self.db.get(User, user_id)

        if user is None:
            raise UserNotFoundError()

        return user

    def update_user(self, user_id: int, data: BaseUserDetails) -> User:
        user = self.get_user(user_id)

        if (
            user.status == UserStatus.PENDING_APPROVAL
            and data.status == UserStatus.ACTIVE
            and data.role not in {UserRole.USER, UserRole.OBSERVER}
        ):
            raise InvalidUserApprovalRoleError()

        user.email = data.email
        user.first_name = data.first_name
        user.last_name = data.last_name
        user.role = data.role
        user.status = data.status

        self.db.commit()
        self.db.refresh(user)

        return user

    def delete_user(self, user_id: int) -> None:
        user = self.get_user(user_id)

        if self._has_records(Item, Item.owner_id == user_id):
            raise UserOwnsItemsError()

        if self._has_historical_references(user_id):
            raise UserHasHistoricalReferencesError()

        self.db.execute(delete(ItemACL).where(ItemACL.user_id == user_id))
        self.db.execute(delete(UserAccount).where(UserAccount.user_id == user_id))
        self.db.delete(user)

        try:
            self.db.commit()
        except IntegrityError as err:
            self.db.rollback()
            raise UserHasHistoricalReferencesError() from err

    def _has_historical_references(self, user_id: int) -> bool:
        return self._has_records(ItemHistory, ItemHistory.updated_by == user_id) or self._has_records(
            Loan, or_(Loan.borrower_id == user_id, Loan.registered_by == user_id)
        )

    def _has_records(self, model: type, condition) -> bool:
        return bool(self.db.scalar(select(model.id).where(condition).limit(1)))

    def update_status(self, user_id: int, status: UserStatus) -> User:
        if status not in {
            UserStatus.ACTIVE,
            UserStatus.BLOCKED,
            UserStatus.REJECTED,
            UserStatus.INACTIVE,
        }:
            raise ValueError("Invalid status")

        user = self.get_user(user_id)
        user.status = status

        self.db.commit()
        self.db.refresh(user)

        return user
