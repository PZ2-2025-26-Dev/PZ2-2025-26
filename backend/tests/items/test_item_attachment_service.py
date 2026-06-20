import io
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.auth.constants import UserRole, UserStatus
from src.categories.models import Category
from src.items.attachment_service import ItemAttachmentService, ItemNotFoundError
from src.items.models import Item
from src.items.schemas import ItemCreate
from src.items.service import ItemService
from src.locations.constants import LocationType
from src.locations.models import Location
from src.main import app
from src.users.models import User

pytestmark = pytest.mark.integration

client = TestClient(app)


def _create_item_with_user(db: Session) -> tuple[Item, User]:
    cat = Category(name="TestCat", parent_id=None)
    loc = Location(name="D10", type=LocationType.BUILDING, description=None, parent_id=None, is_active=True)
    user = User(
        first_name="Adam",
        last_name="Nowak",
        email="adam-attach@example.com",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
    )

    db.add_all([cat, loc, user])
    db.commit()

    data = ItemCreate(
        name="Oscyloskop test",
        category_id=cat.id,
        location_id=loc.id,
        owner_id=user.id,
        description="Test description",
    )

    item = ItemService(db).add_item(data)
    return item, user


def test_upload_and_list_attachments(db: Session, tmp_path, monkeypatch):
    monkeypatch.setattr("src.items.attachment_service.config.upload_dir", str(tmp_path))

    item, user = _create_item_with_user(db)
    service = ItemAttachmentService(db)

    upload = Mock()
    upload.filename = "manual.pdf"
    upload.content_type = "application/pdf"
    upload.file = io.BytesIO(b"pdf-content")

    created = service.upload_attachments(item.id, user.id, [upload])

    assert len(created) == 1
    assert created[0].original_filename == "manual.pdf"
    assert created[0].uploaded_by.id == user.id
    assert created[0].uploaded_by.name == "Adam Nowak"
    assert created[0].size_bytes == len(b"pdf-content")

    listed = service.list_attachments(item.id)
    assert len(listed) == 1
    assert listed[0].id == created[0].id


def test_upload_multiple_attachments(db: Session, tmp_path, monkeypatch):
    monkeypatch.setattr("src.items.attachment_service.config.upload_dir", str(tmp_path))

    item, user = _create_item_with_user(db)
    service = ItemAttachmentService(db)

    first = Mock()
    first.filename = "photo.jpg"
    first.content_type = "image/jpeg"
    first.file = io.BytesIO(b"jpeg-bytes")

    second = Mock()
    second.filename = "notes.txt"
    second.content_type = "text/plain"
    second.file = io.BytesIO(b"plain-text")

    created = service.upload_attachments(item.id, user.id, [first, second])

    assert len(created) == 2
    assert service.list_attachments(item.id)[0].original_filename == "notes.txt"


def test_get_attachment_file(db: Session, tmp_path, monkeypatch):
    monkeypatch.setattr("src.items.attachment_service.config.upload_dir", str(tmp_path))

    item, user = _create_item_with_user(db)
    service = ItemAttachmentService(db)

    upload = Mock()
    upload.filename = "data.bin"
    upload.content_type = "application/octet-stream"
    upload.file = io.BytesIO(b"binary-data")

    created = service.upload_attachments(item.id, user.id, [upload])
    file_path, original_filename, mime_type = service.get_attachment_file(item.id, created[0].id)

    assert file_path.is_file()
    assert file_path.read_bytes() == b"binary-data"
    assert original_filename == "data.bin"
    assert mime_type == "application/octet-stream"


def test_delete_attachment(db: Session, tmp_path, monkeypatch):
    monkeypatch.setattr("src.items.attachment_service.config.upload_dir", str(tmp_path))

    item, user = _create_item_with_user(db)
    service = ItemAttachmentService(db)

    upload = Mock()
    upload.filename = "temp.doc"
    upload.content_type = "application/msword"
    upload.file = io.BytesIO(b"doc-content")

    created = service.upload_attachments(item.id, user.id, [upload])
    service.delete_attachment(item.id, created[0].id, user.id)

    assert service.list_attachments(item.id) == []


def test_list_attachments_item_not_found(db: Session):
    service = ItemAttachmentService(db)

    with pytest.raises(ItemNotFoundError):
        service.list_attachments(99999)


def test_read_item_attachments_not_found(monkeypatch):
    def mock_list(self, item_id):
        raise ItemNotFoundError()

    monkeypatch.setattr(ItemAttachmentService, "list_attachments", mock_list)

    response = client.get("/items/999/attachments")

    assert response.status_code == 404
