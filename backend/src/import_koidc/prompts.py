"""Interaktywne zatwierdzanie etapów importu przez administratora."""

from __future__ import annotations

import sys

from src.import_koidc.constants import ImportStage
from src.import_koidc.report import StagePreview, format_stage_preview


class ImportAbortedError(RuntimeError):
    """Administrator odrzucił etap importu."""


class ImportDataConflictError(RuntimeError):
    """Konflikt unikalnego klucza podczas importu (np. już zainicjalizowana baza)."""


_CONFIRM_INPUTS = frozenset({"t", "tak", "y", "yes"})


def approve_stage(stage: ImportStage, preview: StagePreview, *, auto_approve: bool) -> None:
    print(format_stage_preview(preview))
    print()

    if auto_approve:
        print(f"[AUTO] Etap „{stage.label}” zatwierdzony automatycznie.")
        return

    if not sys.stdin.isatty():
        raise ImportAbortedError(
            f"Brak interaktywnego terminala — nie można zatwierdzić etapu „{stage.label}”. "
            "Użyj flagi --yes tylko w środowisku testowym."
        )

    answer = input(f"Zatwierdzić etap „{stage.label}”? [t/N]: ").strip().lower()
    if answer not in _CONFIRM_INPUTS:
        raise ImportAbortedError(f"Administrator odrzucił etap „{stage.label}”.")
