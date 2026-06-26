"""CLI importu danych ze starego systemu koidc."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from src.import_koidc.loader import default_sql_file
from src.import_koidc.report import default_report_file, format_import_report, write_import_report
from src.import_koidc.service import import_koidc_from_sql


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Import danych ewidencji ze starego systemu koidc do bazy PZ2.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    import_parser = subparsers.add_parser(
        "import",
        help="Wczytaj zrzut SQL do bazy, przenieś dane SQL-em do tabel PZ2 i usuń tabele legacy.",
    )
    import_parser.add_argument(
        "--sql-file",
        type=Path,
        default=default_sql_file(),
        help="Ścieżka do pliku SQL phpMyAdmin (domyślnie: backend/sample_dump.sql).",
    )
    import_parser.add_argument(
        "--clear-existing",
        action="store_true",
        help="Usuń istniejące location/category/item/user przed importem.",
    )
    import_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Wykonaj import bez commita (rollback na końcu).",
    )
    import_parser.add_argument(
        "--yes",
        "-y",
        action="store_true",
        help="Pomiń interaktywne zatwierdzanie etapów (tylko do testów/automatyzacji).",
    )
    import_parser.add_argument(
        "--report-file",
        type=Path,
        default=None,
        help="Ścieżka pliku raportu .txt (domyślnie: backend/import_reports/koidc_import_report_<data>.txt).",
    )

    return parser


def main() -> None:
    args = _build_parser().parse_args()

    if args.command == "import":
        report = import_koidc_from_sql(
            args.sql_file,
            clear_existing=args.clear_existing,
            dry_run=args.dry_run,
            auto_approve=args.yes,
        )

        report_path = args.report_file or default_report_file()
        report_text = format_import_report(report)
        write_import_report(report, report_path)

        print()
        print(report_text)
        print()
        print(f"Raport zapisano do: {report_path}")

        if report.aborted_at is not None:
            sys.exit(1)


if __name__ == "__main__":
    main()
