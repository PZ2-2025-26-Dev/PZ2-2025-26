"""Migracja danych ze stagingowych tabel koidc do schematu PZ2 (czyste SQL)."""

from __future__ import annotations

from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import text
from sqlalchemy.engine import Connection

from src.auth.constants import UserRole, UserStatus
from src.import_koidc.loader import legacy_table
from src.items.constants import ITEM_DESC_LENGTH, ITEM_NAME_LENGTH, ItemChangeLogType, ItemStatus
from src.locations.constants import LocationType

LEGACY_OWNER_ID = 999_999
LEGACY_EMAIL_DOMAIN = "import.example.com"
LEGACY_OWNER_EMAIL = f"legacy.import@{LEGACY_EMAIL_DOMAIN}"
FALLBACK_CATEGORY_ID = 9_999
ROOM_ID_OFFSET = 10_000
ITEM_UUID_STAGING_TABLE = "_koidc_item_uuid"
KOidc_UUID_NAMESPACE = NAMESPACE_URL


def _legacy_item_uuid(device_id: int) -> str:
    return uuid5(KOidc_UUID_NAMESPACE, f"koidc:device:{device_id}").hex


def _legacy_placeholder_email_sql(column: str = "id") -> str:
    return f"CONCAT('brak_maila_', {column}, '@{LEGACY_EMAIL_DOMAIN}')"


def _importable_devices_join_sql() -> str:
    return f"""
        FROM {legacy_table("inv_urzadzenia")} AS d
        INNER JOIN {legacy_table("inv_modele")} AS m ON m.id = d.id_modelu
        LEFT JOIN {legacy_table("inv_producenci")} AS pr ON pr.id = m.id_producenta
        LEFT JOIN {legacy_table("inv_typy_urz")} AS t ON t.id = m.id_typu
        INNER JOIN {legacy_table("inv_pokoje")} AS pok ON pok.id = d.id_pokoju
        INNER JOIN {legacy_table("inv_budynki")} AS b ON b.id = pok.id_budynku
    """


def _importable_devices_where_sql() -> str:
    return "WHERE COALESCE(d.id_pokoju, 0) > 0"


def prepare_item_uuid_staging(connection: Connection) -> None:
    connection.execute(
        text(
            f"""
            CREATE TEMPORARY TABLE {ITEM_UUID_STAGING_TABLE} (
                device_id INT NOT NULL PRIMARY KEY,
                item_uuid CHAR(32) NOT NULL
            )
            """
        )
    )

    device_ids = (
        connection.execute(text(f"SELECT d.id {_importable_devices_join_sql()} {_importable_devices_where_sql()}"))
        .scalars()
        .all()
    )

    if not device_ids:
        return

    connection.execute(
        text(
            f"""
            INSERT INTO {ITEM_UUID_STAGING_TABLE} (device_id, item_uuid)
            VALUES (:device_id, :item_uuid)
            """
        ),
        [{"device_id": device_id, "item_uuid": _legacy_item_uuid(device_id)} for device_id in device_ids],
    )


def clear_inventory_tables(connection: Connection) -> None:
    connection.execute(text("DELETE FROM item_history"))
    connection.execute(text("DELETE FROM item"))
    connection.execute(text("DELETE FROM category"))
    connection.execute(text("DELETE FROM location"))
    connection.execute(
        text("DELETE FROM user WHERE id != :owner_id"),
        {"owner_id": LEGACY_OWNER_ID},
    )


def ensure_legacy_owner(connection: Connection) -> None:
    existing_email = connection.execute(
        text("SELECT email FROM user WHERE id = :owner_id"),
        {"owner_id": LEGACY_OWNER_ID},
    ).scalar_one_or_none()

    if existing_email is None:
        connection.execute(
            text(
                """
                INSERT INTO user (id, first_name, last_name, email, role, status)
                VALUES (
                    :owner_id,
                    'Import',
                    'Legacy',
                    :email,
                    :role,
                    :status
                )
                """
            ),
            {
                "owner_id": LEGACY_OWNER_ID,
                "email": LEGACY_OWNER_EMAIL,
                "role": UserRole.USER.name,
                "status": UserStatus.ACTIVE.name,
            },
        )
        return

    if existing_email != LEGACY_OWNER_EMAIL:
        raise RuntimeError(
            f"ID {LEGACY_OWNER_ID} jest zajęte przez użytkownika {existing_email}. "
            "Zmień LEGACY_OWNER_ID w imporcie albo wyczyść bazę."
        )


