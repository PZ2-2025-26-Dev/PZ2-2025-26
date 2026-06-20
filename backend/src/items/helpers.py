from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.locations.models import Location

from src.users.models import User


def format_user_name(user: User) -> str:
    if user.last_name:
        return f"{user.first_name} {user.last_name}"
    return user.first_name


def build_location_path(location: Location) -> str:
    parts: list[str] = []

    current: Location | None = location

    while current is not None:
        parts.append(current.name)
        current = current.parent

    return " / ".join(reversed(parts))
