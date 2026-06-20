from typing import Optional
from sqlalchemy import select
from io import BytesIO
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from src.items.models import Item


class ExportService:
    def __init__(self, db):
        self.db = db

    def get_items(
        self,
        search: Optional[str] = None,
        status: Optional[str] = None,
        category: Optional[str] = None,
    ):
        stmt = (
            select(Item)
            .order_by(Item.id)
        )

        if status:
            stmt = stmt.where(Item.status == status)

        if category:
            stmt = stmt.where(Item.category.has(name=category))

        if search:
            like = f"%{search}%"
            stmt = stmt.where(
                (Item.name.ilike(like)) |
                (Item.description.ilike(like))
            )

        return self.db.execute(stmt).scalars().all()
    
    def export_items_xlsx(self, search=None, status=None, category=None):
        items = self.get_items(
            search=search,
            status=status,
            category=category,
        )

        workbook = Workbook()
        worksheet = workbook.active
        worksheet.title = "Items"

        worksheet.append([
            "ID",
            "Name",
            "Inventory Number",
            "Category",
            "Location",
            "Owner",
            "Status",
            "Description",
        ])

        for item in items:
            worksheet.append([
                item.id,
                item.name,
                str(item.inventory_number),
                item.category.name,
                item.location.name,
                item.owner.first_name,
                item.status.value,
                item.description,
            ])

        stream = BytesIO()
        workbook.save(stream)
        stream.seek(0)

        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": 'attachment; filename="items.xlsx"'
            },
        )