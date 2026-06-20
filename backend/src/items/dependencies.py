from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.constants import UserRole
from src.auth.dependencies import CurrentUser
from src.dependencies import DBDep
from src.items.constants import (
    ITEM_UPDATE_CRITICAL_FIELDS,
    ITEM_UPDATE_FIELD_PERMISSIONS,
    ItemPermissionType,
)
from src.items.models import Item, ItemACL
from src.items.schemas import ItemUpdate
from src.users.models import User

_ITEM_READ_ROLES = {UserRole.ADMIN, UserRole.USER, UserRole.OBSERVER}
_ITEM_WRITE_ROLES = {UserRole.ADMIN, UserRole.USER}


def require_item_reader(user: CurrentUser) -> User:
    if user.role not in _ITEM_READ_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Brak uprawnień do przeglądania przedmiotów.",
        )
    return user


def require_item_writer(user: CurrentUser) -> User:
    if user.role not in _ITEM_WRITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Brak uprawnień do modyfikacji przedmiotów.",
        )
    return user


def has_item_permission(
    db: Session,
    item_id: int,
    user_id: int,
    permission: ItemPermissionType,
) -> bool:
    acl = db.execute(
        select(ItemACL).where(
            ItemACL.item_id == item_id,
            ItemACL.user_id == user_id,
            ItemACL.permission == permission,
        )
    ).scalar_one_or_none()
    return acl is not None


def get_item_by_uuid(
    item_id: UUID,
    db: DBDep,
) -> Item:
    item = db.execute(select(Item).where(Item.uuid == item_id)).scalar_one_or_none()

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono przedmiotu",
        )

    return item


def _meaningful_update_fields(data: ItemUpdate, item: Item) -> set[str]:
    fields: set[str] = set()

    if data.name is not None and data.name != item.name:
        fields.add("name")
    if data.description is not None and data.description != item.description:
        fields.add("description")
    if data.category_id is not None and data.category_id != item.category_id:
        fields.add("category_id")
    if data.location_id is not None and data.location_id != item.location_id:
        fields.add("location_id")
    if data.owner_id is not None and data.owner_id != item.owner_id:
        fields.add("owner_id")
    if data.parameters is not None and data.parameters != item.parameters:
        fields.add("parameters")

    return fields


def assert_can_update_item(user: User, item: Item, data: ItemUpdate, db: Session) -> None:
    if data.owner_id is not None and data.owner_id != item.owner_id:
        assert_can_change_owner(user)

    if user.role == UserRole.ADMIN:
        return

    if user.role == UserRole.USER and item.owner_id == user.id:
        return

    if user.role != UserRole.USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Brak uprawnień do modyfikacji tego przedmiotu.",
        )

    updated_fields = _meaningful_update_fields(data, item)
    if not updated_fields:
        return

    _assert_delegated_user_can_update_fields(db, item, user, updated_fields)


def _assert_delegated_user_can_update_fields(
    db: Session,
    item: Item,
    user: User,
    updated_fields: set[str],
) -> None:
    critical_fields = updated_fields & ITEM_UPDATE_CRITICAL_FIELDS
    if critical_fields:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Delegowany użytkownik nie może modyfikować pól krytycznych przedmiotu.",
        )

    for field in updated_fields:
        required_permission = ITEM_UPDATE_FIELD_PERMISSIONS.get(field)
        if required_permission is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Brak uprawnień do modyfikacji tego przedmiotu.",
            )

        if not has_item_permission(db, item.id, user.id, required_permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Brak uprawnienia {required_permission.value} do edycji pola {field}.",
            )


def assert_can_change_owner(user: User) -> None:
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tylko administrator może zmieniać właściciela przedmiotu.",
        )

def assert_can_assign_owner_on_create(user: User, owner_id: int) -> None:
    if user.role == UserRole.ADMIN:
        return

    if user.role == UserRole.USER and owner_id == user.id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Możesz tworzyć przedmioty wyłącznie jako ich właściciel.",
    )


RequireItemReader = Annotated[User, Depends(require_item_reader)]
RequireItemWriter = Annotated[User, Depends(require_item_writer)]
ItemByUuid = Annotated[Item, Depends(get_item_by_uuid)]
