from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.auth.constants import UserRole
from src.items.constants import ItemPermissionType
from src.items.models import Item, ItemACL
from src.items.schemas import ItemACLListResponse, ItemACLResponse, ItemACLUser
from src.users.models import User


class ItemACLService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _user_display_name(user: User) -> str:
        if user.last_name:
            return f"{user.first_name} {user.last_name}"
        return user.first_name

    def _to_response(self, acl: ItemACL) -> ItemACLResponse:
        return ItemACLResponse(
            id=acl.id,
            user_id=acl.user_id,
            user=ItemACLUser(
                id=acl.user.id,
                name=self._user_display_name(acl.user),
            ),
            permission=acl.permission,
        )

    def list_acl(self, item: Item, requesting_user: User) -> ItemACLListResponse:
        stmt = (
            select(ItemACL).where(ItemACL.item_id == item.id).options(selectinload(ItemACL.user)).order_by(ItemACL.id)
        )

        is_manager = requesting_user.role == UserRole.ADMIN or item.owner_id == requesting_user.id
        if not is_manager:
            if requesting_user.role != UserRole.USER:
                raise ValueError("Brak uprawnień do przeglądania listy ACL przedmiotu.")
            stmt = stmt.where(ItemACL.user_id == requesting_user.id)

        entries = self.db.execute(stmt).scalars().all()
        return ItemACLListResponse(entries=[self._to_response(entry) for entry in entries])

    def add_acl(self, item: Item, user_id: int, permission: ItemPermissionType) -> ItemACLResponse:
        target_user = self.db.get(User, user_id)
        if target_user is None:
            raise ValueError("Nie znaleziono użytkownika.")

        if user_id == item.owner_id:
            raise ValueError("Właściciel przedmiotu posiada już pełne uprawnienia.")

        if target_user.role != UserRole.USER:
            raise ValueError("Delegowane uprawnienia można nadawać wyłącznie użytkownikom z rolą user.")

        existing = self.db.execute(
            select(ItemACL).where(
                ItemACL.item_id == item.id,
                ItemACL.user_id == user_id,
                ItemACL.permission == permission,
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise ValueError("To uprawnienie zostało już nadane temu użytkownikowi.")

        acl = ItemACL(
            item_id=item.id,
            user_id=user_id,
            permission=permission,
        )
        self.db.add(acl)
        self.db.commit()
        self.db.refresh(acl)

        acl = self.db.execute(
            select(ItemACL).where(ItemACL.id == acl.id).options(selectinload(ItemACL.user))
        ).scalar_one()

        return self._to_response(acl)

    def remove_acl(self, item: Item, acl_id: int) -> None:
        acl = self.db.execute(
            select(ItemACL).where(
                ItemACL.id == acl_id,
                ItemACL.item_id == item.id,
            )
        ).scalar_one_or_none()

        if acl is None:
            raise ValueError("Nie znaleziono wpisu ACL.")

        self.db.delete(acl)
        self.db.commit()