def migrate_users(connection: Connection) -> int:
    placeholder_email = _legacy_placeholder_email_sql()
    pracownicy = legacy_table("pracownicy")
    connection.execute(
        text(
            f"""
            INSERT INTO user (id, first_name, last_name, email, role, status)
            SELECT
                p.id,
                LEFT(COALESCE(NULLIF(TRIM(p.imie), ''), 'Nieznany'), 100),
                NULLIF(LEFT(NULLIF(TRIM(p.nazwisko), ''), 100), ''),
                LEFT(
                    CASE
                        WHEN dup.rn > 1 AND LOCATE('@', dup.base_email) > 0 THEN CONCAT(
                            SUBSTRING_INDEX(dup.base_email, '@', 1),
                            '+dup',
                            p.id,
                            '@',
                            SUBSTRING_INDEX(dup.base_email, '@', -1)
                        )
                        WHEN dup.rn > 1 THEN CONCAT(dup.base_email, '_dup_', p.id)
                        ELSE dup.base_email
                    END,
                    512
                ),
                :role,
                :status
            FROM {pracownicy} AS p
            INNER JOIN (
                SELECT
                    id,
                    COALESCE(
                        NULLIF(LOWER(TRIM(email)), ''),
                        {placeholder_email}
                    ) AS base_email,
                    ROW_NUMBER() OVER (
                        PARTITION BY COALESCE(
                            NULLIF(LOWER(TRIM(email)), ''),
                            {placeholder_email}
                        )
                        ORDER BY id
                    ) AS rn
                FROM {pracownicy}
            ) AS dup ON dup.id = p.id
            ON DUPLICATE KEY UPDATE
                first_name = IF(user.id = VALUES(id), VALUES(first_name), user.first_name),
                last_name = IF(user.id = VALUES(id), VALUES(last_name), user.last_name),
                email = IF(user.id = VALUES(id), VALUES(email), user.email),
                status = IF(user.id = VALUES(id), VALUES(status), user.status)
            """
        ),
        {
            "role": UserRole.USER.name,
            "status": UserStatus.INACTIVE.name,
        },
    )
    return connection.execute(text(f"SELECT COUNT(*) FROM {pracownicy}")).scalar_one()


def migrate_categories(connection: Connection) -> int:
    inv_typy_urz = legacy_table("inv_typy_urz")
    connection.execute(
        text(
            f"""
            INSERT INTO category (id, name, parent_id)
            SELECT
                t.id,
                LEFT(COALESCE(NULLIF(TRIM(t.nazwa), ''), CONCAT('Typ ', t.id)), 100),
                NULL
            FROM {inv_typy_urz} AS t
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                parent_id = NULL
            """
        )
    )
    connection.execute(
        text(
            """
            INSERT INTO category (id, name, parent_id)
            VALUES (:category_id, 'Niesklasyfikowane', NULL)
            ON DUPLICATE KEY UPDATE name = VALUES(name)
            """
        ),
        {"category_id": FALLBACK_CATEGORY_ID},
    )
    return connection.execute(text(f"SELECT COUNT(*) FROM {inv_typy_urz}")).scalar_one() + 1


def migrate_locations(connection: Connection) -> int:
    inv_budynki = legacy_table("inv_budynki")
    inv_pokoje = legacy_table("inv_pokoje")
    connection.execute(
        text(
            f"""
            INSERT INTO location (id, name, type, description, parent_id, is_active)
            SELECT
                b.id,
                LEFT(COALESCE(NULLIF(TRIM(b.nazwa), ''), CONCAT('Budynek ', b.id)), 100),
                :building_type,
                NULLIF(TRIM(b.opis), ''),
                NULL,
                1
            FROM {inv_budynki} AS b
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                type = VALUES(type),
                description = VALUES(description),
                parent_id = VALUES(parent_id),
                is_active = VALUES(is_active)
            """
        ),
        {"building_type": LocationType.BUILDING.name},
    )
    buildings_count = connection.execute(text(f"SELECT COUNT(*) FROM {inv_budynki}")).scalar_one()

    connection.execute(
        text(
            f"""
            INSERT INTO location (id, name, type, description, parent_id, is_active)
            SELECT
                p.id + {ROOM_ID_OFFSET},
                LEFT(
                    COALESCE(NULLIF(TRIM(p.nazwa), ''), CONCAT('Pokój ', p.id + {ROOM_ID_OFFSET})),
                    100
                ),
                :room_type,
                NULLIF(TRIM(p.opis), ''),
                p.id_budynku,
                1
            FROM {inv_pokoje} AS p
            INNER JOIN {inv_budynki} AS b ON b.id = p.id_budynku
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                type = VALUES(type),
                description = VALUES(description),
                parent_id = VALUES(parent_id),
                is_active = VALUES(is_active)
            """
        ),
        {"room_type": LocationType.ROOM.name},
    )
    rooms_count = connection.execute(
        text(
            f"""
            SELECT COUNT(*)
            FROM {inv_pokoje} AS p
            INNER JOIN {inv_budynki} AS b ON b.id = p.id_budynku
            """
        )
    ).scalar_one()
    return buildings_count + rooms_count


