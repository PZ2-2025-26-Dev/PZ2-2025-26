from pathlib import Path
from uuid import UUID, uuid4

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.config import config
from src.items.constants import ATTACHMENT_MAX_SIZE_BYTES
from src.items.helpers import format_user_name
from src.items.models import Item, ItemAttachment
from src.items.schemas import ItemAttachmentAuthor, ItemAttachmentResponse
from src.users.models import User
from src.utils import now


class ItemNotFoundError(Exception):
    pass


class AttachmentNotFoundError(Exception):
    pass


class UserNotFoundError(Exception):
    pass


class AttachmentTooLargeError(Exception):
    pass


class AttachmentStorageError(Exception):
    pass


class ItemAttachmentService:
    def __init__(self, db: Session):
        self.db = db

    def _get_item_by_uuid(self, item_id: UUID) -> Item:
        item = self.db.execute(select(Item).where(Item.uuid == item_id)).scalar_one_or_none()
        if item is None:
            raise ItemNotFoundError()
        return item

    def _ensure_user_exists(self, user_id: int) -> User:
        user = self.db.get(User, user_id)
        if user is None:
            raise UserNotFoundError()
        return user

    def _item_upload_dir(self, item: Item) -> Path:
        return Path(config.upload_dir) / str(item.id)

    def _to_response(self, attachment: ItemAttachment, uploader: User) -> ItemAttachmentResponse:
        return ItemAttachmentResponse(
            id=attachment.id,
            original_filename=attachment.original_filename,
            mime_type=attachment.mime_type,
            size_bytes=attachment.size_bytes,
            uploaded_at=attachment.uploaded_at,
            uploaded_by=ItemAttachmentAuthor(
                id=uploader.id,
                name=format_user_name(uploader),
            ),
        )

    def list_attachments(self, item_id: UUID) -> list[ItemAttachmentResponse]:
        item = self._get_item_by_uuid(item_id)

        stmt = (
            select(ItemAttachment, User)
            .join(User, User.id == ItemAttachment.uploaded_by)
            .where(ItemAttachment.item_id == item.id)
            .order_by(ItemAttachment.uploaded_at.desc())
        )
        rows = self.db.execute(stmt).all()

        return [self._to_response(attachment, uploader) for attachment, uploader in rows]

    def upload_attachments(
        self,
        item_id: UUID,
        uploaded_by: int,
        files: list[UploadFile],
    ) -> list[ItemAttachmentResponse]:
        item = self._get_item_by_uuid(item_id)
        uploader = self._ensure_user_exists(uploaded_by)

        if not files:
            return []

        upload_dir = self._item_upload_dir(item)
        try:
            upload_dir.mkdir(parents=True, exist_ok=True)
        except OSError as err:
            raise AttachmentStorageError() from err

        created: list[ItemAttachmentResponse] = []

        try:
            for upload in files:
                if not upload.filename:
                    continue

                content = upload.file.read()
                if len(content) > ATTACHMENT_MAX_SIZE_BYTES:
                    raise AttachmentTooLargeError()

                stored_filename = f"{uuid4().hex}_{Path(upload.filename).name}"
                file_path = upload_dir / stored_filename
                try:
                    file_path.write_bytes(content)
                except OSError as err:
                    raise AttachmentStorageError() from err

                attachment = ItemAttachment(
                    item_id=item.id,
                    original_filename=upload.filename,
                    stored_filename=stored_filename,
                    mime_type=upload.content_type or "application/octet-stream",
                    size_bytes=len(content),
                    uploaded_at=now(),
                    uploaded_by=uploaded_by,
                )
                self.db.add(attachment)
                self.db.flush()

                created.append(self._to_response(attachment, uploader))

            self.db.commit()
        except AttachmentTooLargeError, AttachmentStorageError:
            self.db.rollback()
            raise

        return created

    def get_attachment_file(self, item_id: UUID, attachment_id: int) -> tuple[Path, str, str]:
        item = self._get_item_by_uuid(item_id)

        attachment = self.db.get(ItemAttachment, attachment_id)
        if attachment is None or attachment.item_id != item.id:
            raise AttachmentNotFoundError()

        file_path = self._item_upload_dir(item) / attachment.stored_filename
        if not file_path.is_file():
            raise AttachmentNotFoundError()

        return file_path, attachment.original_filename, attachment.mime_type

    def delete_attachment(self, item_id: UUID, attachment_id: int, deleted_by: int) -> None:
        item = self._get_item_by_uuid(item_id)
        self._ensure_user_exists(deleted_by)

        attachment = self.db.get(ItemAttachment, attachment_id)
        if attachment is None or attachment.item_id != item.id:
            raise AttachmentNotFoundError()

        file_path = self._item_upload_dir(item) / attachment.stored_filename
        if file_path.is_file():
            file_path.unlink()

        self.db.delete(attachment)
        self.db.commit()
