"""Mapowanie danych koidc na model PZ2 i zapis do bazy."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import delete
from sqlalchemy.orm import Session

from src.auth.constants import UserRole, UserStatus
from src.categories.models import Category
from src.import_koidc.parser import LegacyDataset
from src.items.constants import ITEM_DESC_LENGTH, ITEM_NAME_LENGTH, ItemChangeLogType, ItemStatus
from src.items.models import Item, ItemHistory
from src.locations.constants import LocationType
from src.locations.models import Location
from src.users.models import User
from src.utils import now

LEGACY_OWNER_ID = 999999
LEGACY_OWNER_EMAIL = "legacy.import@koidc.local"
FALLBACK_CATEGORY_ID = 9_999
KOidc_UUID_NAMESPACE = NAMESPACE_URL


@dataclass
class ImportStats:
    users: int = 0
    categories: int = 0
    locations: int = 0
    items: int = 0
    skipped_items: int = 0


class KoidcImporter:
    def __init__(self, session: Session, *, dry_run: bool = False):
        self.session = session
        self.dry_run = dry_run

    def _import_users(self, dataset: LegacyDataset) -> int:
        imported = 0
        seen_emails: set[str] = set()

        for row in sorted(dataset.users, key=lambda u: int(u["id"])):
            user_id = int(row["id"])

            # Bezpieczne pobranie imienia i nazwiska
            first_name = row.get("imie", "Nieznany").strip()
            last_name = row.get("nazwisko", "").strip()

            # Walidacja e-maila pod kątem ograniczeń UNIQUE i NOT NULL w bazie
            raw_email = row.get("email", "").strip().lower()
            email = raw_email if raw_email else f"brak_maila_{user_id}@koidc.local"

            # Obsługa duplikatów e-mail pomiędzy różnymi ID użytkowników
            if email in seen_emails:
                if "@" in email:
                    local_part, domain = email.split("@", 1)
                    email = f"{local_part}+dup{user_id}@{domain}"
                else:
                    email = f"{email}_dup_{user_id}"

            seen_emails.add(email)

            # Mapowanie widoczności na status
            is_visible = row.get("widocznosc", "tak").lower() == "tak"
            status = UserStatus.ACTIVE if is_visible else UserStatus.INACTIVE

            user = self.session.get(User, user_id)
            if user is None:
                self.session.add(
                    User(
                        id=user_id,
                        first_name=first_name[:100],
                        last_name=last_name[:100] or None,
                        email=email[:512],
                        role=UserRole.USER,
                        status=status,
                    )
                )
            else:
                user.first_name = first_name[:100]
                user.last_name = last_name[:100] or None
                user.email = email[:512]
                user.status = status

            imported += 1

        return imported

    def import_dataset(self, dataset: LegacyDataset, *, clear_existing: bool = False) -> ImportStats:
        stats = ImportStats()

        if clear_existing:
            self._clear_inventory_tables()

        stats.users = self._ensure_legacy_owner()
        stats.users = self._import_users(dataset)
        self.session.flush()
        stats.categories = self._import_categories(dataset)
        self.session.flush()
        stats.locations = self._import_locations(dataset)
        self.session.flush()
        imported, skipped = self._import_items(dataset)
        stats.items = imported
        stats.skipped_items = skipped

        if self.dry_run:
            self.session.rollback()
        else:
            self.session.commit()

        return stats

    def _clear_inventory_tables(self) -> None:
        self.session.execute(delete(ItemHistory))
        self.session.execute(delete(Item))
        self.session.execute(delete(Category))
        self.session.execute(delete(Location))
        self.session.execute(delete(User).where(User.id != LEGACY_OWNER_ID))

    def _ensure_legacy_owner(self) -> int:
        owner = self.session.get(User, LEGACY_OWNER_ID)
        if owner is None:
            owner = User(
                id=LEGACY_OWNER_ID,
                first_name="Import",
                last_name="Legacy",
                email=LEGACY_OWNER_EMAIL,
                role=UserRole.USER,
                status=UserStatus.ACTIVE,
            )
            self.session.add(owner)
            return 1

        if owner.email != LEGACY_OWNER_EMAIL:
            raise RuntimeError(
                f"ID {LEGACY_OWNER_ID} jest zajęte przez użytkownika {owner.email}. "
                "Zmień LEGACY_OWNER_ID w imporcie albo wyczyść bazę."
            )
        return 0

    def _import_categories(self, dataset: LegacyDataset) -> int:
        imported = 0
        for row in sorted(dataset.device_types, key=lambda item: int(item["id"])):
            category_id = int(row["id"])
            name = row["nazwa"].strip() or f"Typ {category_id}"
            self._upsert_category(category_id, name[:100])
            imported += 1

        self._upsert_category(FALLBACK_CATEGORY_ID, "Niesklasyfikowane")
        imported += 1
        return imported

    def _import_locations(self, dataset: LegacyDataset) -> int:
        imported = 0
        building_ids: dict[int, int] = {}

        for row in sorted(dataset.buildings, key=lambda item: int(item["id"])):
            building_id = int(row["id"])
            self._upsert_location(
                location_id=building_id,
                name=row["nazwa"].strip() or f"Budynek {building_id}",
                location_type=LocationType.BUILDING,
                description=_nullable_text(row.get("opis")),
                parent_id=None,
            )
            building_ids[building_id] = building_id
            imported += 1

        for row in sorted(dataset.rooms, key=lambda item: int(item["id"])):
            room_id = int(row["id"]) + 10000  # <--- OFFSET DLA POKOI
            parent_id = int(row["id_budynku"])  # Budynków nie przesuwamy!
            if parent_id not in building_ids:
                raise ValueError(f"Pokój id={int(row['id'])} wskazuje na nieistniejący budynek id={parent_id}")

            self._upsert_location(
                location_id=room_id,
                name=row["nazwa"].strip() or f"Pokój {room_id}",
                location_type=LocationType.ROOM,
                description=_nullable_text(row.get("opis")),
                parent_id=parent_id,
            )
            imported += 1

        return imported

    def _import_items(self, dataset: LegacyDataset) -> tuple[int, int]:
        producers = {int(row["id"]): row["nazwa"].strip() for row in dataset.producers}
        models = {int(row["id"]): row for row in dataset.models}
        category_ids = {int(row["id"]) for row in dataset.device_types}
        category_ids.add(FALLBACK_CATEGORY_ID)

        # TUTAJ ZMIANA: Pokoje w zbiorze mają teraz +10000
        location_ids = {int(row["id"]) + 10000 for row in dataset.rooms} | {int(row["id"]) for row in dataset.buildings}

        imported = 0
        skipped = 0

        for row in sorted(dataset.devices, key=lambda item: int(item["id"])):
            device_id = int(row["id"])
            model_id = int(row["id_modelu"] or "0")

            # TUTAJ ZMIANA: Dodajemy offset do przypisanego pokoju
            legacy_room_id = int(row["id_pokoju"] or "0")
            room_id = legacy_room_id + 10000 if legacy_room_id > 0 else legacy_room_id

            if room_id not in location_ids:
                skipped += 1
                continue

            model = models.get(model_id)
            if model is None:
                skipped += 1
                continue

            type_id = int(model.get("id_typu") or "0")
            producer_id = int(model.get("id_producenta") or "0")
            producer_name = producers.get(producer_id, "")
            model_name = model.get("nazwa", "").strip()
            item_name = _build_item_name(producer_name, model_name, device_id)
            category_id = type_id if type_id in category_ids else FALLBACK_CATEGORY_ID
            status = ItemStatus.LOANED if row.get("wypozyczony", "0") == "1" else ItemStatus.AVAILABLE
            description = _build_description(
                serial=row.get("serial", ""),
                inventory_label=row.get("nr_inw", ""),
                notes=row.get("opis", ""),
                model_notes=model.get("opis", ""),
            )

            self._upsert_item(
                item_id=device_id,
                name=item_name,
                inventory_number=_legacy_inventory_uuid(device_id),
                location_id=room_id,
                category_id=category_id,
                owner_id=LEGACY_OWNER_ID,
                status=status,
                description=description,
            )
            imported += 1

        return imported, skipped

    def _upsert_category(self, category_id: int, name: str) -> None:
        category = self.session.get(Category, category_id)
        if category is None:
            self.session.add(Category(id=category_id, name=name, parent_id=None))
            return
        category.name = name
        category.parent_id = None

    def _upsert_location(
        self,
        *,
        location_id: int,
        name: str,
        location_type: LocationType,
        description: str | None,
        parent_id: int | None,
    ) -> None:
        location = self.session.get(Location, location_id)
        if location is None:
            self.session.add(
                Location(
                    id=location_id,
                    name=name[:100],
                    type=location_type,
                    description=description,
                    parent_id=parent_id,
                    is_active=True,
                )
            )
            return

        location.name = name[:100]
        location.type = location_type
        location.description = description
        location.parent_id = parent_id
        location.is_active = True

    def _upsert_item(
        self,
        *,
        item_id: int,
        name: str,
        inventory_number,
        location_id: int,
        category_id: int,
        owner_id: int,
        status: ItemStatus,
        description: str | None,
    ) -> None:
        item = self.session.get(Item, item_id)
        if item is None:
            item = Item(
                id=item_id,
                name=name,
                inventory_number=inventory_number,
                location_id=location_id,
                category_id=category_id,
                owner_id=owner_id,
                status=status,
                description=description,
            )
            self.session.add(item)
            self.session.flush()
            self.session.add(
                ItemHistory(
                    item_id=item.id,
                    updated_at=now(),
                    updated_by=owner_id,
                    change_type=ItemChangeLogType.CREATED,
                    description="Imported from koidc legacy database",
                )
            )
            return

        item.name = name
        item.inventory_number = inventory_number
        item.location_id = location_id
        item.category_id = category_id
        item.owner_id = owner_id
        item.status = status
        item.description = description


def _nullable_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _build_item_name(producer: str, model: str, device_id: int) -> str:
    name = f"{producer} {model}" if producer and model else model or producer or f"Urządzenie #{device_id}"
    return name[:ITEM_NAME_LENGTH]


def _build_description(
    *,
    serial: str,
    inventory_label: str,
    notes: str,
    model_notes: str,
) -> str | None:
    parts: list[str] = []
    if serial.strip():
        parts.append(f"S/N: {serial.strip()}")
    if inventory_label.strip():
        parts.append(f"Nr inw.: {inventory_label.strip()}")
    if model_notes.strip():
        parts.append(model_notes.strip().replace("\r\n", "\n"))
    if notes.strip():
        parts.append(notes.strip().replace("\r\n", "\n"))

    if not parts:
        return None

    return "\n".join(parts)[:ITEM_DESC_LENGTH]


def _legacy_inventory_uuid(device_id: int):
    return uuid5(KOidc_UUID_NAMESPACE, f"koidc:device:{device_id}")
