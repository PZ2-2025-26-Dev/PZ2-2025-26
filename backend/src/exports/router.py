from typing import Optional
from fastapi import APIRouter, Query

from src.dependencies import DBDep
from src.exports.service import ExportService

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/items/xlsx")
def export_items_xlsx(
    db: DBDep,
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
):
    service = ExportService(db)

    return service.export_items_xlsx(
        search=search,
        status=status,
        category=category,
    )