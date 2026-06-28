from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.auth.constants import UserRole, UserStatus
from src.auth.models import UserAccount
from src.items.models import Item, ItemACL, ItemHistory
from src.loans.models import Loan
from src.users.models import User
from src.users.schemas import BaseUserDetails, GuestBrowse, GuestUserCreate, GuestUserUpdate, UserBasicBrowse


class UserNotFoundError(Exception):
    pass


class GuestUserNotFoundError(Exception):
    pass


class UserEmailTakenError(Exception):
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

    def _assert_email_free(self, email: str, exclude_user_id: int | None = None) -> None:
        stmt = select(User.id).where(User.email == email)
        if exclude_user_id is not None:
            stmt = stmt.where(User.id != exclude_user_id)
        if self.db.scalar(stmt.limit(1)) is not None:
            raise UserEmailTakenError()

    def _get_guest_user(self, user_id: int) -> User:
        user = self.db.get(User, user_id)
        if user is None or user.role != UserRole.GUEST:
            raise GuestUserNotFoundError()
        return user

    def create_guest_user(self, data: GuestUserCreate) -> User:
        if data.email is not None:
            self._assert_email_free(data.email)

        guest = User(
            first_name=data.first_name,
            last_name=data.last_name,
            email=data.email,
            role=UserRole.GUEST,
            status=UserStatus.ACTIVE,
        )
        self.db.add(guest)
        self.db.commit()
        self.db.refresh(guest)
        return guest

    def update_guest_user(self, user_id: int, data: GuestUserUpdate) -> User:
        guest = self._get_guest_user(user_id)

        if data.email is not None and data.email != guest.email:
            self._assert_email_free(data.email, exclude_user_id=guest.id)
            guest.email = data.email

        if data.first_name is not None:
            guest.first_name = data.first_name

        if data.last_name is not None:
            guest.last_name = data.last_name

        self.db.commit()
        self.db.refresh(guest)
        return guest

    def list_browse_users(
        self,
        *,
        page: int,
        limit: int,
        search: str | None = None,
        role: UserRole | None = None,
    ) -> tuple[list[UserBasicBrowse | GuestBrowse], int]:
        filters = [User.status == UserStatus.ACTIVE]

        if role is not None:
            filters.append(User.role == role)

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
            self.db.execute(
                select(User)
                .where(*filters)
                .order_by(User.first_name, User.last_name)
                .offset((page - 1) * limit)
                .limit(limit)
            )
            .scalars()
            .all()
        )

        result: list[UserBasicBrowse | GuestBrowse] = []
        for user in users:
            if user.role == UserRole.GUEST:
                result.append(
                    GuestBrowse(
                        id=user.id,
                        first_name=user.first_name,
                        last_name=user.last_name,
                        email=user.email,
                        role="guest",
                    )
                )
            elif user.role in {UserRole.ADMIN, UserRole.USER, UserRole.OBSERVER}:
                result.append(
                    UserBasicBrowse(
                        id=user.id,
                        first_name=user.first_name,
                        last_name=user.last_name,
                        role=user.role.value,
                    )
                )

        return result, total_count

    def list_users(
        self,
        *,
        page: int,
        limit: int,
        role: UserRole | None = None,
        status: UserStatus | None = None,
        search: str | None = None,
    ) -> tuple[list[User], int]:
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

        if user.role == UserRole.GUEST:
            raise UserNotFoundError()

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
            Loan, or_(Loan.user_id == user_id, Loan.guest_id == user_id, Loan.decision_by == user_id)
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
