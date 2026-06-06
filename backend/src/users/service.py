from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from src.auth.constants import UserRole, UserStatus
from src.users.models import User


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
        filters = []

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
