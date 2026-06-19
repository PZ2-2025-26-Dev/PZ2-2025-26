from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.locations.models import Location


def build_location_path(location: Location) -> str:
    parts: list[str] = []

    current: Location | None = location

    while current is not None:
        parts.append(current.name)
        current = current.parent

    return " / ".join(reversed(parts))
