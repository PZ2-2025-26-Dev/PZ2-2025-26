from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.config import config
from src.items.constants import ATTACHMENT_MAX_SIZE_BYTES
from src.items.models import Item, ItemAttachment
from src.items.schemas import ItemAttachmentAuthor, ItemAttachmentResponse
from src.items.helpers import format_user_name
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


class ItemAttachmentService:
    def __init__(self, db: Session):
        self.db = db

    def _ensure_item_exists(self, item_id: int) -> Item:
        item = self.db.get(Item, item_id)
        if item is None:
            raise ItemNotFoundError()
        return item

    def _ensure_user_exists(self, user_id: int) -> User:
        user = self.db.get(User, user_id)
        if user is None:
            raise UserNotFoundError()
        return user

    def _item_upload_dir(self, item_id: int) -> Path:
        return Path(config.upload_dir) / str(item_id)

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

    def list_attachments(self, item_id: int) -> list[ItemAttachmentResponse]:
        self._ensure_item_exists(item_id)

        stmt = (
            select(ItemAttachment, User)
            .join(User, User.id == ItemAttachment.uploaded_by)
            .where(ItemAttachment.item_id == item_id)
            .order_by(ItemAttachment.uploaded_at.desc())
        )
        rows = self.db.execute(stmt).all()

        return [self._to_response(attachment, uploader) for attachment, uploader in rows]

    def upload_attachments(
        self,
        item_id: int,
        uploaded_by: int,
        files: list[UploadFile],
    ) -> list[ItemAttachmentResponse]:
        self._ensure_item_exists(item_id)
        uploader = self._ensure_user_exists(uploaded_by)

        if not files:
            return []

        upload_dir = self._item_upload_dir(item_id)
        upload_dir.mkdir(parents=True, exist_ok=True)

        created: list[ItemAttachmentResponse] = []
        max_size = min(config.max_upload_size_bytes, ATTACHMENT_MAX_SIZE_BYTES)

        for upload in files:
            if not upload.filename:
                continue

            content = upload.file.read()
            if len(content) > max_size:
                raise AttachmentTooLargeError()

            stored_filename = f"{uuid4().hex}_{Path(upload.filename).name}"
            file_path = upload_dir / stored_filename
            file_path.write_bytes(content)

            attachment = ItemAttachment(
                item_id=item_id,
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
        return created

    def get_attachment_file(self, item_id: int, attachment_id: int) -> tuple[Path, str, str]:
        self._ensure_item_exists(item_id)

        attachment = self.db.get(ItemAttachment, attachment_id)
        if attachment is None or attachment.item_id != item_id:
            raise AttachmentNotFoundError()

        file_path = self._item_upload_dir(item_id) / attachment.stored_filename
        if not file_path.is_file():
            raise AttachmentNotFoundError()

        return file_path, attachment.original_filename, attachment.mime_type

    def delete_attachment(self, item_id: int, attachment_id: int, deleted_by: int) -> None:
        self._ensure_item_exists(item_id)
        self._ensure_user_exists(deleted_by)

        attachment = self.db.get(ItemAttachment, attachment_id)
        if attachment is None or attachment.item_id != item_id:
            raise AttachmentNotFoundError()

        file_path = self._item_upload_dir(item_id) / attachment.stored_filename
        if file_path.is_file():
            file_path.unlink()

        self.db.delete(attachment)
        self.db.commit()
