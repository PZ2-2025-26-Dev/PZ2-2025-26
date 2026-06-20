from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from src.auth.constants import UserRole, UserStatus
from src.guests.exceptions import (
    GuestEmailTakenError,
    GuestHasLoanHistoryError,
    GuestNotFoundError,
)
from src.guests.schemas import GuestCreate, GuestUpdate
from src.users.models import User
from src.users.service import UserHasHistoricalReferencesError, UserOwnsItemsError, UserService


class GuestService:
    def __init__(self, db: Session):
        self.db = db

    def _assert_email_free(self, email: str, exclude_user_id: int | None = None) -> None:
        stmt = select(User.id).where(User.email == email)
        if exclude_user_id is not None:
            stmt = stmt.where(User.id != exclude_user_id)
        if self.db.scalar(stmt.limit(1)) is not None:
            raise GuestEmailTakenError()

    def create_guest(self, data: GuestCreate) -> User:
        """Utwórz Gościa jako użytkownika z rolą GUEST (bez konta logowania)."""
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

    def get_guest(self, guest_id: int) -> User:
        guest = self.db.get(User, guest_id)
        if guest is None or guest.role != UserRole.GUEST:
            raise GuestNotFoundError()
        return guest

    def list_guests(
        self,
        *,
        page: int,
        limit: int,
        search: str | None = None,
    ) -> tuple[list[User], int]:
        filters = [User.role == UserRole.GUEST]

        if search is not None:
            pattern = f"%{search.lower()}%"
            filters.append(
                or_(
                    func.lower(User.first_name).like(pattern),
                    func.lower(User.last_name).like(pattern),
                    func.lower(User.email).like(pattern),
                )
            )

        total_count = self.db.scalar(select(func.count(User.id)).where(*filters)) or 0
        guests = (
            self.db.execute(select(User).where(*filters).order_by(User.id).offset((page - 1) * limit).limit(limit))
            .scalars()
            .all()
        )
        return list(guests), total_count

    def update_guest(self, guest_id: int, data: GuestUpdate) -> User:
        guest = self.get_guest(guest_id)

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

    def delete_guest(self, guest_id: int) -> None:
        # Walidacja roli najpierw – usuwamy wyłącznie Gości tym endpointem.
        self.get_guest(guest_id)

        try:
            # Reużycie logiki kasowania użytkownika (ochrona spójności FK).
            UserService(self.db).delete_user(guest_id)
        except (UserOwnsItemsError, UserHasHistoricalReferencesError) as exc:
            raise GuestHasLoanHistoryError() from exc
