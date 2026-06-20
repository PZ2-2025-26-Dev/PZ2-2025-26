"""Wczytywanie danych legacy z plików CSV lub zrzutu SQL phpMyAdmin."""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass, field
from pathlib import Path

LEGACY_TABLES = (
    "inv_budynki",
    "inv_pokoje",
    "inv_typy_urz",
    "inv_producenci",
    "inv_modele",
    "inv_urzadzenia",
    "pracownicy",
)

INSERT_PATTERN = re.compile(
    # Zmieniono `inv_[a-z_]+` na `[a-z_]+`, aby łapało też tabelę "pracownicy"
    r"INSERT\s+INTO\s+`(?P<table>[a-z_]+)`\s*\((?P<columns>[^)]+)\)\s*VALUES\s*(?P<values>.+?);",
    re.IGNORECASE | re.DOTALL,
)


@dataclass
class LegacyDataset:
    users: list[dict[str, str]] = field(default_factory=list)
    buildings: list[dict[str, str]] = field(default_factory=list)
    rooms: list[dict[str, str]] = field(default_factory=list)
    device_types: list[dict[str, str]] = field(default_factory=list)
    producers: list[dict[str, str]] = field(default_factory=list)
    models: list[dict[str, str]] = field(default_factory=list)
    devices: list[dict[str, str]] = field(default_factory=list)


def find_repo_root(start: Path) -> Path:
    for candidate in (start, *start.parents):
        if (candidate / "compose.yaml").exists():
            return candidate
    return start.parents[2] if len(start.parents) > 2 else start


def default_legacy_dir() -> Path:
    docker_mount = Path("/app/legacy")
    if docker_mount.is_dir():
        return docker_mount

    repo_root = find_repo_root(Path(__file__).resolve())
    return repo_root / "backend" / "legacy"


def default_sql_file() -> Path:
    docker_mount = Path("/app/sample_dump.sql")
    if docker_mount.is_file():
        return docker_mount

    repo_root = find_repo_root(Path(__file__).resolve())
    return repo_root / "backend" / "sample_dump.sql"


def _normalize_row(columns: list[str], values: list[str | None]) -> dict[str, str]:
    return {
        column.strip("` \n\r\t"): "" if value is None else str(value)
        for column, value in zip(columns, values, strict=True)
    }


