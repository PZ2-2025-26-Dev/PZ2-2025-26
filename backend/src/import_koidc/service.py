"""Orkiestracja importu koidc: wczytanie zrzutu SQL, migracja SQL, sprzątanie."""

from __future__ import annotations

from pathlib import Path

from pymysql.constants import CLIENT
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from src.config import config
from src.import_koidc.constants import STAGES_REQUIRING_APPROVAL, ImportStage
from src.import_koidc.loader import (
    assert_legacy_tables_loaded,
    cleanup_dump_staging,
    default_sql_file,
    drop_tables,
    extract_dump_table_names,
    load_sql_dump,
    snapshot_table_names,
)
from src.import_koidc.prompts import ImportAbortedError, approve_stage
from src.import_koidc.report import (
    ImportReport,
    StagePreview,
    build_categories_result,
    build_cleanup_result,
    build_items_result,
    build_load_result,
    build_locations_result,
    build_users_result,
    empty_report,
    fetch_existing_ids,
    format_stage_result,
    preview_after_load,
    preview_categories,
    preview_items,
    preview_locations,
    preview_users,
)
from src.import_koidc.sql_migrate import (
    clear_inventory_tables,
    ensure_legacy_owner,
    migrate_categories,
    migrate_item_history,
    migrate_items,
    migrate_locations,
    migrate_users,
)


def _create_import_session() -> Session:
    engine = create_engine(
        config.database_url,
        pool_pre_ping=True,
        connect_args={"client_flag": CLIENT.MULTI_STATEMENTS},
    )
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()


class KoidcImporter:
    def __init__(self, session: Session, *, dry_run: bool = False, auto_approve: bool = False):
        self.session = session
        self.dry_run = dry_run
        self.auto_approve = auto_approve

    def import_from_sql(
        self,
        sql_path: Path,
        *,
        clear_existing: bool = False,
    ) -> ImportReport:
        report = empty_report(dry_run=self.dry_run)
        connection = self.session.connection()
        loaded_tables: set[str] = set()

        try:
            tables_before_load = snapshot_table_names(connection)
            if clear_existing:
                clear_inventory_tables(connection)

            dump_tables = extract_dump_table_names(sql_path)
            drop_tables(connection, dump_tables)
            load_sql_dump(connection, sql_path)
            assert_legacy_tables_loaded(connection)
            loaded_tables = snapshot_table_names(connection) - tables_before_load

            load_summary = preview_after_load(connection, loaded_tables)
            load_result = build_load_result(load_summary)
            report.stages.append(load_result)
            print(format_stage_result(load_result))

            users_preview = preview_users(connection)
            self._approve_stage(ImportStage.USERS, users_preview)
            existing_users = fetch_existing_ids(connection, "user")
            ensure_legacy_owner(connection)
            migrate_users(connection)
            users_result = build_users_result(connection, existing_before=existing_users)
            report.stages.append(users_result)
            print(format_stage_result(users_result))

            categories_preview = preview_categories(connection)
            self._approve_stage(ImportStage.CATEGORIES, categories_preview)
            existing_categories = fetch_existing_ids(connection, "category")
            migrate_categories(connection)
            categories_result = build_categories_result(connection, existing_before=existing_categories)
            report.stages.append(categories_result)
            print(format_stage_result(categories_result))

            locations_preview = preview_locations(connection)
            self._approve_stage(ImportStage.LOCATIONS, locations_preview)
            existing_locations = fetch_existing_ids(connection, "location")
            migrate_locations(connection)
            locations_result = build_locations_result(connection, existing_before=existing_locations)
            report.stages.append(locations_result)
            print(format_stage_result(locations_result))

            items_preview = preview_items(connection)
            self._approve_stage(ImportStage.ITEMS, items_preview)
            existing_items = fetch_existing_ids(connection, "item")
            migrate_items(connection)
            migrate_item_history(connection)
            items_result = build_items_result(connection, existing_before=existing_items)
            report.stages.append(items_result)
            print(format_stage_result(items_result))

            drop_tables(connection, loaded_tables)
            cleanup_result = build_cleanup_result(loaded_tables)
            report.stages.append(cleanup_result)
            print(format_stage_result(cleanup_result))

            if self.dry_run:
                self.session.rollback()
                report.committed = False
            else:
                self.session.commit()
                report.committed = True

        except ImportAbortedError as exc:
            cleanup_dump_staging(connection, sql_path, loaded_tables=loaded_tables)
            self.session.rollback()
            report.aborted_at = _stage_from_message(str(exc))
            report.abort_reason = str(exc)
            report.committed = False
        except Exception:
            cleanup_dump_staging(connection, sql_path, loaded_tables=loaded_tables)
            self.session.rollback()
            raise

        return report

    def _approve_stage(self, stage: ImportStage, preview: StagePreview) -> None:
        if stage not in STAGES_REQUIRING_APPROVAL:
            return
        approve_stage(stage, preview, auto_approve=self.auto_approve)


def import_koidc_from_sql(
    sql_path: Path | None = None,
    *,
    clear_existing: bool = False,
    dry_run: bool = False,
    auto_approve: bool = False,
) -> ImportReport:
    dump_path = sql_path or default_sql_file()
    if not dump_path.is_file():
        raise FileNotFoundError(f"Nie znaleziono pliku zrzutu SQL: {dump_path}")

    with _create_import_session() as session:
        return KoidcImporter(session, dry_run=dry_run, auto_approve=auto_approve).import_from_sql(
            dump_path,
            clear_existing=clear_existing,
        )


def _stage_from_message(message: str) -> ImportStage | None:
    for stage in ImportStage:
        if stage.label in message:
            return stage
    return None
