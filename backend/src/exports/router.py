from typing import Annotated

from fastapi import APIRouter, Depends

from src.dependencies import DBDep
from src.exports.service import ExportService
from src.items.dependencies import (
    RequireItemReader,
)
from src.items.schemas import ItemSearch

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/items/xlsx")
def export_items_xlsx(
    data: Annotated[ItemSearch, Depends()],
    db: DBDep,
    _reader: RequireItemReader,
):
    return ExportService(db).export_items_xlsx(data)
