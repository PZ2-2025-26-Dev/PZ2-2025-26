import json
from io import BytesIO
from math import ceil
from pathlib import Path
from typing import Literal
from zipfile import ZIP_DEFLATED, ZipFile

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from src.items.helpers import build_location_path
from src.items.models import Item
from src.items.qr_service import generate_qr_image
from src.items.schemas import ItemLabelField

type LabelImageFormat = Literal["PNG"]
type LabelFont = ImageFont.ImageFont | ImageFont.FreeTypeFont

DPI = 300
MM_PER_INCH = 25.4
PDF_POINTS_PER_INCH = 72
MIN_FONT_SIZE = 6
MAX_FONT_SIZE = 220
FONT_SCALE_FACTOR = 0.82
LABEL_FONT_PATH = Path(__file__).resolve().parents[2] / "resources" / "DejaVuSans.ttf"


def _mm_to_px(value: float) -> int:
    return max(1, round(value / MM_PER_INCH * DPI))


def _mm_to_pdf_points(value: float) -> float:
    return value / MM_PER_INCH * PDF_POINTS_PER_INCH


def _load_font(size: int) -> LabelFont:
    try:
        return ImageFont.truetype(str(LABEL_FONT_PATH), size)
    except OSError as err:
        raise RuntimeError(f"Label font is unavailable: {LABEL_FONT_PATH}") from err


def _nested_parameter_value(parameters: dict, parameter_path: str):
    if not parameter_path:
        raise ValueError("Unsupported label parameter: ")

    if parameter_path in parameters:
        return parameters[parameter_path]

    value = parameters
    for path_part in parameter_path.split("."):
        if isinstance(value, dict) and path_part in value:
            value = value[path_part]
            continue

        if isinstance(value, list) and path_part.isdigit():
            index = int(path_part)
            if index < len(value):
                value = value[index]
                continue

        raise ValueError(f"Unsupported label parameter: {parameter_path}")

    return value


def _format_parameter_value(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list, bool)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def _field_value(item: Item, field: str) -> tuple[str, str]:
    match field:
        case ItemLabelField.NAME:
            return "Name", item.name
        case ItemLabelField.DESCRIPTION:
            return "Description", item.description or ""
        case ItemLabelField.STATUS:
            return "Status", item.status.value
        case ItemLabelField.CATEGORY:
            return "Category", item.category.name
        case ItemLabelField.LOCATION:
            return "Location", build_location_path(item.location)
        case ItemLabelField.OWNER:
            return "Owner", item.owner.first_name
        case ItemLabelField.OLD_ID:
            return "Old ID", item.oldID or ""

    parameter_prefix = "parameters."
    if field.startswith(parameter_prefix):
        parameter_path = field.removeprefix(parameter_prefix)
        if item.parameters is None:
            raise ValueError(f"Unsupported label parameter: {parameter_path}")

        value = _nested_parameter_value(item.parameters, parameter_path)
        return parameter_path, _format_parameter_value(value)

    raise ValueError(f"Unsupported label field: {field}")


def _text_width(draw: ImageDraw.ImageDraw, text: str, font: LabelFont) -> int:
    left, _, right, _ = draw.textbbox((0, 0), text, font=font)
    return ceil(right - left)


