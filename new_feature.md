# Feature: Rejestracja wypożyczeń obiektów Gościom (podmiotom zewnętrznym)

Dokument opisuje wszystkie zmiany wprowadzone w ramach User Story:

> Jako Właściciel (admin) chcę zarejestrować wypożyczenie obiektu podmiotowi
> zewnętrznemu (Gościowi) na określony czas. Jako Gość chcę funkcjonować
> w systemie jako encja, do której można przypisywać wypożyczenia.

## 1. Założenia i decyzje projektowe

1. **Goście to użytkownicy, a nie osobna tabela.** Tabela `guest` została
   usunięta. Gość jest rekordem `User` z nową rolą `GUEST`.
2. **Gość nie może się logować.** Gość nie ma rekordu `UserAccount` (brak hasła
   / providera), a dodatkowo logowanie jest blokowane jawnie po roli.
3. **Uprawnienia do Gości:** każdy użytkownik roli `user` (oraz `admin`) może
   *dodać* Gościa; tylko `admin` może go *modyfikować* i *usuwać*.
4. **Historia wypożyczeń:** każde wypożyczenie to osobny rekord `Loan`, dzięki
   czemu ten sam obiekt może być wielokrotnie wypożyczany temu samemu Gościowi,
   a pełna historia jest zachowana. Dodatkowo każde wypożyczenie/zwrot zapisuje
   wpis w `item_history` (`LOANED` / `RETURNED`).

### Świadome kompromisy

- `User.email` jest teraz **nullable** (Goście mogą nie mieć maila). Pozostaje
  `UNIQUE` — w MySQL `UNIQUE` dopuszcza wiele wartości `NULL`, więc logowanie
  zwykłych użytkowników po unikalnym, niepustym mailu działa bez zmian. Jeżeli
  Gość poda email, musi on być unikalny (rezygnacja z "wspólnego maila
  firmowego" z pierwotnego szkicu — można to w razie potrzeby przywrócić,
  zdejmując `unique`).
- Profil Gościa jest minimalny (imię, opcjonalne nazwisko, opcjonalny email),
  aby nie zaśmiecać modelu `User`. Pola typu `description`/`registered_by`
  z pierwotnego szkicu `Guest` zostały pominięte.
- Goście są **wykluczeni** z listy `GET /users` (mają dedykowany `GET /guests`).

## 2. Backend — zmiany

### Nowe / przepisane domeny

- **`src/loans/`** (przepisana):
  - `constants.py` — `LoanStatus = {ACTIVE, RETURNED}`, `LOAN_PURPOSE_MAX_LENGTH`,
    limity stron.
  - `models.py` — `Loan(item_id, borrower_id → user, registered_by → user,
    created_at, declared_return_date, loan_purpose, returned_at, status)`.
    Usunięto `guest_id`, `user_id`, pola decyzyjne oraz check-constraint.
  - `schemas.py` — `LoanCreate`, `LoanResponse`, `LoansPaged` (typy `LoanID`,
    `LoanPurpose` wg wzorca `Annotated`).
  - `service.py` — `LoanService.register_loan`, `return_loan`, `get_loan`,
    `list_loans`.
  - `exceptions.py` — wyjątki domenowe.
  - `router.py` — endpointy `/loans`.

- **`src/guests/`** (przepisana — bez własnej tabeli):
  - usunięto `models.py` (tabela `guest`).
  - `schemas.py` — `GuestCreate`, `GuestUpdate`, `GuestResponse`, `GuestsPaged`.
  - `service.py` — `GuestService` (tworzy `User` z rolą `GUEST`, listuje,
    edytuje, usuwa — usuwanie reużywa `UserService.delete_user`).
  - `exceptions.py`, `constants.py`, `router.py`.

### Zmiany w istniejących plikach

- `src/auth/constants.py` — dodano rolę `UserRole.GUEST`.
- `src/auth/service.py` — `login_user` oraz `get_or_create_google_user`
  odrzucają konta o roli `GUEST` (HTTP 403).
- `src/auth/dependencies.py` — nowa zależność `require_user_or_admin`
  (`RequireUserOrAdmin`) — dopuszcza tylko role `USER` i `ADMIN`.
