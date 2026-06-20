from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse

from src.auth.constants import UserRole
from src.auth.dependencies import CurrentUser
from src.auth.schemas import UserID
from src.dependencies import DBDep
from src.items.attachment_service import (
    AttachmentNotFoundError,
    AttachmentTooLargeError,
    ItemAttachmentService,
    ItemNotFoundError,
)
from src.items.constants import ItemStatus
from src.items.helpers import build_location_path
from src.items.models import Item
from src.items.schemas import (
    CategoryID,
    ItemAttachmentsListResponse,
    ItemCategory,
from fastapi import APIRouter, Depends, HTTPException, status

from src.dependencies import DBDep
from src.items.schemas import (
    ItemCreate,
    ItemCreateResponse,
    ItemGetResponse,
    ItemHistoryGetResponse,
    ItemID,
    ItemSearch,
    ItemsPaged,
    ItemUpdate,
    ItemUpdateResponse,
)
from src.items.service import ItemService
from src.schemas import ErrorResponse
from src.users.models import User

router = APIRouter(prefix="/items")


def _ensure_item_owner(item_id: int, user: User, db: DBDep) -> None:
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    if item.owner_id != user.id and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only item owner can manage attachments")


@router.get(
    "",
    response_model=ItemsPaged,
    status_code=status.HTTP_200_OK,
    summary="Wylistuj przedmioty",
    responses={
        status.HTTP_200_OK: {
            "model": ItemsPaged,
            "description": "Pomyślnie zwrócono listę przedmiotów na podstawie zadanego filtru",
        }
    },
)
def read_items(
    db: DBDep,
    data: Annotated[ItemSearch, Depends()],
) -> ItemsPaged:
    return ItemService(db).search_items(data)


@router.post(
    "",
    response_model=ItemCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Dodaj przedmiot do inwentaryzacji",
    responses={
        status.HTTP_201_CREATED: {
            "model": ItemCreateResponse,
            "description": "Pomyślnie dodano przedmiot",
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "Błędne dane lub nieistniejące powiązania",
        },
    },
)
def create_item(
    data: ItemCreate,
    db: DBDep,
) -> ItemCreateResponse:
    service = ItemService(db)

    try:
        return service.add_item(data)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err


@router.get(
    "/{item_id}",
    response_model=ItemGetResponse,
    status_code=status.HTTP_200_OK,
    summary="Pobierz szczegóły przedmiotu",
    responses={
        status.HTTP_200_OK: {
            "model": ItemGetResponse,
            "description": "Pomyślnie zwrócono szczegóły przedmiotu",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Nie znaleziono przedmiotu",
        },
    },
)
def read_item(
    item_id: ItemID,
    db: DBDep,
) -> ItemGetResponse:
    service = ItemService(db)

    try:
        return service.get_item(item_id)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono przedmiotu",
        ) from err


@router.patch(
    "/{item_id}",
    response_model=ItemUpdateResponse,
    status_code=status.HTTP_200_OK,
    summary="Aktualizuj dane przedmiotu",
    responses={
        status.HTTP_200_OK: {
            "model": ItemUpdateResponse,
            "description": "Dane przedmiotu zostały zaktualizowane.",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Nie znaleziono przedmiotu.",
        },
    },
)
def update_item(
    item_id: ItemID,
    data: ItemUpdate,
    db: DBDep,
) -> ItemUpdateResponse:
    service = ItemService(db)

    try:
        return service.update_item(item_id, data)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono przedmiotu",
        ) from err


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Usuń przedmiot",
    responses={
        status.HTTP_204_NO_CONTENT: {
            "description": "Przedmiot został usunięty",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Nie znaleziono przedmiotu",
        },
    },
)
def delete_item(
    item_id: ItemID,
    db: DBDep,
) -> None:
    service = ItemService(db)

    try:
        service.delete_item(item_id)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        ) from err


