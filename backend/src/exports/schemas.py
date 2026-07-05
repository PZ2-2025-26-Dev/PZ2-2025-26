from datetime import date
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field

type StatCount = Annotated[int, Field(ge=0)]


class ItemLoanStats(BaseModel):
    item_uuid: UUID
    item_name: str
    loan_count: StatCount
    overdue_count: StatCount
    broken_count: StatCount
    missing_count: StatCount


class InventoryStatsSummary(BaseModel):
    total_loans: StatCount
    total_overdue: StatCount
    total_broken: StatCount
    total_missing: StatCount


class InventoryStatsResponse(BaseModel):
    date_from: date | None
    date_to: date | None
    summary: InventoryStatsSummary
    items: list[ItemLoanStats]
