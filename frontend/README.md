# Zintegrowany System Zarządzania Aparaturą Pomiarową AGH

Wydziałowa platforma logistyczno-ewidencyjna (MVP Frontend), stworzona przez zespół **Central Positronics** dla Wydziału Fizyki i Informatyki Stosowanej (WFiIS) Akademii Górniczo-Hutniczej. System zapewnia pełną kontrolę nad bazą sprzętową, strukturą lokalizacji oraz procesami rezerwacji i wypożyczeń.

## Stos technologiczny
* **Framework:** React 18
* **Build Tool:** Vite
* **Styling:** Tailwind CSS (z natywną obsługą Dark/Light Mode)
* **Architektura:** Feature-Driven / Feature-Sliced Design

## Struktura projektu

Główny kod aplikacji znajduje się w katalogu `src/`:

```text
src/
├── components/           # Globalne, reużywalne komponenty (np. ustandaryzowany SystemClock)
├── features/             # Autonomiczne moduły biznesowe aplikacji
│   ├── auth/             # Logika logowania, symulacja SSO, RBAC (RoleGuard, permissions.js)
│   └── dashboard/        # Główny panel inwentaryzacyjny
│       ├── DashboardPage.jsx    # Główny widok tabeli inwentarzowej, statystyk i filtrów
│       ├── AddAssetModal.jsx    # Formularz dodawania nowego sprzętu
│       ├── ItemDetailsModal.jsx # Karta przedmiotu (Panel Właściciela i obieg wypożyczeń)
│       └── CategoryManager.jsx  # Moduł zarządzania hierarchiczną strukturą drzewiastą kategorii
├── App.jsx               # Spinacz aplikacji, zarządzanie globalnym stanem (motyw, język, sesja)
├── main.jsx              # Punkt wejścia React (inicjalizacja drzewa DOM)
└── index.css             # Konfiguracja bazowa i globalne dyrektywy Tailwind CSS
```
## Uruchomienie projektu

Aby uruchomić projekt, wykonaj poniższe kroki:

### 1. Zainstaluj zależności

```bash
npm install
```

### 2. Uruchom środowisko deweloperskie

```bash
npm run dev
```

### 3. Sprawdź lint

Projekt używa ESLint do statycznej analizy kodu. Linter można uruchomić lokalnie komendą:

```bash
npm run lint
```
