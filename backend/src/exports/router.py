from typing import Annotated

from fastapi import APIRouter, Query

from src.dependencies import DBDep
from src.exports.service import ExportService

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/items/xlsx")
def export_items_xlsx(
    db: DBDep,
    search: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    category: Annotated[str | None, Query()] = None,
):
    service = ExportService(db)

    return service.export_items_xlsx(
        search=search,
        status=status,
        category=category,
    )
