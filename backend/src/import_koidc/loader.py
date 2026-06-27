"""Wczytywanie zrzutu SQL phpMyAdmin do bazy bez parsowania danych."""

from __future__ import annotations

import re
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Connection

from src.import_koidc.constants import LEGACY_STAGING_TABLE_PREFIX

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


def staging_table_name(legacy_name: str) -> str:
    return f"{LEGACY_STAGING_TABLE_PREFIX}{legacy_name}"


def legacy_table(table: str) -> str:
    return f"`{staging_table_name(table)}`"


def _prefix_dump_table_names(sql_text: str, table_names: set[str]) -> str:
    for table in sorted(table_names, key=len, reverse=True):
        sql_text = sql_text.replace(f"`{table}`", f"`{staging_table_name(table)}`")
    return sql_text


def prepare_legacy_staging_tables(connection: Connection) -> None:
    """Usuwa tabele stagingowe z poprzedniego importu (prefiks _koidc_stg_)."""
    drop_legacy_staging_tables(connection)


def drop_legacy_staging_tables(connection: Connection) -> None:
    drop_tables(connection, staging_table_names(connection))


def staging_table_names(connection: Connection) -> set[str]:
    rows = connection.execute(
        text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = DATABASE() AND table_name LIKE :pattern"
        ),
        {"pattern": f"{LEGACY_STAGING_TABLE_PREFIX}%"},
    ).scalars()
    return set(rows)


def cleanup_dump_staging(connection: Connection) -> None:
    """Usuwa tabele stagingowe (np. po przerwaniu importu)."""
    drop_legacy_staging_tables(connection)


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
    """Wykonuje plik SQL z tabelami legacy pod prefiksem stagingowym w bieżącej bazie."""
    sql_text = _strip_database_directives(sql_path.read_text(encoding="utf-8", errors="replace"))
    if not sql_text.strip():
        raise ValueError(f"Plik SQL jest pusty: {sql_path}")

    dump_tables = set(_CREATE_TABLE_PATTERN.findall(sql_text))
    sql_text = _prefix_dump_table_names(sql_text, dump_tables)

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
            {"table_name": staging_table_name(table)},
        ).scalar_one()
        if not exists:
            missing.append(table)
    return missing


def drop_tables(connection: Connection, table_names: set[str]) -> None:
    if not table_names:
        return

    connection.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
    try:
        for table in sorted(table_names):
            connection.execute(text(f"DROP TABLE IF EXISTS `{table}`"))
    finally:
        connection.execute(text("SET FOREIGN_KEY_CHECKS = 1"))


def drop_legacy_tables(connection: Connection) -> None:
    drop_tables(connection, {staging_table_name(table) for table in LEGACY_TABLES})


def assert_legacy_tables_loaded(connection: Connection) -> None:
    missing = legacy_tables_present(connection)
    if missing:
        missing_list = ", ".join(missing)
        raise ValueError(f"Po wczytaniu zrzutu brakuje tabel legacy: {missing_list}")
