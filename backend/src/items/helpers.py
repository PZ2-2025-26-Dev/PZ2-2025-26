def build_location_path(location) -> str:
    parts = []

    current = location

    while current is not None:
        parts.append(current.name)
        current = current.parent

    return " / ".join(reversed(parts))
