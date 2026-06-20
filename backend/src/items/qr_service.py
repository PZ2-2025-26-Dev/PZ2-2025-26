from io import BytesIO
from typing import Literal
from uuid import UUID

import qrcode
from qrcode.constants import ERROR_CORRECT_M

type QRImageFormat = Literal["PNG"]


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