@router.get(
    "/{item_id}/history",
    summary="Pobierz historię przedmiotu",
    status_code=status.HTTP_200_OK,
    response_model=ItemHistoryGetResponse,
    responses={
        status.HTTP_404_NOT_FOUND: {
            "description": "Nie znaleziono przedmiotu",
        },
    },
)
def read_item_history(
    item_id: ItemID,
    db: DBDep,
) -> ItemHistoryGetResponse:
    service = ItemService(db)

    try:
        return service.get_item_history(item_id)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono przedmiotu",
        ) from err

    return [
        ItemHistoryEntry(
            id=entry.id,
            updated_at=entry.updated_at,
            updated_by=entry.updated_by,
            change_type=entry.change_type,
            description=entry.description,
        )
        for entry in history
    ]


@router.get(
    "/{item_id}/attachments",
    response_model=ItemAttachmentsListResponse,
    status_code=status.HTTP_200_OK,
    summary="Wylistuj załączniki przedmiotu",
    responses={
        status.HTTP_200_OK: {
            "model": ItemAttachmentsListResponse,
            "description": "Pomyślnie zwrócono listę załączników przedmiotu.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono przedmiotu.",
        },
    },
)
def read_item_attachments(
    item_id: ItemID,
    db: DBDep,
) -> ItemAttachmentsListResponse:
    service = ItemAttachmentService(db)

    try:
        attachments = service.list_attachments(item_id)
    except ItemNotFoundError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        ) from err

    return ItemAttachmentsListResponse(attachments=attachments)


@router.post(
    "/{item_id}/attachments",
    response_model=ItemAttachmentsListResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Dodaj załączniki do przedmiotu",
    responses={
        status.HTTP_201_CREATED: {
            "model": ItemAttachmentsListResponse,
            "description": "Pliki zostały pomyślnie dodane do przedmiotu.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Plik przekracza dozwolony rozmiar.",
        },
        status.HTTP_403_FORBIDDEN: {
            "model": ErrorResponse,
            "description": "Tylko właściciel przedmiotu może dodawać pliki.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono przedmiotu.",
        },
    },
)
def upload_item_attachments(
    item_id: ItemID,
    db: DBDep,
    user: CurrentUser,
    files: Annotated[list[UploadFile], File()],
) -> ItemAttachmentsListResponse:
    _ensure_item_owner(item_id, user, db)
    service = ItemAttachmentService(db)

    try:
        attachments = service.upload_attachments(item_id, user.id, files)
    except ItemNotFoundError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        ) from err
    except AttachmentTooLargeError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attachment exceeds maximum allowed size",
        ) from err

    return ItemAttachmentsListResponse(attachments=attachments)


@router.get(
    "/{item_id}/attachments/{attachment_id}/download",
    status_code=status.HTTP_200_OK,
    summary="Pobierz załącznik przedmiotu",
    responses={
        status.HTTP_200_OK: {
            "description": "Zwraca plik załącznika.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono przedmiotu lub załącznika.",
        },
    },
)
def download_item_attachment(
    item_id: ItemID,
    attachment_id: int,
    db: DBDep,
) -> FileResponse:
    service = ItemAttachmentService(db)

    try:
        file_path, original_filename, mime_type = service.get_attachment_file(item_id, attachment_id)
    except (ItemNotFoundError, AttachmentNotFoundError) as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found",
        ) from err

    return FileResponse(
        path=file_path,
        filename=original_filename,
        media_type=mime_type,
    )


@router.delete(
    "/{item_id}/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Usuń załącznik przedmiotu",
    responses={
        status.HTTP_204_NO_CONTENT: {
            "description": "Załącznik został usunięty.",
        },
        status.HTTP_403_FORBIDDEN: {
            "model": ErrorResponse,
            "description": "Tylko właściciel przedmiotu może usuwać pliki.",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono przedmiotu lub załącznika.",
        },
    },
)
def delete_item_attachment(
    item_id: ItemID,
    attachment_id: int,
    db: DBDep,
    user: CurrentUser,
) -> None:
    _ensure_item_owner(item_id, user, db)
    service = ItemAttachmentService(db)

    try:
        service.delete_attachment(item_id, attachment_id, user.id)
    except ItemNotFoundError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        ) from err
    except AttachmentNotFoundError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found",
        ) from err
