from enum import Enum

LEGACY_STAGING_SCHEMA = "koidc_staging"


class ImportStage(Enum):
    LOAD = "load"
    USERS = "users"
    CATEGORIES = "categories"
    LOCATIONS = "locations"
    ITEMS = "items"
    CLEANUP = "cleanup"

    @property
    def label(self) -> str:
        return _STAGE_LABELS[self]


_STAGE_LABELS: dict[ImportStage, str] = {
    ImportStage.LOAD: "Wczytanie zrzutu SQL",
    ImportStage.USERS: "Import użytkowników",
    ImportStage.CATEGORIES: "Import kategorii",
    ImportStage.LOCATIONS: "Import lokalizacji",
    ImportStage.ITEMS: "Import przedmiotów",
    ImportStage.CLEANUP: "Sprzątanie tabel stagingowych",
}

IMPORT_STAGES: tuple[ImportStage, ...] = (
    ImportStage.LOAD,
    ImportStage.USERS,
    ImportStage.CATEGORIES,
    ImportStage.LOCATIONS,
    ImportStage.ITEMS,
    ImportStage.CLEANUP,
)

STAGES_REQUIRING_APPROVAL: frozenset[ImportStage] = frozenset(
    {
        ImportStage.USERS,
        ImportStage.CATEGORIES,
        ImportStage.LOCATIONS,
        ImportStage.ITEMS,
    }
)