def migrate_items(connection: Connection) -> int:
    prepare_item_uuid_staging(connection)
    joins = _importable_devices_join_sql()
    where_clause = _importable_devices_where_sql()
    pracownicy = legacy_table("pracownicy")
    connection.execute(
        text(
            f"""
            INSERT INTO item (
                id,
                name,
                uuid,
                location_id,
                category_id,
                owner_id,
                status,
                description
            )
            SELECT
                d.id,
                LEFT(
                    CASE
                        WHEN COALESCE(NULLIF(TRIM(pr.nazwa), ''), '') != ''
                            AND COALESCE(NULLIF(TRIM(m.nazwa), ''), '') != ''
                            THEN CONCAT(TRIM(pr.nazwa), ' ', TRIM(m.nazwa))
                        ELSE COALESCE(
                            NULLIF(TRIM(m.nazwa), ''),
                            NULLIF(TRIM(pr.nazwa), ''),
                            CONCAT('Urządzenie #', d.id)
                        )
                    END,
                    {ITEM_NAME_LENGTH}
                ),
                uuid_map.item_uuid,
                d.id_pokoju + {ROOM_ID_OFFSET},
                CASE
                    WHEN t.id IS NOT NULL THEN m.id_typu
                    ELSE {FALLBACK_CATEGORY_ID}
                END,
                CASE
                    WHEN COALESCE(d.id_pracownika, 0) > 0
                        AND EXISTS (SELECT 1 FROM {pracownicy} AS emp WHERE emp.id = d.id_pracownika)
                        THEN d.id_pracownika
                    ELSE {LEGACY_OWNER_ID}
                END,
                :status_available,
                LEFT(
                    NULLIF(
                        CONCAT_WS(
                            CHAR(10),
                            CASE
                                WHEN COALESCE(TRIM(d.serial), '') != ''
                                    THEN CONCAT('S/N', CHAR(58), ' ', TRIM(d.serial))
                            END,
                            CASE
                                WHEN COALESCE(TRIM(d.nr_inw), '') != ''
                                    THEN CONCAT('Nr inw.', CHAR(58), ' ', TRIM(d.nr_inw))
                            END,
                            NULLIF(TRIM(REPLACE(COALESCE(m.opis, ''), CHAR(13, 10), CHAR(10))), ''),
                            NULLIF(TRIM(REPLACE(COALESCE(d.opis, ''), CHAR(13, 10), CHAR(10))), '')
                        ),
                        ''
                    ),
                    {ITEM_DESC_LENGTH}
                )
            {joins}
            INNER JOIN {ITEM_UUID_STAGING_TABLE} AS uuid_map ON uuid_map.device_id = d.id
            {where_clause}
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                uuid = VALUES(uuid),
                location_id = VALUES(location_id),
                category_id = VALUES(category_id),
                owner_id = VALUES(owner_id),
                status = VALUES(status),
                description = VALUES(description)
            """
        ),
        {
            "status_available": ItemStatus.AVAILABLE.name,
        },
    )
    return connection.execute(text(f"SELECT COUNT(*) {joins} {where_clause}")).scalar_one()


def migrate_item_history(connection: Connection) -> None:
    inv_urzadzenia = legacy_table("inv_urzadzenia")
    inv_modele = legacy_table("inv_modele")
    inv_pokoje = legacy_table("inv_pokoje")
    inv_budynki = legacy_table("inv_budynki")
    connection.execute(
        text(
            f"""
            INSERT INTO item_history (item_id, updated_at, updated_by, change_type, description)
            SELECT
                i.id,
                UTC_TIMESTAMP(),
                i.owner_id,
                :change_type,
                'Imported from koidc legacy database'
            FROM item AS i
            WHERE i.id IN (
                SELECT d.id
                FROM {inv_urzadzenia} AS d
                INNER JOIN {inv_modele} AS m ON m.id = d.id_modelu
                INNER JOIN {inv_pokoje} AS pok ON pok.id = d.id_pokoju
                INNER JOIN {inv_budynki} AS b ON b.id = pok.id_budynku
                WHERE COALESCE(d.id_pokoju, 0) > 0
            )
            AND NOT EXISTS (
                SELECT 1
                FROM item_history AS ih
                WHERE ih.item_id = i.id
                  AND ih.change_type = :change_type
            )
            """
        ),
        {"change_type": ItemChangeLogType.CREATED.name},
    )
