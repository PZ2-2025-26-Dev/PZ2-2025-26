from datetime import date, datetime, time, timedelta
from io import BytesIO
from uuid import UUID

from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Font
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import selectinload

from src.auth.constants import UserRole
from src.categories.models import Category
from src.exports.schemas import (
    InventoryStatsResponse,
    InventoryStatsSummary,
    ItemLoanStats,
)
from src.items.label_service import LABEL_FONT_PATH
from src.items.models import Item
from src.items.schemas import ItemSearch
from src.items.service import ItemService
from src.loans.constants import ReturnCondition
from src.loans.models import Loan
from src.locations.models import Location
from src.users.models import User

PDF_FONT_NAME = "DejaVuSans"


def _register_pdf_font() -> None:
    if PDF_FONT_NAME not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(PDF_FONT_NAME, str(LABEL_FONT_PATH)))


class ExportService:
    def __init__(self, db):
        self.db = db

    def get_items(
        self,
        search: str | None = None,
        status: str | None = None,
        category: str | None = None,
    ):
        stmt = select(Item).order_by(Item.id)

        if status:
            stmt = stmt.where(Item.status == status)

        if category:
            stmt = stmt.where(Item.category.has(name=category))

        if search:
            like = f"%{search}%"
            stmt = stmt.where((Item.name.ilike(like)) | (Item.description.ilike(like)))

        return self.db.execute(stmt).scalars().all()

    def export_items_xlsx(self, data: ItemSearch):
        stmt = ItemService(self.db)._build_items_query(data)
        stmt = stmt.options(
            selectinload(Item.category),
            selectinload(Item.location),
            selectinload(Item.owner),
        )

        sort_field_map = {
            "id": Item.id,
            "name": Item.name,
            "status": Item.status,
            "category": Category.name,
            "location": Location.name,
            "owner": User.last_name,
        }

        sort_criterias = []
        if data.sort:
            parts = data.sort.split(",")
            for part in parts:
                if ":" in part:
                    field, order = part.split(":", 1)
                else:
                    field, order = part, "asc"

                field = field.strip().lower()
                order = order.strip().lower()
                if field in sort_field_map:
                    sort_criterias.append((field, order))

        joined_tables = set()
        for field, _ in sort_criterias:
            if field == "category" and "category" not in joined_tables:
                stmt = stmt.join(Item.category, isouter=True)
                joined_tables.add("category")
            elif field == "location" and "location" not in joined_tables:
                stmt = stmt.join(Item.location, isouter=True)
                joined_tables.add("location")
            elif field == "owner" and "owner" not in joined_tables:
                stmt = stmt.join(Item.owner, isouter=True)
                joined_tables.add("owner")

        order_by_clauses = []
        for field, order in sort_criterias:
            column = sort_field_map.get(field, Item.id)
            if order == "desc":
                order_by_clauses.append(column.desc())
            else:
                order_by_clauses.append(column.asc())

        if not order_by_clauses:
            order_by_clauses.append(Item.name.asc())

        stmt = stmt.order_by(*order_by_clauses)

        items = self.db.execute(stmt).scalars().all()

        workbook = Workbook()
        worksheet = workbook.active
        worksheet.title = "Items"

        worksheet.append(
            [
                "ID",
                "Name",
                "Inventory Number",
                "Category",
                "Location",
                "Owner",
                "Status",
                "Description",
            ]
        )

        for item in items:
            worksheet.append(
                [
                    item.id,
                    item.name,
                    item.oldID or "",
                    item.category.name if item.category else "",
                    item.location.name if item.location else "",
                    f"{item.owner.first_name} {item.owner.last_name}".strip() if item.owner else "",
                    item.status.value,
                    item.description or "",
                ]
            )

        stream = BytesIO()
        workbook.save(stream)
        stream.seek(0)

        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": 'attachment; filename="items.xlsx"',
            },
        )

    def export_item_report_xlsx(self, item_uuid: UUID):
        item_stmt = (
            select(Item)
            .where(Item.uuid == item_uuid)
            .options(
                selectinload(Item.category),
                selectinload(Item.location),
                selectinload(Item.owner),
            )
        )
        item = self.db.execute(item_stmt).scalar_one_or_none()
        if not item:
            raise ValueError("Item not found")

        history_stmt = select(Loan).where(Loan.item_id == item.id).order_by(Loan.created_at.desc())
        loans_history = self.db.execute(history_stmt).scalars().all()

        total_loans = len(loans_history)
        unique_borrowers = len(
            {
                (loan.user_id, loan.guest_id)
                for loan in loans_history
                if loan.user_id is not None or loan.guest_id is not None
            }
        )
        broken_count = sum(1 for loan in loans_history if loan.return_condition == ReturnCondition.BROKEN)
        completed_durations = [
            (loan.returned_at - loan.borrowed_at).total_seconds() / 86400
            for loan in loans_history
            if loan.returned_at is not None and loan.borrowed_at is not None
        ]

        avg_duration_str = "N/A"
        if completed_durations:
            days = int(sum(completed_durations) / len(completed_durations))
            avg_duration_str = f"{days} dni" if days > 0 else "mniej niż 1 dzień"
        failure_rate = f"{(broken_count / total_loans) * 100:.1f}%" if total_loans > 0 else "0.0%"

        # # 4. Budowanie pliku Excel
        workbook = Workbook()

        ws_summary = workbook.active
        ws_summary.title = "Summary"

        bold_font = Font(bold=True)
        header_font = Font(bold=True, size=14)

        # Sekcja: Dane przedmiotu
        ws_summary.append(["ITEM REPORT"])
        ws_summary.cell(1, 1).font = header_font
        ws_summary.append([])

        ws_summary.append(["Item ID:", item.id])
        ws_summary.append(["Name:", item.name])
        ws_summary.append(["Inventory Number:", item.oldID or ""])
        ws_summary.append(["Category:", item.category.name if item.category else ""])
        ws_summary.append(["Current Status:", item.status.value])

        for row in range(3, 8):
            ws_summary.cell(row, 1).font = bold_font

        ws_summary.append([])
        ws_summary.append(["METRICS"])
        ws_summary.cell(9, 1).font = header_font
        ws_summary.append([])

        # Sekcja: Metryki
        ws_summary.append(["Total Loans:", total_loans])
        ws_summary.append(["Unique Borrowers:", unique_borrowers])
        ws_summary.append(["Average Loan Duration:", avg_duration_str])
        ws_summary.append(["Damaged Returns Count:", broken_count])
        ws_summary.append(["Failure Rate:", failure_rate])

        for row in range(11, 16):
            ws_summary.cell(row, 1).font = bold_font

        # --- ZAKŁADKA 2: Historia wypożyczeń ---
        ws_history = workbook.create_sheet(title="Loan History")
        ws_history.append(
            [
                "Loan ID",
                "Status",
                "Created At",
                "Borrowed At",
                "Returned At",
                "Borrower Type",
                "Borrower ID",
                "Return Condition",
                "Return Note",
            ]
        )
        ws_history.row_dimensions[1].font = bold_font

        for loan in loans_history:
            borrower_type = "User" if loan.user_id else "Guest"
            borrower_id = loan.user_id if loan.user_id else loan.guest_id

            ws_history.append(
                [
                    loan.id,
                    loan.status.value,
                    loan.created_at.strftime("%Y-%m-%d %H:%M") if loan.created_at else "",
                    loan.borrowed_at.strftime("%Y-%m-%d %H:%M") if loan.borrowed_at else "",
                    loan.returned_at.strftime("%Y-%m-%d %H:%M") if loan.returned_at else "",
                    borrower_type,
                    borrower_id,
                    loan.return_condition.value if loan.return_condition else "",
                    loan.return_note or "",
                ]
            )

        # Zapisuwanie strumienia i zwrot pliku
        stream = BytesIO()
        workbook.save(stream)
        stream.seek(0)

        filename = f"report_item_{item_uuid}.xlsx"
        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )

    def get_inventory_statistics(
        self,
        user: User,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> InventoryStatsResponse:
        # Date filter lives in the outer-join ON clause so zero-loan items stay
        # in the breakdown; borrowed_at IS NOT NULL excludes never-approved loans.
        loan_on = [Loan.item_id == Item.id, Loan.borrowed_at.is_not(None)]
        if date_from:
            loan_on.append(Loan.borrowed_at >= datetime.combine(date_from, time.min))
        if date_to:
            loan_on.append(Loan.borrowed_at < datetime.combine(date_to + timedelta(days=1), time.min))

        overdue_expr = func.if_(
            or_(
                and_(Loan.returned_at.is_not(None), Loan.returned_at > Loan.declared_return_date),
                and_(Loan.returned_at.is_(None), Loan.declared_return_date < func.now()),
            ),
            1,
            0,
        )

        stmt = (
            select(
                Item.uuid,
                Item.name,
                func.count(Loan.id).label("loan_count"),
                func.coalesce(func.sum(overdue_expr), 0).label("overdue_count"),
                func.coalesce(func.sum(func.if_(Loan.return_condition == ReturnCondition.BROKEN, 1, 0)), 0).label(
                    "broken_count"
                ),
                func.coalesce(func.sum(func.if_(Loan.return_condition == ReturnCondition.MISSING, 1, 0)), 0).label(
                    "missing_count"
                ),
            )
            .join(Loan, and_(*loan_on), isouter=True)
            .group_by(Item.id, Item.uuid, Item.name)
            .order_by(Item.name)
        )
        if user.role != UserRole.ADMIN:
            stmt = stmt.where(Item.owner_id == user.id)

        rows = self.db.execute(stmt).all()

        items = [
            ItemLoanStats(
                item_uuid=row.uuid,
                item_name=row.name,
                loan_count=row.loan_count,
                overdue_count=int(row.overdue_count),
                broken_count=int(row.broken_count),
                missing_count=int(row.missing_count),
            )
            for row in rows
        ]
        summary = InventoryStatsSummary(
            total_loans=sum(i.loan_count for i in items),
            total_overdue=sum(i.overdue_count for i in items),
            total_broken=sum(i.broken_count for i in items),
            total_missing=sum(i.missing_count for i in items),
        )
        return InventoryStatsResponse(date_from=date_from, date_to=date_to, summary=summary, items=items)

    def export_statistics_xlsx(
        self,
        user: User,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> StreamingResponse:
        stats = self.get_inventory_statistics(user, date_from, date_to)

        workbook = Workbook()
        worksheet = workbook.active
        worksheet.title = "Statistics"

        bold_font = Font(bold=True)
        header_font = Font(bold=True, size=14)

        worksheet.append(["INVENTORY EVENT STATISTICS"])
        worksheet.cell(1, 1).font = header_font
        worksheet.append(["Date From:", date_from.isoformat() if date_from else "-"])
        worksheet.append(["Date To:", date_to.isoformat() if date_to else "-"])
        worksheet.append([])
        worksheet.append(["Total Loans:", stats.summary.total_loans])
        worksheet.append(["Total Overdue:", stats.summary.total_overdue])
        worksheet.append(["Broken Returns:", stats.summary.total_broken])
        worksheet.append(["Missing Returns:", stats.summary.total_missing])
        for row in (2, 3, 5, 6, 7, 8):
            worksheet.cell(row, 1).font = bold_font
        worksheet.append([])

        header_row = ["Item", "Loans", "Overdue", "Broken Returns", "Missing Returns"]
        worksheet.append(header_row)
        for col in range(1, len(header_row) + 1):
            worksheet.cell(worksheet.max_row, col).font = bold_font

        for item in stats.items:
            worksheet.append(
                [item.item_name, item.loan_count, item.overdue_count, item.broken_count, item.missing_count]
            )

        stream = BytesIO()
        workbook.save(stream)
        stream.seek(0)

        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": 'attachment; filename="inventory-statistics.xlsx"',
            },
        )

    def export_statistics_pdf(
        self,
        user: User,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> StreamingResponse:
        stats = self.get_inventory_statistics(user, date_from, date_to)
        _register_pdf_font()

        title_style = ParagraphStyle("Title", fontName=PDF_FONT_NAME, fontSize=16, spaceAfter=4 * mm)
        text_style = ParagraphStyle("Text", fontName=PDF_FONT_NAME, fontSize=10)
        cell_style = ParagraphStyle("Cell", fontName=PDF_FONT_NAME, fontSize=9)

        date_range = f"{date_from.isoformat() if date_from else '...'} — {date_to.isoformat() if date_to else '...'}"
        elements = [
            Paragraph("Statystyki zdarzeń inwentarzowych", title_style),
            Paragraph(f"Zakres dat: {date_range}", text_style),
            Paragraph(f"Wypożyczenia: {stats.summary.total_loans}", text_style),
            Paragraph(f"Opóźnienia: {stats.summary.total_overdue}", text_style),
            Paragraph(f"Zwroty uszkodzone: {stats.summary.total_broken}", text_style),
            Paragraph(f"Zwroty zagubione: {stats.summary.total_missing}", text_style),
            Spacer(0, 6 * mm),
        ]

        table_data = [["Przedmiot", "Wypożyczenia", "Opóźnienia", "Uszkodzone", "Zagubione"]]
        table_data += [
            # Paragraph wraps long names within the column; plain strings would be
            # drawn past the page edge and silently clipped.
            [
                Paragraph(item.item_name, cell_style),
                item.loan_count,
                item.overdue_count,
                item.broken_count,
                item.missing_count,
            ]
            for item in stats.items
        ]
        count_col_width = 30 * mm
        name_col_width = landscape(A4)[0] - 2 * 72 - 4 * count_col_width  # 72pt = default doc margin
        table = Table(table_data, repeatRows=1, colWidths=[name_col_width] + [count_col_width] * 4)
        table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (-1, -1), PDF_FONT_NAME),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ]
            )
        )
        elements.append(table)

        stream = BytesIO()
        SimpleDocTemplate(stream, pagesize=landscape(A4)).build(elements)
        stream.seek(0)

        return StreamingResponse(
            stream,
            media_type="application/pdf",
            headers={
                "Content-Disposition": 'attachment; filename="inventory-statistics.pdf"',
            },
        )
