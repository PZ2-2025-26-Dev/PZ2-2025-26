from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from sqlalchemy import select

from src.auth.constants import UserRole
from src.auth.dependencies import CurrentUser, RequireAdmin
from src.dependencies import DBDep
from src.items.attachment_service import (
    AttachmentNotFoundError,
    AttachmentStorageError,
    AttachmentTooLargeError,
    ItemAttachmentService,
    ItemNotFoundError,
)
from src.items.dependencies import (
    ItemByUuid,
    RequireItemOwnerOrAdmin,
    RequireItemReader,
    RequireItemWriter,
    assert_can_assign_owner_on_create,
    assert_can_update_item,
)
from src.items.label_service import generate_label_image, generate_label_pdf
from src.items.models import Item
from src.items.qr_service import generate_qr_image
from src.items.schemas import (
    ItemAttachmentsListResponse,
    ItemCreate,
    ItemCreateResponse,
    ItemGetResponse,
    ItemHistoryGetResponse,
    ItemHistorySearch,
    ItemID,
    ItemLabelRequest,
    ItemSearch,
    ItemsPaged,
    ItemUpdate,
    ItemUpdateResponse,
)
from src.items.service import ItemService
from src.schemas import ErrorResponse
from src.users.models import User

router = APIRouter(prefix="/items")


def _ensure_item_owner(item_id: UUID, user: User, db: DBDep) -> None:
    item = db.execute(select(Item).where(Item.uuid == item_id)).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    if item.owner_id != user.id and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only item owner can manage attachments")


def error_response(status_code: int, detail: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=ErrorResponse(code=status_code, detail=detail).model_dump(),
    )


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
    "/scan/{code}",
    response_model=ItemGetResponse,
    status_code=status.HTTP_200_OK,
    summary="Pobierz przedmiot po zeskanowanym kodzie QR",
    responses={
        status.HTTP_200_OK: {
            "model": ItemGetResponse,
            "description": "Pomyślnie zwrócono przedmiot przypisany do kodu QR",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Niepoprawny kod QR",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono przedmiotu",
        },
    },
)
def scan_item(
    code: str,
    db: DBDep,
    _reader: RequireItemReader,
) -> ItemGetResponse | JSONResponse:
    try:
        item_uuid = UUID(code)
    except ValueError:
        return error_response(status.HTTP_400_BAD_REQUEST, "Invalid QR code")

    try:
        return ItemService(db).get_item_by_qr_code(item_uuid)
    except ValueError:
        return error_response(status.HTTP_404_NOT_FOUND, "Item not found")


@router.get(
    "/{item_id}/qr.png",
    response_model=None,
    status_code=status.HTTP_200_OK,
    summary="Pobierz kod QR przedmiotu jako PNG",
    responses={
        status.HTTP_200_OK: {
            "content": {"image/png": {}},
            "description": "Pomyślnie wygenerowano kod QR",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono przedmiotu",
        },
    },
)
def download_item_qr_png(
    item_id: ItemID,
    db: DBDep,
    _reader: RequireItemReader,
) -> StreamingResponse | JSONResponse:
    service = ItemService(db)

    try:
        item = service.get_item_for_label(item_id)
    except ValueError:
        return error_response(status.HTTP_404_NOT_FOUND, "Item not found")

    filename = f"item-{item.uuid}-qr.png"

    return StreamingResponse(
        generate_qr_image(item.uuid, "PNG"),
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/{item_id}/label.pdf",
    response_model=None,
    status_code=status.HTTP_200_OK,
    summary="Pobierz etykietę przedmiotu jako PDF",
    responses={
        status.HTTP_200_OK: {
            "content": {"application/pdf": {}},
            "description": "Pomyślnie wygenerowano etykietę",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Niepoprawna konfiguracja etykiety",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono przedmiotu",
        },
    },
)
def download_item_label_pdf(
    item_id: ItemID,
    data: ItemLabelRequest,
    db: DBDep,
    _reader: RequireItemReader,
) -> StreamingResponse | JSONResponse:
    service = ItemService(db)

    try:
        item = service.get_item_for_label(item_id)
    except ValueError:
        return error_response(status.HTTP_404_NOT_FOUND, "Item not found")

    try:
        label = generate_label_pdf(item, data.fields, data.width_mm, data.height_mm)
    except ValueError as err:
        return error_response(status.HTTP_400_BAD_REQUEST, str(err))

    filename = f"item-{item.uuid}-label.pdf"

    return StreamingResponse(
        label,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/{item_id}/label.png",
    response_model=None,
    status_code=status.HTTP_200_OK,
    summary="Pobierz etykietę przedmiotu jako PNG",
    responses={
        status.HTTP_200_OK: {
            "content": {"image/png": {}},
            "description": "Pomyślnie wygenerowano etykietę",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Niepoprawna konfiguracja etykiety",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "Nie znaleziono przedmiotu",
        },
    },
)
def download_item_label_png(
    item_id: ItemID,
    data: ItemLabelRequest,
    db: DBDep,
    _reader: RequireItemReader,
) -> StreamingResponse | JSONResponse:
    service = ItemService(db)

    try:
        item = service.get_item_for_label(item_id)
    except ValueError:
        return error_response(status.HTTP_404_NOT_FOUND, "Item not found")

    try:
        label = generate_label_image(item, data.fields, "PNG", data.width_mm, data.height_mm)
    except ValueError as err:
        return error_response(status.HTTP_400_BAD_REQUEST, str(err))

    filename = f"item-{item.uuid}-label.png"

    return StreamingResponse(
        label,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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
    item: RequireItemOwnerOrAdmin,
    db: DBDep,
    data: Annotated[ItemHistorySearch, Depends()],
) -> ItemHistoryGetResponse:
    service = ItemService(db)

    try:
        return service.get_item_history(item.uuid, data)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono przedmiotu",
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
