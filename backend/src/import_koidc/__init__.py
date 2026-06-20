"""Import danych ewidencji ze starego systemu koidc (tabele inv_*)."""

from src.import_koidc.service import KoidcImporter, LegacyDataset

__all__ = ["KoidcImporter", "LegacyDataset"]
