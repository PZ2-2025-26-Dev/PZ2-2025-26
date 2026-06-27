from typing import Annotated

from fastapi import APIRouter, Query

from src.dependencies import DBDep
from src.exports.service import ExportService

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select

from src.dependencies import DBDep

from src.items.dependencies import (
    RequireItemReader,
    assert_can_assign_owner_on_create,
    assert_can_update_item,
)
from src.items.models import Item
from src.items.schemas import (
    ItemSearch,
)
from src.items.service import ItemService
from src.schemas import ErrorResponse
from src.users.models import User

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/items/xlsx")
def export_items_xlsx(
    data: Annotated[ItemSearch, Depends()],
    db: DBDep,
    _reader: RequireItemReader,
):
    return ExportService(db).export_items_xlsx(data)