- `src/users/models.py` — `email` jest `Mapped[str | None]`.
- `src/users/schemas.py` — `UserDetails` dopuszcza `email`/`last_name = None`.
- `src/users/service.py` — usunięto referencje do tabeli `Guest`; lista
  użytkowników pomija rolę `GUEST`; sprawdzanie historii korzysta z
  `Loan.borrower_id` / `Loan.registered_by`.
- `src/items/constants.py` — dodano `ItemChangeLogType.RETURNED`.
- `src/main.py` — podłączono routery `guests` i `loans`; usunięto import modelu
  `guests` (brak tabeli).
- `src/seed.py` — usunięto import modelu `guest`; dodano seedowego Gościa
  (`SEED_IDS.guest_user`, `guest.seed@example.com`).
- `backend/docs/db_schema.mmd` — diagram ER zaktualizowany (usunięto `Guest`,
  zaktualizowano `Loan`, `User.role`, `ItemHistory.change_type`).

### Nowe endpointy API

| Metoda | Ścieżka | Uprawnienia | Opis |
|--------|---------|-------------|------|
| POST   | `/guests` | user/admin | Dodaj Gościa |
| GET    | `/guests` | zalogowany | Lista Gości (filtr `search`) |
| GET    | `/guests/{id}` | zalogowany | Szczegóły Gościa |
| PUT    | `/guests/{id}` | admin | Edytuj Gościa |
| DELETE | `/guests/{id}` | admin | Usuń Gościa |
| POST   | `/loans` | user/admin | Zarejestruj wypożyczenie Gościowi |
| GET    | `/loans` | zalogowany | Historia wypożyczeń (filtry `item_id`, `borrower_id`, `loan_status`) |
| GET    | `/loans/{id}` | zalogowany | Szczegóły wypożyczenia |
| POST   | `/loans/{id}/return` | user/admin | Zarejestruj zwrot |

### Logika rejestracji wypożyczenia

`POST /loans` waliduje, że: obiekt istnieje i jest `AVAILABLE`, a `borrower`
istnieje i ma rolę `GUEST`. Tworzy rekord `Loan` (status `ACTIVE`), ustawia
status obiektu na `LOANED` i dopisuje wpis `LOANED` do `item_history`.
`POST /loans/{id}/return` ustawia status na `RETURNED`, `returned_at`, przywraca
obiekt do `AVAILABLE` i dopisuje wpis `RETURNED`.

## 3. Testy

- `tests/conftest.py` — nowe fixture `admin_client`, `user_client`,
  `observer_client` (uwierzytelnione przez nadpisanie `get_current_user`).
- `tests/helpers.py` — helpery `make_guest_payload`, `create_guest_via_api`,
  `make_loan_payload`.
- `tests/guests/test_guest_router_integration.py` — tworzenie/edycja/usuwanie
  Gości i kontrola uprawnień.
- `tests/loans/test_loan_router_integration.py` — rejestracja wypożyczenia,
  zmiana statusu obiektu, historia, ponowne wypożyczenie temu samemu Gościowi.
- `tests/loans/test_loan_service.py` — testy warstwy serwisu.

Testy bazodanowe są oznaczone `pytest.mark.integration` (uruchamiane na MySQL
przez `make integration-tests`). `make unit-tests` i `ruff` przechodzą.

> Uwaga: schemat bazy budowany jest przez `Base.metadata.create_all` (brak
> Alembica). Środowiska dev/test należy odświeżyć: `python -m src.seed reset --yes`.

## 4. Frontend — zmiany (warstwa danych)

Zgodnie z zasadą separacji logiki (custom hooks) dodano warstwę danych gotową do
podpięcia pod UI:

- `src/api/endpoints.js` — dodano sekcje `GUESTS` i `LOANS`.
- `src/features/rentals/useRentals.js` — hook `registerLoan`, `listLoans`,
  `returnLoan`.
- `src/features/guests/useGuests.js` — hook `listGuests`, `createGuest`,
  `updateGuest`, `deleteGuest`.
- `src/i18n/locales/pl.json` i `en.json` — sekcje `guests` i `rentals`.

### Do zrobienia po stronie UI (poza zakresem tej zmiany)

Komponenty widoków (np. panel rejestracji wypożyczenia w karcie obiektu oraz
ekran zarządzania Gośćmi) należy zbudować w oparciu o powyższe hooki i klucze
i18n. Istniejący `ItemDetailsModal.jsx` działa obecnie na danych mockowych i nie
był modyfikowany, aby uniknąć konfliktów z trwającymi pracami.
