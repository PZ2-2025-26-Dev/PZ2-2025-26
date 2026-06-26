"""Wczytywanie zrzutu SQL phpMyAdmin do bazy bez parsowania danych."""

from __future__ import annotations

import re
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Connection

LEGACY_TABLES: tuple[str, ...] = (
    "inv_budynki",
    "inv_pokoje",
    "inv_typy_urz",
    "inv_producenci",
    "inv_modele",
    "inv_urzadzenia",
    "pracownicy",
)


def find_repo_root(start: Path) -> Path:
    for candidate in (start, *start.parents):
        if (candidate / "compose.yaml").exists():
            return candidate
    return start.parents[2] if len(start.parents) > 2 else start


def default_sql_file() -> Path:
    docker_mount = Path("/app/sample_dump.sql")
    if docker_mount.is_file():
        return docker_mount

    repo_root = find_repo_root(Path(__file__).resolve())
    return repo_root / "backend" / "sample_dump.sql"


def _strip_database_directives(sql_text: str) -> str:
    """Usuwa CREATE DATABASE / USE — nie zmienia danych w INSERT-ach."""
    kept_lines: list[str] = []
    for line in sql_text.splitlines():
        stripped = line.strip().upper()
        if stripped.startswith("CREATE DATABASE"):
            continue
        if stripped.startswith("USE "):
            continue
        kept_lines.append(line)
    return "\n".join(kept_lines)


_CREATE_TABLE_PATTERN = re.compile(
    r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`([^`]+)`",
    re.IGNORECASE,
)


def extract_dump_table_names(sql_path: Path) -> set[str]:
    """Nazwy tabel ze zrzutu (CREATE TABLE) — bez parsowania INSERT-ów."""
    sql_text = _strip_database_directives(sql_path.read_text(encoding="utf-8", errors="replace"))
    return set(_CREATE_TABLE_PATTERN.findall(sql_text))


def cleanup_dump_staging(
    connection: Connection,
    sql_path: Path,
    *,
    loaded_tables: set[str] | None = None,
) -> None:
    """Usuwa tabele stagingowe ze zrzutu (np. po przerwaniu importu)."""
    tables = extract_dump_table_names(sql_path)
    if loaded_tables:
        tables |= loaded_tables
    drop_tables(connection, tables)


def _get_dbapi_connection(connection: Connection):
    raw = connection.connection
    for attr in ("driver_connection", "dbapi_connection", "connection"):
        candidate = getattr(raw, attr, None)
        if candidate is not None and hasattr(candidate, "cursor"):
            return candidate
    if hasattr(raw, "cursor"):
        return raw
    raise RuntimeError("Nie udało się uzyskać połączenia DBAPI dla importu SQL.")


def load_sql_dump(connection: Connection, sql_path: Path) -> None:
    """Wykonuje plik SQL w bieżącej transakcji połączenia SQLAlchemy."""
    sql_text = _strip_database_directives(sql_path.read_text(encoding="utf-8", errors="replace"))
    if not sql_text.strip():
        raise ValueError(f"Plik SQL jest pusty: {sql_path}")

    driver = _get_dbapi_connection(connection)

    cursor = driver.cursor()
    try:
        cursor.execute(sql_text)
        while cursor.nextset():
            pass
    finally:
        cursor.close()


def legacy_tables_present(connection: Connection) -> list[str]:
    missing: list[str] = []
    for table in LEGACY_TABLES:
        exists = connection.execute(
            text(
                "SELECT COUNT(*) FROM information_schema.tables "
                "WHERE table_schema = DATABASE() AND table_name = :table_name"
            ),
            {"table_name": table},
        ).scalar_one()
        if not exists:
            missing.append(table)
    return missing


def snapshot_table_names(connection: Connection) -> set[str]:
    rows = connection.execute(
        text("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()")
    ).scalars()
    return set(rows)


def drop_tables(connection: Connection, table_names: set[str]) -> None:
    if not table_names:
        return

    connection.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
    for table in sorted(table_names):
        connection.execute(text(f"DROP TABLE IF EXISTS `{table}`"))
    connection.execute(text("SET FOREIGN_KEY_CHECKS = 1"))


def drop_legacy_tables(connection: Connection) -> None:
    drop_tables(connection, set(LEGACY_TABLES))


def assert_legacy_tables_loaded(connection: Connection) -> None:
    missing = legacy_tables_present(connection)
    if missing:
        missing_list = ", ".join(missing)
        raise ValueError(f"Po wczytaniu zrzutu brakuje tabel legacy: {missing_list}")