def _break_long_word(draw: ImageDraw.ImageDraw, word: str, font: LabelFont, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""

    for character in word:
        candidate = f"{current}{character}"
        if current and _text_width(draw, candidate, font) > max_width:
            lines.append(current)
            current = character
            continue

        current = candidate

    if current:
        lines.append(current)

    return lines


def _wrap_text(draw: ImageDraw.ImageDraw, text: str, font: LabelFont, max_width: int) -> list[str]:
    words = text.split()

    if not words:
        return [""]

    lines: list[str] = []
    current = ""

    for word in words:
        candidate = word if not current else f"{current} {word}"
        if _text_width(draw, candidate, font) <= max_width:
            current = candidate
            continue

        if current:
            lines.append(current)
            current = ""

        if _text_width(draw, word, font) <= max_width:
            current = word
            continue

        lines.extend(_break_long_word(draw, word, font, max_width))

    if current:
        lines.append(current)

    return lines


def _label_rows(item: Item, fields: list[str]) -> list[tuple[str, str]]:
    return [("ID", str(item.uuid)), *[_field_value(item, field) for field in fields]]


def _fit_text(
    draw: ImageDraw.ImageDraw,
    rows: list[tuple[str, str]],
    max_width: int,
    max_height: int,
) -> tuple[LabelFont, LabelFont, list[tuple[str, list[str]]], int, int, int]:
    max_size = min(MAX_FONT_SIZE, max(MIN_FONT_SIZE, max_height // 2))

    for value_size in range(max_size, MIN_FONT_SIZE - 1, -1):
        scaled_value_size = max(MIN_FONT_SIZE, round(value_size * FONT_SCALE_FACTOR))
        value_font = _load_font(scaled_value_size)
        label_font = _load_font(max(MIN_FONT_SIZE, round(scaled_value_size * 0.62)))
        line_height = max(scaled_value_size + 1, round(scaled_value_size * 1.18))
        label_height = max(MIN_FONT_SIZE + 1, round(scaled_value_size * 0.82))
        row_gap = max(1, round(scaled_value_size * 0.28))
        wrapped_rows = [(label, _wrap_text(draw, value, value_font, max_width)) for label, value in rows]
        content_height = sum(label_height + (len(lines) * line_height) + row_gap for _, lines in wrapped_rows)

        if content_height <= max_height:
            return value_font, label_font, wrapped_rows, line_height, label_height, row_gap

    value_font = _load_font(MIN_FONT_SIZE)
    label_font = _load_font(MIN_FONT_SIZE)
    line_height = MIN_FONT_SIZE + 1
    label_height = MIN_FONT_SIZE + 1
    row_gap = 1
    wrapped_rows = [(label, _wrap_text(draw, value, value_font, max_width)) for label, value in rows]

    return value_font, label_font, wrapped_rows, line_height, label_height, row_gap


def generate_label_image(
    item: Item,
    fields: list[str],
    image_format: LabelImageFormat,
    width_mm: float,
    height_mm: float,
) -> BytesIO:
    width = _mm_to_px(width_mm)
    height = _mm_to_px(height_mm)
    short_side = min(width, height)
    margin = max(4, round(short_side * 0.06))
    text_gap = max(4, round(short_side * 0.04))
    horizontal_layout = width >= height * 1.35

    measuring_image = Image.new("RGB", (width, height), "white")
    measuring_draw = ImageDraw.Draw(measuring_image)
    rows = _label_rows(item, fields)

    if horizontal_layout:
        qr_size = max(1, round(min(height - (margin * 2), width * 0.42)))
        text_x = margin + qr_size + text_gap
        text_y = margin
        max_text_width = max(1, width - text_x - margin)
        max_text_height = max(1, height - (margin * 2))
    else:
        qr_size = max(1, round(min(width - (margin * 2), height * 0.42)))
        text_x = margin
        text_y = margin + qr_size + text_gap
        max_text_width = max(1, width - (margin * 2))
        max_text_height = max(1, height - text_y - margin)

    value_font, label_font, wrapped_rows, line_height, label_height, row_gap = _fit_text(
        measuring_draw,
        rows,
        max_text_width,
        max_text_height,
    )

    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)

    qr_image = Image.open(generate_qr_image(item.uuid, "PNG")).resize((qr_size, qr_size))
    qr_x = margin if horizontal_layout else round((width - qr_size) / 2)
    image.paste(qr_image, (qr_x, margin))

    y = text_y
    max_y = text_y + max_text_height

    for label, lines in wrapped_rows:
        if y >= max_y:
            break

        draw.text((text_x, y), label.upper(), fill="#555555", font=label_font)
        y += label_height

        for line in lines:
            if y >= max_y:
                break

            draw.text((text_x, y), line, fill="black", font=value_font)
            y += line_height

        y += row_gap

    buffer = BytesIO()
    image.save(buffer, format=image_format)
    buffer.seek(0)

    return buffer


def generate_label_pdf(item: Item, fields: list[str], width_mm: float, height_mm: float) -> BytesIO:
    return generate_labels_pdf([item], fields, width_mm, height_mm)


def generate_labels_pdf(items: list[Item], fields: list[str], width_mm: float, height_mm: float) -> BytesIO:
    width = _mm_to_pdf_points(width_mm)
    height = _mm_to_pdf_points(height_mm)

    pdf_buffer = BytesIO()
    pdf = canvas.Canvas(pdf_buffer, pagesize=(width, height))

    for item in items:
        image_buffer = generate_label_image(item, fields, "PNG", width_mm, height_mm)
        image = Image.open(image_buffer)
        pdf.drawImage(ImageReader(image), 0, 0, width=width, height=height)
        pdf.showPage()

    pdf.save()
    pdf_buffer.seek(0)

    return pdf_buffer


def generate_labels_zip(items: list[Item], fields: list[str], width_mm: float, height_mm: float) -> BytesIO:
    zip_buffer = BytesIO()

    with ZipFile(zip_buffer, mode="w", compression=ZIP_DEFLATED) as archive:
        for item in items:
            image_buffer = generate_label_image(item, fields, "PNG", width_mm, height_mm)
            archive.writestr(f"item-{item.uuid}-label.png", image_buffer.getvalue())

    zip_buffer.seek(0)
    return zip_buffer
