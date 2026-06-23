from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from src.auth.dependencies import CurrentUser, RequireAdmin
from src.dependencies import DBDep
from src.items.acl_service import ItemACLService
from src.items.attachment_service import (
    AttachmentNotFoundError,
    AttachmentStorageError,
    AttachmentTooLargeError,
    ItemAttachmentService,
    ItemNotFoundError,
)
from src.items.dependencies import (
    ItemByUuid,
    RequireItemReader,
    RequireItemWriter,
    assert_can_assign_owner_on_create,
    assert_can_manage_item_acl,
    assert_can_manage_item_attachments,
    assert_can_update_item,
)
from src.items.schemas import (
    ItemACLCreate,
    ItemACLListResponse,
    ItemACLResponse,
    ItemAttachmentsListResponse,
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

router = APIRouter(prefix="/items")


@router.get(
    "",
    response_model=ItemsPaged,
    status_code=status.HTTP_200_OK,
    summary="Wylistuj przedmioty",
    responses={
        status.HTTP_200_OK: {
            "model": ItemsPaged,
            "description": "Pomyślnie zwrócono listę przedmiotów na podstawie zadanego filtru",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Brak poprawnego tokena uwierzytelniającego.",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Brak uprawnień do przeglądania przedmiotów.",
        },
    },
)
def read_items(
    db: DBDep,
    data: Annotated[ItemSearch, Depends()],
    _reader: RequireItemReader,
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
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Brak poprawnego tokena uwierzytelniającego.",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Brak uprawnień do tworzenia przedmiotów.",
        },
    },
)
def create_item(
    data: ItemCreate,
    db: DBDep,
    user: RequireItemWriter,
) -> ItemCreateResponse:
    assert_can_assign_owner_on_create(user, data.owner_id)
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
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Brak poprawnego tokena uwierzytelniającego.",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Brak uprawnień do przeglądania przedmiotów.",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Nie znaleziono przedmiotu",
        },
    },
)
def read_item(
    item_id: ItemID,
    db: DBDep,
    _reader: RequireItemReader,
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
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Brak poprawnego tokena uwierzytelniającego.",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Brak uprawnień do modyfikacji przedmiotu.",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Nie znaleziono przedmiotu",
        },
    },
)
def update_item(
    item_id: ItemID,
    data: ItemUpdate,
    db: DBDep,
    user: RequireItemWriter,
    item: ItemByUuid,
) -> ItemUpdateResponse:
    assert_can_update_item(user, item, data, db)
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
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Brak poprawnego tokena uwierzytelniającego.",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Operacja dostępna wyłącznie dla administratora.",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Nie znaleziono przedmiotu",
        },
    },
)
def delete_item(
    item_id: ItemID,
    db: DBDep,
    _admin: RequireAdmin,
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
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Brak poprawnego tokena uwierzytelniającego.",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Brak uprawnień do przeglądania przedmiotów.",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Nie znaleziono przedmiotu",
        },
    },
)
def read_item_history(
    item_id: ItemID,
    db: DBDep,
    _reader: RequireItemReader,
) -> ItemHistoryGetResponse:
    service = ItemService(db)

    try:
        return service.get_item_history(item_id)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono przedmiotu",
        ) from err


@router.get(
    "/{item_id}/acl",
    response_model=ItemACLListResponse,
    status_code=status.HTTP_200_OK,
    summary="Wylistuj uprawnienia delegowane dla przedmiotu",
    responses={
        status.HTTP_200_OK: {
            "model": ItemACLListResponse,
            "description": "Pomyślnie zwrócono listę uprawnień delegowanych.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Brak poprawnego tokena uwierzytelniającego.",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Brak uprawnień do przeglądania listy ACL przedmiotu.",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Nie znaleziono przedmiotu",
        },
    },
)
def read_item_acl(
    item_id: ItemID,
    db: DBDep,
    user: RequireItemReader,
    item: ItemByUuid,
) -> ItemACLListResponse:
    service = ItemACLService(db)

    try:
        return service.list_acl(item, user)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(err),
        ) from err


@router.post(
    "/{item_id}/acl",
    response_model=ItemACLResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Nadaj delegowane uprawnienie do przedmiotu",
    responses={
        status.HTTP_201_CREATED: {
            "model": ItemACLResponse,
            "description": "Uprawnienie zostało nadane.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Błędne dane lub duplikat uprawnienia.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Brak poprawnego tokena uwierzytelniającego.",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Tylko właściciel lub administrator może nadawać uprawnienia.",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Nie znaleziono przedmiotu",
        },
    },
)
def create_item_acl(
    item_id: ItemID,
    data: ItemACLCreate,
    db: DBDep,
    user: RequireItemWriter,
    item: ItemByUuid,
) -> ItemACLResponse:
    assert_can_manage_item_acl(user, item)
    service = ItemACLService(db)

    try:
        return service.add_acl(item, data.user_id, data.permission)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        ) from err


@router.delete(
    "/{item_id}/acl/{acl_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Usuń delegowane uprawnienie do przedmiotu",
    responses={
        status.HTTP_204_NO_CONTENT: {
            "description": "Uprawnienie zostało usunięte.",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Brak poprawnego tokena uwierzytelniającego.",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Tylko właściciel lub administrator może usuwać uprawnienia.",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Nie znaleziono przedmiotu lub wpisu ACL.",
        },
    },
)
def delete_item_acl(
    item_id: ItemID,
    acl_id: int,
    db: DBDep,
    user: RequireItemWriter,
    item: ItemByUuid,
) -> None:
    assert_can_manage_item_acl(user, item)
    service = ItemACLService(db)

    try:
        service.remove_acl(item, acl_id)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        ) from err


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
        status.HTTP_507_INSUFFICIENT_STORAGE: {
            "model": ErrorResponse,
            "description": "Brak miejsca na dysku lub błąd zapisu pliku.",
        },
        status.HTTP_403_FORBIDDEN: {
            "model": ErrorResponse,
            "description": "Brak uprawnień do zarządzania załącznikami przedmiotu.",
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
    item: ItemByUuid,
    files: Annotated[list[UploadFile], File()],
) -> ItemAttachmentsListResponse:
    assert_can_manage_item_attachments(user, item, db)
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
    except AttachmentStorageError as err:
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail="Unable to store attachment",
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
            "description": "Brak uprawnień do zarządzania załącznikami przedmiotu.",
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
    item: ItemByUuid,
) -> None:
    assert_can_manage_item_attachments(user, item, db)
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
