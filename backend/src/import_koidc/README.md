# Import danych ze starego systemu koidc

Skrypt `src.import_koidc` przenosi dane ewidencji sprzętu ze starej bazy **koidc** (phpMyAdmin, tabele `inv_*` i `pracownicy`) do schematu aplikacji PZ2.

Moduł **nie parsuje** zawartości pliku SQL. Wykonuje zrzut w bazie MySQL, następnie przenosi dane operacjami SQL do tabel PZ2 i usuwa tymczasowe tabele legacy.

Import odbywa się **etapami**. Przed etapami migracji danych (użytkownicy, kategorie, lokalizacje, przedmioty) administrator widzi podgląd i musi go zatwierdzić (`t` / `tak`). Odrzucenie etapu przerywa import i wycofuje transakcję.

**Wczytanie zrzutu SQL** oraz **sprzątanie tabel stagingowych** wykonywane są automatycznie, bez pytania. Przed każdym wczytaniem zrzutu usuwane są tabele ze zrzutu pozostawione po poprzednim przerwanym imporcie (MySQL commituje DDL niezależnie od rollback transakcji).

---

## Etapy importu

| Etap | Opis | Zatwierdzenie |
|------|------|---------------|
| 1. Wczytanie zrzutu SQL | Wykonanie `sample_dump.sql`, utworzenie tabel stagingowych | automatycznie |
| 2. Użytkownicy | `pracownicy` → `user` (status domyślnie **INACTIVE**) | wymagane |
| 3. Kategorie | `inv_typy_urz` → `category` | wymagane |
| 4. Lokalizacje | `inv_budynki` / `inv_pokoje` → `location` | wymagane |
| 5. Przedmioty | `inv_urzadzenia` + modele → `item` + `item_history` | wymagane |
| 6. Sprzątanie | Usunięcie wszystkich tabel utworzonych ze zrzutu | automatycznie |

Po zakończeniu wyświetlany jest **raport** z listą ostrzeżeń (np. brak e-maila, duplikaty) i pominiętych rekordów (np. urządzenie bez modelu). Raport jest też zapisywany do pliku `.txt` w katalogu `backend/import_reports/` (lub `/app/import_reports/` w kontenerze).

---

## Mapowanie danych

| Źródło (koidc) | Cel (PZ2) | Uwagi |
|----------------|-----------|-------|
| `pracownicy` | `user` | rola `USER`, status **INACTIVE**; brak e-maila → `brak_maila_{id}@import.example.com` |
| `inv_budynki` | `location` | typ `BUILDING`, zachowane ID |
| `inv_pokoje` | `location` | typ `ROOM`, **ID pokoju = stare ID + 10 000** |
| `inv_typy_urz` | `category` | zachowane ID |
| `inv_producenci` + `inv_modele` + `inv_urzadzenia` | `item` | nazwa: `{producent} {model}` |
| `inv_urzadzenia.id_pracownika` | `item.owner_id` | brak/0/nieznany → fallback `999999` |
| `inv_urzadzenia` | `item` | status zawsze **available** |
| brak UUID w starym systemie | `item.uuid` | deterministyczne UUID v5 z ID urządzenia |
| `inv_urzadzenia.id` | `item.oldID` | stare ID zapisane tekstowo |
| brak parametrów w starym systemie | `item.parameters` | `NULL` przy pierwszym imporcie |

---

## Uruchomienie

Domyślny zrzut: `backend/sample_dump.sql`. W kontenerze API skopiuj go do `/app/sample_dump.sql` albo podaj ścieżkę flagą `--sql-file`.

Flaga `-it` przy `docker compose exec` jest wymagana, aby móc zatwierdzać etapy migracji w terminalu.

### Flagi polecenia `import`

| Flaga | Opis |
|-------|------|
| `--sql-file <ścieżka>` | Plik zrzutu SQL phpMyAdmin (domyślnie: `backend/sample_dump.sql` / `/app/sample_dump.sql` w kontenerze) |
| `--clear-existing` | Usuń istniejące `user` / `location` / `category` / `item` przed importem |
| `--dry-run` | Pełny przebieg bez `commit` — rollback na końcu |
| `--yes` / `-y` | Pomiń interaktywne zatwierdzanie etapów migracji (tylko testy/automatyzacja) |
| `--report-file <ścieżka>` | Własna ścieżka raportu `.txt` (domyślnie: `import_reports/koidc_import_report_<data>.txt`) |


### Przykład  uruchomienia 

**Ważne komende do przenoszenia danych należy uruchomić w trybie root**

1. Tryb dev

Środowisko developerskie z montowaniem kodu (`compose.dev.yaml`):

```powershell
docker compose -f compose.yaml -f compose.dev.yaml up --build 
docker compose cp backend/sample_dump.sql api:/app/sample_dump.sql
docker compose exec -e PZ_DATABASE_URL="mysql+pymysql://root:root@db:3306/app_db" api uv run python -m src.import_koidc import --sql-file /app/sample_dump.sql
```

Raport trafi do `/app/import_reports/` w kontenerze (przy mountcie `./backend:/app` pliki będą też widoczne lokalnie w `backend/import_reports/`).

2. Tryb klienta (produkcja / wdrożenie)

Standardowy `compose.yaml` bez montowania kodu źródłowego:

```powershell
docker compose up --build -d
docker compose cp backend/sample_dump.sql api:/app/sample_dump.sql
docker compose exec -e PZ_DATABASE_URL="mysql+pymysql://root:root@db:3306/app_db" api uv run python -m src.import_koidc import --sql-file /app/sample_dump.sql
```

Aby pobrać raport z kontenera:

```powershell
docker compose cp api:/app/import_reports/koidc_import_report_YYYYMMDD_HHMMSS.txt ./backend/import_reports/
```


---

## Przykładowy przebieg

```
------------------------------------------------------------------------
WYNIK ETAPU: Wczytanie zrzutu SQL
------------------------------------------------------------------------
Utworzono tabel ze zrzutu: 12
  • pracownicy: 42 rekordów
  ...

========================================================================
PODGLĄD ETAPU: Import użytkowników
========================================================================
Rekordów w źródle (pracownicy): 42
...

Zatwierdzić etap „Import użytkowników”? [t/N]: t
```

Na końcu pojawia się zbiorczy raport z ostrzeżeniami i pominiętymi rekordami oraz ścieżka do zapisanego pliku `.txt`.

---

## Struktura modułu

```
backend/src/import_koidc/
├── README.md
├── __main__.py     ← CLI
├── constants.py    ← nazwy etapów
├── loader.py       ← wykonanie zrzutu SQL
├── sql_migrate.py  ← migracja SQL
├── report.py       ← podgląd i raporty
├── prompts.py      ← zatwierdzanie etapów
└── service.py      ← orkiestracja
```
