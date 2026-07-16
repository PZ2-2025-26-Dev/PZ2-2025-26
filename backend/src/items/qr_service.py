from io import BytesIO
from typing import Literal
from uuid import UUID

import qrcode
from qrcode.constants import ERROR_CORRECT_M
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

type QRImageFormat = Literal["PNG"]

QR_PDF_SIZE_MM = 50
MM_PER_INCH = 25.4
PDF_POINTS_PER_INCH = 72


def generate_qr_image(payload: UUID, image_format: QRImageFormat) -> BytesIO:
    qr = qrcode.QRCode(
        error_correction=ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(str(payload))
    qr.make(fit=True)

    qr_image = qr.make_image(fill_color="black", back_color="white")
    image = qr_image.get_image().convert("RGB")
    buffer = BytesIO()
    image.save(buffer, format=image_format)
    buffer.seek(0)

    return buffer


def generate_qr_pdf(payload: UUID) -> BytesIO:
    size = QR_PDF_SIZE_MM / MM_PER_INCH * PDF_POINTS_PER_INCH
    qr_image = generate_qr_image(payload, "PNG")

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(size, size))
    pdf.drawImage(ImageReader(qr_image), 0, 0, width=size, height=size)
    pdf.showPage()
    pdf.save()
    buffer.seek(0)

    return buffer
