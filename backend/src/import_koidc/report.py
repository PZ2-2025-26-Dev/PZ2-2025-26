"""Podgląd etapów i raporty z importu koidc."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Connection

from src.import_koidc.constants import ImportStage
from src.import_koidc.loader import LEGACY_TABLES, find_repo_root
from src.import_koidc.sql_migrate import LEGACY_EMAIL_DOMAIN

ISSUE_MISSING_EMAIL = "brak_email"
ISSUE_MISSING_FIRST_NAME = "brak_imienia"
ISSUE_DUPLICATE_EMAIL_IN_SOURCE = "duplikat_email_w_zrodle"
ISSUE_EMAIL_CONFLICT_IN_TARGET = "konflikt_email_w_bazie"
ISSUE_MISSING_BUILDING_FOR_ROOM = "brak_budynku_dla_pokoju"
ISSUE_MISSING_CATEGORY_NAME = "brak_nazwy_kategorii"
ISSUE_ITEM_MISSING_MODEL = "brak_modelu"
ISSUE_ITEM_MISSING_ROOM = "brak_pokoju"
ISSUE_ITEM_INVALID_ROOM = "nieistniejacy_pokoj"
ISSUE_ITEM_FALLBACK_OWNER = "wlasciciel_fallback"


@dataclass
class ImportIssue:
    entity: str
    legacy_id: str
    reason: str
    detail: str = ""

    @property
    def reason_label(self) -> str:
        return _REASON_LABELS.get(self.reason, self.reason)


_REASON_LABELS: dict[str, str] = {
    ISSUE_MISSING_EMAIL: "Brak adresu e-mail (zostanie wygenerowany)",
    ISSUE_MISSING_FIRST_NAME: "Brak imienia (zostanie ustawione „Nieznany”)",
    ISSUE_DUPLICATE_EMAIL_IN_SOURCE: "Duplikat e-maila w źródle (zostanie zmodyfikowany)",
    ISSUE_EMAIL_CONFLICT_IN_TARGET: "Konflikt e-maila z istniejącym użytkownikiem w bazie",
    ISSUE_MISSING_BUILDING_FOR_ROOM: "Pokój bez istniejącego budynku (pominięty)",
    ISSUE_MISSING_CATEGORY_NAME: "Brak nazwy kategorii (zostanie wygenerowana)",
    ISSUE_ITEM_MISSING_MODEL: "Brak modelu (przedmiot pominięty)",
    ISSUE_ITEM_MISSING_ROOM: "Brak przypisanego pokoju (przedmiot pominięty)",
    ISSUE_ITEM_INVALID_ROOM: "Nieistniejący lub niepoprawny pokój (przedmiot pominięty)",
    ISSUE_ITEM_FALLBACK_OWNER: "Brak lub nieznany właściciel (przypisany użytkownik fallback)",
}


@dataclass
class StagePreview:
    stage: ImportStage
    summary_lines: list[str] = field(default_factory=list)
    issues: list[ImportIssue] = field(default_factory=list)


@dataclass
class StageResult:
    stage: ImportStage
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    summary_lines: list[str] = field(default_factory=list)
    issues: list[ImportIssue] = field(default_factory=list)
    executed: bool = False


@dataclass
class ImportReport:
    dry_run: bool
    committed: bool
    stages: list[StageResult] = field(default_factory=list)
    aborted_at: ImportStage | None = None
    abort_reason: str | None = None

    @property
    def all_issues(self) -> list[ImportIssue]:
        issues: list[ImportIssue] = []
        for stage in self.stages:
            issues.extend(stage.issues)
        return issues


def format_stage_preview(preview: StagePreview) -> str:
    lines = [
        "=" * 72,
        f"PODGLĄD ETAPU: {preview.stage.label}",
        "=" * 72,
    ]
    lines.extend(preview.summary_lines)
    lines.append("")
    lines.extend(_format_issues_section(preview.issues, skipped_only=False))
    return "\n".join(lines)


def format_stage_result(result: StageResult) -> str:
    lines = [
        "-" * 72,
        f"WYNIK ETAPU: {result.stage.label}",
        "-" * 72,
        f"Nowe rekordy: {result.inserted}",
        f"Zaktualizowane: {result.updated}",
        f"Pominięte: {result.skipped}",
    ]
    lines.extend(result.summary_lines)
    lines.append("")
    lines.extend(_format_issues_section(result.issues, skipped_only=False))
    return "\n".join(lines)


def format_import_report(report: ImportReport) -> str:
    lines = [
        "=" * 72,
        "RAPORT IMPORTU KOIDC",
        "=" * 72,
        f"Tryb: {'DRY-RUN (bez zapisu)' if report.dry_run else 'IMPORT'}",
        f"Zapis do bazy: {'TAK' if report.committed else 'NIE'}",
    ]

    if report.aborted_at is not None:
        lines.append(f"Przerwano na etapie: {report.aborted_at.label}")
        if report.abort_reason:
            lines.append(f"Powód: {report.abort_reason}")

    lines.append("")
    for result in report.stages:
        if result.executed:
            lines.append(format_stage_result(result))

    skipped_issues = [issue for issue in report.all_issues if _is_skipped_issue(issue)]
    warning_issues = [issue for issue in report.all_issues if not _is_skipped_issue(issue)]

    lines.append("=" * 72)
    lines.append("PODSUMOWANIE PROBLEMÓW")
    lines.append("=" * 72)
    lines.append(f"Ostrzeżenia (dane zaimportowane z obejściem): {len(warning_issues)}")
    lines.append(f"Pominięte rekordy: {len(skipped_issues)}")
    lines.append("")
    lines.extend(_format_issues_section(warning_issues, skipped_only=False, title="Ostrzeżenia"))
    lines.extend(_format_issues_section(skipped_issues, skipped_only=True, title="Pominięte rekordy"))
    return "\n".join(lines)


def default_report_file() -> Path:
    timestamp = datetime.now(tz=UTC).strftime("%Y%m%d_%H%M%S")
    filename = f"koidc_import_report_{timestamp}.txt"
    module_path = Path(__file__).resolve()

    docker_app = Path("/app")
    if docker_app.is_dir() and module_path.is_relative_to(docker_app):
        return docker_app / "import_reports" / filename

    repo_root = find_repo_root(module_path)
    return repo_root / "backend" / "import_reports" / filename


def write_import_report(report: ImportReport, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(format_import_report(report), encoding="utf-8")
    return path


def _is_skipped_issue(issue: ImportIssue) -> bool:
    return issue.reason in {
        ISSUE_MISSING_BUILDING_FOR_ROOM,
        ISSUE_ITEM_MISSING_MODEL,
        ISSUE_ITEM_MISSING_ROOM,
        ISSUE_ITEM_INVALID_ROOM,
        ISSUE_EMAIL_CONFLICT_IN_TARGET,
    }


def _format_issues_section(
    issues: list[ImportIssue],
    *,
    skipped_only: bool,
    title: str | None = None,
) -> list[str]:
    if not issues:
        if title:
            return [f"{title}: brak", ""]
        return ["Brak zgłoszonych problemów.", ""]

    grouped: dict[str, list[ImportIssue]] = {}
    for issue in issues:
        grouped.setdefault(issue.reason_label, []).append(issue)

    lines: list[str] = []
    if title:
        lines.append(f"{title} ({len(issues)}):")
    for reason_label, reason_issues in grouped.items():
        lines.append(f"  • {reason_label}: {len(reason_issues)}")
        for issue in reason_issues[:15]:
            detail = f" — {issue.detail}" if issue.detail else ""
            lines.append(f"      - {issue.entity} id={issue.legacy_id}{detail}")
        if len(reason_issues) > 15:
            lines.append(f"      … i {len(reason_issues) - 15} więcej")
    lines.append("")
    return lines


def _legacy_row_count(connection: Connection, table: str) -> int:
    return connection.execute(text(f"SELECT COUNT(*) FROM `{table}`")).scalar_one()


def fetch_existing_ids(connection: Connection, table: str) -> set[int]:
    return set(connection.execute(text(f"SELECT id FROM `{table}`")).scalars().all())


def _source_ids(connection: Connection, table: str) -> set[int]:
    return set(connection.execute(text(f"SELECT id FROM `{table}`")).scalars().all())


def preview_load(sql_path: Path, *, clear_existing: bool) -> StagePreview:
    size_kb = sql_path.stat().st_size / 1024
    summary = [
        f"Plik zrzutu: {sql_path}",
        f"Rozmiar: {size_kb:.1f} KiB",
        f"Czyszczenie istniejących danych PZ2: {'TAK' if clear_existing else 'NIE'}",
        "Tabele stagingowe do utworzenia m.in.: " + ", ".join(LEGACY_TABLES),
    ]
    if clear_existing:
        summary.append(
            "UWAGA: --clear-existing usunie istniejące user/location/category/item przed importem."
        )
    return StagePreview(stage=ImportStage.LOAD, summary_lines=summary)


def preview_after_load(connection: Connection, loaded_tables: set[str]) -> list[str]:
    lines = [f"Utworzono tabel ze zrzutu: {len(loaded_tables)}"]
    for table in LEGACY_TABLES:
        if table in loaded_tables:
            lines.append(f"  • {table}: {_legacy_row_count(connection, table)} rekordów")
    extra = sorted(loaded_tables - set(LEGACY_TABLES))
    if extra:
        lines.append(f"Dodatkowe tabele ze zrzutu (zostaną usunięte): {', '.join(extra)}")
    return lines


def preview_users(connection: Connection) -> StagePreview:
    total = _legacy_row_count(connection, "pracownicy")
    existing_ids = fetch_existing_ids(connection, "user")
    source_ids = _source_ids(connection, "pracownicy")

    summary = [
        f"Rekordów w źródle (pracownicy): {total}",
        f"Nowych użytkowników: {len(source_ids - existing_ids)}",
        f"Do aktualizacji (istniejące ID): {len(source_ids & existing_ids)}",
        "Domyślny status importowanych użytkowników: INACTIVE",
    ]
    return StagePreview(
        stage=ImportStage.USERS,
        summary_lines=summary,
        issues=_collect_user_issues(connection),
    )


def preview_categories(connection: Connection) -> StagePreview:
    total = _legacy_row_count(connection, "inv_typy_urz")
    existing_ids = fetch_existing_ids(connection, "category")
    source_ids = _source_ids(connection, "inv_typy_urz")

    summary = [
        f"Rekordów w źródle (inv_typy_urz): {total}",
        f"Nowych kategorii: {len(source_ids - existing_ids)}",
        f"Do aktualizacji: {len(source_ids & existing_ids)}",
        "Dodatkowo: kategoria fallback „Niesklasyfikowane” (id=9999)",
    ]
    return StagePreview(
        stage=ImportStage.CATEGORIES,
        summary_lines=summary,
        issues=_collect_category_issues(connection),
    )


def preview_locations(connection: Connection) -> StagePreview:
    buildings = _legacy_row_count(connection, "inv_budynki")
    rooms = _legacy_row_count(connection, "inv_pokoje")
    importable_rooms = connection.execute(
        text(
            """
            SELECT COUNT(*)
            FROM inv_pokoje AS p
            INNER JOIN inv_budynki AS b ON b.id = p.id_budynku
            """
        )
    ).scalar_one()
    skipped_rooms = rooms - importable_rooms

    summary = [
        f"Budynków w źródle: {buildings}",
        f"Pokoi w źródle: {rooms}",
        f"Pokoi do importu: {importable_rooms}",
        f"Pokoi pominiętych: {skipped_rooms}",
        "ID pokoi w PZ2: stare ID + 10000",
    ]
    return StagePreview(
        stage=ImportStage.LOCATIONS,
        summary_lines=summary,
        issues=_collect_location_issues(connection),
    )


def preview_items(connection: Connection) -> StagePreview:
    total = _legacy_row_count(connection, "inv_urzadzenia")
    importable = connection.execute(
        text(
            """
            SELECT COUNT(*)
            FROM inv_urzadzenia AS d
            INNER JOIN inv_modele AS m ON m.id = d.id_modelu
            INNER JOIN inv_pokoje AS pok ON pok.id = d.id_pokoju
            INNER JOIN inv_budynki AS b ON b.id = pok.id_budynku
            WHERE COALESCE(d.id_pokoju, 0) > 0
            """
        )
    ).scalar_one()
    skipped = total - importable

    summary = [
        f"Urządzeń w źródle: {total}",
        f"Przedmiotów do importu: {importable}",
        f"Przedmiotów pominiętych: {skipped}",
    ]
    return StagePreview(
        stage=ImportStage.ITEMS,
        summary_lines=summary,
        issues=_collect_item_issues(connection),
    )


def preview_cleanup(loaded_tables: set[str]) -> StagePreview:
    summary = [
        f"Tabel stagingowych do usunięcia: {len(loaded_tables)}",
        "Po tym etapie zostaną tylko dane w tabelach PZ2.",
    ]
    if loaded_tables:
        summary.append("Tabele: " + ", ".join(sorted(loaded_tables)))
    return StagePreview(stage=ImportStage.CLEANUP, summary_lines=summary)


def build_users_result(
    connection: Connection,
    *,
    existing_before: set[int],
) -> StageResult:
    source_ids = _source_ids(connection, "pracownicy")
    inserted = len(source_ids - existing_before)
    updated = len(source_ids & existing_before)
    return StageResult(
        stage=ImportStage.USERS,
        inserted=inserted,
        updated=updated,
        summary_lines=[f"Zaimportowano użytkowników: {len(source_ids)}"],
        issues=_collect_user_issues(connection),
        executed=True,
    )


def build_categories_result(
    connection: Connection,
    *,
    existing_before: set[int],
) -> StageResult:
    source_ids = _source_ids(connection, "inv_typy_urz")
    inserted = len(source_ids - existing_before)
    updated = len(source_ids & existing_before)
    return StageResult(
        stage=ImportStage.CATEGORIES,
        inserted=inserted + 1,
        updated=updated,
        summary_lines=[f"Kategorie źródłowe: {len(source_ids)} + 1 fallback"],
        issues=_collect_category_issues(connection),
        executed=True,
    )


def build_locations_result(
    connection: Connection,
    *,
    existing_before: set[int],
) -> StageResult:
    building_ids = _source_ids(connection, "inv_budynki")
    room_ids = {
        room_id + 10_000
        for room_id in connection.execute(
            text(
                """
                SELECT p.id
                FROM inv_pokoje AS p
                INNER JOIN inv_budynki AS b ON b.id = p.id_budynku
                """
            )
        ).scalars().all()
    }
    all_ids = building_ids | room_ids
    inserted = len(all_ids - existing_before)
    updated = len(all_ids & existing_before)
    issues = _collect_location_issues(connection)
    return StageResult(
        stage=ImportStage.LOCATIONS,
        inserted=inserted,
        updated=updated,
        skipped=len(issues),
        summary_lines=[
            f"Budynki: {len(building_ids)}",
            f"Pokoje zaimportowane: {len(room_ids)}",
        ],
        issues=issues,
        executed=True,
    )


def build_items_result(connection: Connection, *, existing_before: set[int]) -> StageResult:
    importable_ids = set(
        connection.execute(
            text(
                """
                SELECT d.id
                FROM inv_urzadzenia AS d
                INNER JOIN inv_modele AS m ON m.id = d.id_modelu
                INNER JOIN inv_pokoje AS pok ON pok.id = d.id_pokoju
                INNER JOIN inv_budynki AS b ON b.id = pok.id_budynku
                WHERE COALESCE(d.id_pokoju, 0) > 0
                """
            )
        ).scalars().all()
    )
    inserted = len(importable_ids - existing_before)
    updated = len(importable_ids & existing_before)
    issues = _collect_item_issues(connection)
    skipped = len([issue for issue in issues if _is_skipped_issue(issue)])
    return StageResult(
        stage=ImportStage.ITEMS,
        inserted=inserted,
        updated=updated,
        skipped=skipped,
        summary_lines=[f"Przedmioty zaimportowane: {len(importable_ids)}"],
        issues=issues,
        executed=True,
    )


def build_load_result(summary_lines: list[str]) -> StageResult:
    return StageResult(stage=ImportStage.LOAD, summary_lines=summary_lines, executed=True)


def build_cleanup_result(dropped_tables: set[str]) -> StageResult:
    return StageResult(
        stage=ImportStage.CLEANUP,
        summary_lines=[f"Usunięto tabel: {len(dropped_tables)}"],
        executed=True,
    )


def _collect_user_issues(connection: Connection) -> list[ImportIssue]:
    issues: list[ImportIssue] = []

    for row in connection.execute(
        text(
            """
            SELECT id, COALESCE(NULLIF(TRIM(email), ''), '') AS email
            FROM pracownicy
            WHERE NULLIF(TRIM(email), '') IS NULL
            """
        )
    ).mappings():
        issues.append(
            ImportIssue(
                entity="user",
                legacy_id=str(row["id"]),
                reason=ISSUE_MISSING_EMAIL,
                detail=f"zostanie użyty brak_maila_{{id}}@{LEGACY_EMAIL_DOMAIN}",
            )
        )

    for row in connection.execute(
        text(
            """
            SELECT id, COALESCE(NULLIF(TRIM(imie), ''), '') AS first_name
            FROM pracownicy
            WHERE NULLIF(TRIM(imie), '') IS NULL
            """
        )
    ).mappings():
        issues.append(
            ImportIssue(
                entity="user",
                legacy_id=str(row["id"]),
                reason=ISSUE_MISSING_FIRST_NAME,
            )
        )

    for row in connection.execute(
        text(
            """
            SELECT
                LOWER(TRIM(email)) AS email,
                GROUP_CONCAT(id ORDER BY id) AS ids,
                COUNT(*) AS duplicate_count
            FROM pracownicy
            WHERE NULLIF(TRIM(email), '') IS NOT NULL
            GROUP BY LOWER(TRIM(email))
            HAVING COUNT(*) > 1
            """
        )
    ).mappings():
        issues.append(
            ImportIssue(
                entity="user",
                legacy_id=str(row["ids"]),
                reason=ISSUE_DUPLICATE_EMAIL_IN_SOURCE,
                detail=f"email={row['email']}, liczba={row['duplicate_count']}",
            )
        )

    for row in connection.execute(
        text(
            """
            SELECT
                p.id AS legacy_id,
                p.email AS legacy_email,
                u.id AS existing_id,
                u.email AS existing_email
            FROM pracownicy AS p
            INNER JOIN user AS u ON LOWER(TRIM(p.email)) = LOWER(u.email)
            WHERE NULLIF(TRIM(p.email), '') IS NOT NULL
              AND p.id != u.id
            """
        )
    ).mappings():
        issues.append(
            ImportIssue(
                entity="user",
                legacy_id=str(row["legacy_id"]),
                reason=ISSUE_EMAIL_CONFLICT_IN_TARGET,
                detail=(
                    f"źródło email={row['legacy_email']}, "
                    f"istniejący user id={row['existing_id']} email={row['existing_email']}"
                ),
            )
        )

    return issues


def _collect_category_issues(connection: Connection) -> list[ImportIssue]:
    issues: list[ImportIssue] = []
    for row in connection.execute(
        text(
            """
            SELECT id
            FROM inv_typy_urz
            WHERE NULLIF(TRIM(nazwa), '') IS NULL
            """
        )
    ).mappings():
        issues.append(
            ImportIssue(
                entity="category",
                legacy_id=str(row["id"]),
                reason=ISSUE_MISSING_CATEGORY_NAME,
            )
        )
    return issues


def _collect_location_issues(connection: Connection) -> list[ImportIssue]:
    issues: list[ImportIssue] = []
    for row in connection.execute(
        text(
            """
            SELECT p.id, p.id_budynku
            FROM inv_pokoje AS p
            WHERE NOT EXISTS (SELECT 1 FROM inv_budynki AS b WHERE b.id = p.id_budynku)
            """
        )
    ).mappings():
        issues.append(
            ImportIssue(
                entity="location",
                legacy_id=str(row["id"]),
                reason=ISSUE_MISSING_BUILDING_FOR_ROOM,
                detail=f"id_budynku={row['id_budynku']}",
            )
        )
    return issues


def _collect_item_issues(connection: Connection) -> list[ImportIssue]:
    issues: list[ImportIssue] = []

    for row in connection.execute(
        text(
            """
            SELECT d.id, d.id_modelu
            FROM inv_urzadzenia AS d
            WHERE NOT EXISTS (SELECT 1 FROM inv_modele AS m WHERE m.id = d.id_modelu)
            """
        )
    ).mappings():
        issues.append(
            ImportIssue(
                entity="item",
                legacy_id=str(row["id"]),
                reason=ISSUE_ITEM_MISSING_MODEL,
                detail=f"id_modelu={row['id_modelu']}",
            )
        )

    for row in connection.execute(
        text(
            """
            SELECT d.id, d.id_pokoju
            FROM inv_urzadzenia AS d
            WHERE COALESCE(d.id_pokoju, 0) <= 0
            """
        )
    ).mappings():
        issues.append(
            ImportIssue(
                entity="item",
                legacy_id=str(row["id"]),
                reason=ISSUE_ITEM_MISSING_ROOM,
                detail=f"id_pokoju={row['id_pokoju']}",
            )
        )

    for row in connection.execute(
        text(
            """
            SELECT d.id, d.id_pokoju
            FROM inv_urzadzenia AS d
            WHERE COALESCE(d.id_pokoju, 0) > 0
              AND NOT EXISTS (
                SELECT 1
                FROM inv_pokoje AS p
                INNER JOIN inv_budynki AS b ON b.id = p.id_budynku
                WHERE p.id = d.id_pokoju
              )
            """
        )
    ).mappings():
        issues.append(
            ImportIssue(
                entity="item",
                legacy_id=str(row["id"]),
                reason=ISSUE_ITEM_INVALID_ROOM,
                detail=f"id_pokoju={row['id_pokoju']}",
            )
        )

    for row in connection.execute(
        text(
            """
            SELECT d.id, d.id_pracownika
            FROM inv_urzadzenia AS d
            WHERE COALESCE(d.id_pracownika, 0) <= 0
               OR NOT EXISTS (SELECT 1 FROM pracownicy AS p WHERE p.id = d.id_pracownika)
            """
        )
    ).mappings():
        issues.append(
            ImportIssue(
                entity="item",
                legacy_id=str(row["id"]),
                reason=ISSUE_ITEM_FALLBACK_OWNER,
                detail=f"id_pracownika={row['id_pracownika']}",
            )
        )

    return issues


def empty_report(*, dry_run: bool) -> ImportReport:
    return ImportReport(dry_run=dry_run, committed=False)
