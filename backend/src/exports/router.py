from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from src.dependencies import DBDep
from src.exports.schemas import InventoryStatsResponse
from src.exports.service import ExportService
from src.items.dependencies import RequireItemExporter, RequireItemReader
from src.items.schemas import ItemSearch
from src.schemas import ErrorResponse

router = APIRouter(prefix="/exports", tags=["exports"])

_STATS_ERROR_RESPONSES = {
    status.HTTP_401_UNAUTHORIZED: {
        "model": ErrorResponse,
        "description": "Brak lub nieprawidłowy token uwierzytelniający.",
    },
    status.HTTP_403_FORBIDDEN: {
        "model": ErrorResponse,
        "description": "Obserwator nie ma dostępu do statystyk.",
    },
}


@router.get("/items/xlsx")
def export_items_xlsx(
    data: Annotated[ItemSearch, Depends()],
    db: DBDep,
    _exporter: RequireItemExporter,
):
    return ExportService(db).export_items_xlsx(data)


@router.get("/items/{item_uuid}/report/xlsx")
def export_item_report_xlsx(
    item_uuid: UUID,
    db: DBDep,
    _reader: RequireItemReader,
):
    return ExportService(db).export_item_report_xlsx(item_uuid)


@router.get(
    "/statistics",
    response_model=InventoryStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Statystyki zdarzeń inwentarzowych",
    responses={
        status.HTTP_200_OK: {
            "model": InventoryStatsResponse,
            "description": "Zagregowane statystyki wypożyczeń, opóźnień i braków.",
        },
        **_STATS_ERROR_RESPONSES,
    },
)
def get_inventory_statistics(
    db: DBDep,
    exporter: RequireItemExporter,
    date_from: date | None = None,
    date_to: date | None = None,
):
    return ExportService(db).get_inventory_statistics(exporter, date_from, date_to)


@router.get(
    "/statistics/xlsx",
    response_model=None,
    status_code=status.HTTP_200_OK,
    summary="Eksport statystyk zdarzeń inwentarzowych do XLSX",
    responses={
        status.HTTP_200_OK: {
            "content": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}},
            "description": "Plik XLSX ze statystykami.",
        },
        **_STATS_ERROR_RESPONSES,
    },
)
def export_statistics_xlsx(
    db: DBDep,
    exporter: RequireItemExporter,
    date_from: date | None = None,
    date_to: date | None = None,
):
    return ExportService(db).export_statistics_xlsx(exporter, date_from, date_to)


@router.get(
    "/statistics/pdf",
    response_model=None,
    status_code=status.HTTP_200_OK,
    summary="Eksport statystyk zdarzeń inwentarzowych do PDF",
    responses={
        status.HTTP_200_OK: {
            "content": {"application/pdf": {}},
            "description": "Plik PDF ze statystykami.",
        },
        **_STATS_ERROR_RESPONSES,
    },
)
def export_statistics_pdf(
    db: DBDep,
    exporter: RequireItemExporter,
    date_from: date | None = None,
    date_to: date | None = None,
):
    return ExportService(db).export_statistics_pdf(exporter, date_from, date_to)
