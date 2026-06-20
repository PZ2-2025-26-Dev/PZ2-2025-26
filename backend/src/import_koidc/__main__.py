"""CLI importu danych ze starego systemu koidc."""

from __future__ import annotations

import argparse
from pathlib import Path

from src.database import SessionLocal
from src.import_koidc.parser import (
    default_legacy_dir,
    default_sql_file,
    load_legacy_from_csv,
    load_legacy_from_sql,
    write_legacy_csv,
)
from src.import_koidc.service import KoidcImporter


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Import danych ewidencji ze starego systemu koidc do bazy PZ2.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    extract_parser = subparsers.add_parser(
        "extract",
        help="Wyciągnij tabele inv_* ze zrzutu SQL do plików CSV.",
    )
    extract_parser.add_argument(
        "--sql-file",
        type=Path,
        default=default_sql_file(),
        help="Ścieżka do pliku SQL phpMyAdmin (domyślnie: backend/sample_dump.sql).",
    )
    extract_parser.add_argument(
        "--legacy-dir",
        type=Path,
        default=default_legacy_dir(),
        help="Katalog docelowy CSV (domyślnie: backend/legacy/).",
    )

    import_parser = subparsers.add_parser(
        "import",
        help="Zaimportuj dane legacy do bieżącej bazy PZ2.",
    )
    import_parser.add_argument(
        "--legacy-dir",
        type=Path,
        default=default_legacy_dir(),
        help="Katalog z plikami CSV inv_*.csv.",
    )
    import_parser.add_argument(
        "--sql-file",
        type=Path,
        default=None,
        help="Opcjonalnie: import bezpośrednio ze zrzutu SQL zamiast CSV.",
    )
    import_parser.add_argument(
        "--clear-existing",
        action="store_true",
        help="Usuń istniejące location/category/item przed importem.",
    )
    import_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Wykonaj import bez commita (rollback na końcu).",
    )

    return parser


def main() -> None:
    args = _build_parser().parse_args()

    if args.command == "extract":
        dataset = load_legacy_from_sql(args.sql_file)
        write_legacy_csv(dataset, args.legacy_dir)
        print(f"Zapisano CSV do: {args.legacy_dir}")
        print(
            "Liczba rekordów: "
            f"budynki={len(dataset.buildings)}, "
            f"pokoje={len(dataset.rooms)}, "
            f"typy={len(dataset.device_types)}, "
            f"producenci={len(dataset.producers)}, "
            f"modele={len(dataset.models)}, "
            f"urządzenia={len(dataset.devices)}"
        )
        return

    if args.sql_file is not None:
        dataset = load_legacy_from_sql(args.sql_file)
    else:
        dataset = load_legacy_from_csv(args.legacy_dir)

    with SessionLocal() as session:
        stats = KoidcImporter(session, dry_run=args.dry_run).import_dataset(
            dataset,
            clear_existing=args.clear_existing,
        )

    mode = "DRY-RUN" if args.dry_run else "IMPORT"
    print(f"[{mode}] Import zakończony.")
    print(
        f"Użytkownicy: +{stats.users}, "
        f"kategorie: {stats.categories}, "
        f"lokalizacje: {stats.locations}, "
        f"przedmioty: {stats.items}, "
        f"pominięte: {stats.skipped_items}"
    )


if __name__ == "__main__":
    main()