def _read_csv_table(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def _parse_sql_value(token: str) -> str | None:
    token = token.strip()
    if not token or token.upper() == "NULL":
        return None
    if token.startswith("'") and token.endswith("'"):
        inner = token[1:-1]
        return inner.replace("\\'", "'").replace('\\"', '"').replace("\\\\", "\\")
    return token


def _split_sql_tuple(tuple_body: str) -> list[str | None]:
    values: list[str | None] = []
    current: list[str] = []
    in_string = False
    index = 0

    while index < len(tuple_body):
        char = tuple_body[index]

        if in_string:
            if char == "\\" and index + 1 < len(tuple_body):
                current.append(char)
                current.append(tuple_body[index + 1])
                index += 2
                continue
            if char == "'":
                in_string = False
                index += 1
                continue
            current.append(char)
            index += 1
            continue

        if char == "'":
            in_string = True
            index += 1
            continue

        if char == ",":
            values.append(_parse_sql_value("".join(current)))
            current = []
            index += 1
            continue

        current.append(char)
        index += 1

    values.append(_parse_sql_value("".join(current)))
    return values


def _parse_sql_values_section(values_section: str) -> list[list[str | None]]:
    rows: list[list[str | None]] = []
    index = 0
    length = len(values_section)

    while index < length:
        if values_section[index] != "(":
            index += 1
            continue

        depth = 0
        start = index
        in_string = False

        while index < length:
            char = values_section[index]
            if in_string:
                if char == "\\" and index + 1 < length:
                    index += 2
                    continue
                if char == "'":
                    in_string = False
                index += 1
                continue

            if char == "'":
                in_string = True
            elif char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                if depth == 0:
                    tuple_body = values_section[start + 1 : index]
                    rows.append(_split_sql_tuple(tuple_body))
                    index += 1
                    break
            index += 1

    return rows


def parse_sql_inserts(sql_text: str) -> dict[str, list[dict[str, str]]]:
    parsed: dict[str, list[dict[str, str]]] = {table: [] for table in LEGACY_TABLES}

    for match in INSERT_PATTERN.finditer(sql_text):
        table = match.group("table")
        if table not in parsed:
            continue

        columns = [column.strip("` \n\r\t") for column in match.group("columns").split(",")]
        for row_values in _parse_sql_values_section(match.group("values")):
            parsed[table].append(_normalize_row(columns, row_values))

    return parsed


def load_legacy_from_csv(legacy_dir: Path) -> LegacyDataset:
    required = {
        "users": legacy_dir / "pracownicy.csv",
        "buildings": legacy_dir / "inv_budynki.csv",
        "rooms": legacy_dir / "inv_pokoje.csv",
        "device_types": legacy_dir / "inv_typy_urz.csv",
        "producers": legacy_dir / "inv_producenci.csv",
        "models": legacy_dir / "inv_modele.csv",
        "devices": legacy_dir / "inv_urzadzenia.csv",
    }

    missing = [path.name for path in required.values() if not path.is_file()]
    if missing:
        missing_list = ", ".join(sorted(missing))
        raise FileNotFoundError(
            f"Brakuje plików CSV w {legacy_dir}: {missing_list}. "
            "Uruchom najpierw: python -m src.import_koidc extract --sql-file <dump.sql>"
        )

    return LegacyDataset(
        users=_read_csv_table(required["users"]),
        buildings=_read_csv_table(required["buildings"]),
        rooms=_read_csv_table(required["rooms"]),
        device_types=_read_csv_table(required["device_types"]),
        producers=_read_csv_table(required["producers"]),
        models=_read_csv_table(required["models"]),
        devices=_read_csv_table(required["devices"]),
    )


def load_legacy_from_text(sql_text: str) -> LegacyDataset:
    parsed = parse_sql_inserts(sql_text)

    missing_tables = [table for table in LEGACY_TABLES if not parsed[table]]
    if missing_tables:
        missing_list = ", ".join(missing_tables)
        raise ValueError(f"W pliku SQL nie znaleziono danych dla tabel: {missing_list}")

    return LegacyDataset(
        users=parsed["pracownicy"],
        buildings=parsed["inv_budynki"],
        rooms=parsed["inv_pokoje"],
        device_types=parsed["inv_typy_urz"],
        producers=parsed["inv_producenci"],
        models=parsed["inv_modele"],
        devices=parsed["inv_urzadzenia"],
    )


def load_legacy_from_sql(sql_path: Path) -> LegacyDataset:
    sql_text = sql_path.read_text(encoding="utf-8", errors="replace")
    return load_legacy_from_text(sql_text)


def write_legacy_csv(dataset: LegacyDataset, legacy_dir: Path) -> None:
    legacy_dir.mkdir(parents=True, exist_ok=True)

    table_map = {
        "pracownicy.csv": (dataset.users, ["id", "imie", "nazwisko", "email", "widocznosc", "pokoj", "tel"]),
        "inv_budynki.csv": (dataset.buildings, ["id", "nazwa", "opis"]),
        "inv_pokoje.csv": (dataset.rooms, ["id", "id_budynku", "nazwa", "opis"]),
        "inv_typy_urz.csv": (dataset.device_types, ["id", "nazwa", "short"]),
        "inv_producenci.csv": (dataset.producers, ["id", "nazwa"]),
        "inv_modele.csv": (dataset.models, ["id", "id_typu", "id_producenta", "nazwa", "opis"]),
        "inv_urzadzenia.csv": (
            dataset.devices,
            [
                "id",
                "id_pokoju",
                "id_pracownika",
                "id_modelu",
                "ostatnia_mod",
                "serial",
                "nr_inw",
                "opis",
                "wypozyczony",
            ],
        ),
    }

    for filename, (rows, fieldnames) in table_map.items():
        target = legacy_dir / filename
        with target.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
