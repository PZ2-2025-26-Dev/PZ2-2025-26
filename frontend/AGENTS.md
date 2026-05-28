# AGENTS.md - Wytyczne Projektowe i Standardy Deweloperskie

Dokument definiuje stos technologiczny, architekturę, standardy kodowania oraz strukturę projektu dla zespołu deweloperskiego (oraz agentów AI) pracujących nad systemem API.

---

## 1. Tech Stack (Stos Technologiczny)

* **Core:** React 18, Vite (klasyczne SPA, brak SSR).
* **Styling:** Tailwind CSS (czysty Tailwind, bez gotowych bibliotek komponentów typu shadcn/MUI). Pełne wsparcie dla Dark Mode (`dark:`) oraz natywna responsywność (Mobile-First).
* **Stan globalny:** Zustand (konfiguracja w `src/store/`).
* **Komunikacja HTTP:** Axios (klient skonfigurowany w `src/api/`).
* **Umiędzynarodowienie:** `react-i18next` (Słowniki JSON w `src/i18n/locales/`).
* **Testy:** React Testing Library (RTL).
* **Rozszerzenia:** `.jsx` (używamy nowoczesnego JavaScriptu ES6+).

## 2. Architektura i Struktura Plików
Projekt opiera się na **Feature-Sliced Design**. Unikamy wrzucania wszystkiego do jednego worka. Każda domena biznesowa (np. `inventory`, `categories`, `rentals`) posiada swój własny folder wewnątrz `features/`.

```text
frontend/
├── public/
├── src/
│   ├── api/                 # Konfiguracja Axiosa i interceptory (wstrzykiwanie JWT)
│   ├── assets/              # Statyczne zasoby (index.css z Tailwind)
│   ├── components/          # Globalne, reużywalne "dumb components" (Button, Loader, Modal)
│   ├── features/            # Autonomiczne domeny biznesowe:
│   │   ├── auth/            # Strażnicy dostępu (RoleGuard), definicje ról
│   │   ├── categories/      # Drzewo kategorii
│   │   ├── inventory/       # Ewidencja (listy sprzętu, dodawanie, karty przedmiotów)
│   │   ├── locations/       # Struktura budynków i sal
│   │   └── rentals/         # Logika wypożyczeń, rezerwacji i zwrotów
│   ├── hooks/               # Globalne custom hooki niezwiązane z jedną domeną (np. useDebounce)
│   ├── i18n/                # Słowniki tłumaczeń (pl.json, en.json) i konfiguracja
│   ├── layouts/             # Główne szablony stron (np. DashboardLayout z nawigacją)
│   ├── routes/              # Definicje ścieżek (React Router)
│   ├── store/               # Globalny stan (Zustand) np. sesja użytkownika
│   ├── utils/               # Czyste funkcje m.in. walidatory, formatowanie dat
│   ├── App.jsx              # Główny router i providerzy
│   └── main.jsx             # Inicjalizacja Reacta
```

## 3. Workflow i Standardy Kodowania

1. **Separacja Logiki (Custom Hooks)**: Widoki (.jsx) nie mogą zawierać logiki fetch/axios bezpośrednio w sobie. Cała komunikacja sieciowa musi być wyciągnięta do custom hooków w folderze danego feature'a (np. useRentals.js).

2. **Dumb vs Smart Components**: Dziel kod na małe komponenty. Komponenty prezentacyjne (dumb) przyjmują tylko propsy. Komponenty widoków (smart) korzystają z hooków do zarządzania stanem.

3. **i18next (Zero hardcodowania)**: Wszystkie teksty w interfejsie muszą przechodzić przez funkcję t() z hooka useTranslation(). Dodając nowe pole tekstowe, poinstruuj programistę o konieczności dodania klucza do pl.json i en.json.

4. **Tailwind, Responsywność (Mobile-First) i Dark Mode**: Aplikacja musi w pełni wspierać urządzenia mobilne (smartfony, tablety). Bezwzględnie stosuj podejście Mobile-First. Domyślne klasy Tailwind muszą definiować widok dla małych ekranów (np. w-full, flex-col, ukrywanie pobocznych paneli), a prefiksy responsywne (sm:, md:, lg:) powinny nadpisywać układ dla większych wyświetlaczy (np. md:w-1/2, md:flex-row). Zawsze uwzględniaj wariant dark: przy definiowaniu kolorów, trzymając się ustalonej palety (np. slate, emerald, rose).

5. **Typowanie (JSDoc)**: Ponieważ używamy JS (nie TS), dla skomplikowanych obiektów (jak modele danych z API) używaj komentarzy JSDoc, aby poprawić intellisense w IDE deweloperów.


## 4. Przykłady Implementacji
### Przykład A: Custom Hook do obsługi API (features/rentals/useRentals.js)

```jsx
import { useState } from 'react';
import api from '../../api/axiosClient';

/**
 * @typedef {Object} RentalRequest
 * @property {string} dueDate - Data zwrotu (YYYY-MM-DD)
 */

export const useRentals = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const requestRental = async (itemId, rentalData) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.post(`/v1/items/${itemId}/borrow`, rentalData);
            return response.data;
        } catch (err) {
            setError(err.response?.data?.detail || 'Błąd sieci');
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    return { requestRental, isLoading, error };
};
```

### Przykład B: Smart Component wykorzystujący Mobile-First, i18n oraz Tailwind (features/rentals/BorrowPanel.jsx)


```jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRentals } from './useRentals';

export default function BorrowPanel({ item, onSuccess }) {
    const { t } = useTranslation();
    const { requestRental, isLoading } = useRentals();
    const [dueDate, setDueDate] = useState('');

    const handleSubmit = async () => {
        if (!dueDate) return;
        try {
            await requestRental(item.id, { dueDate });
            onSuccess();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        {/* Kontener: pełna szerokość na mobilkach, padding zmniejszony na małych ekranach */}
        <div className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-xl shadow-sm">
            <h3 className="font-bold text-base sm:text-lg text-blue-800 dark:text-blue-400 mb-2 sm:mb-3">
                {t('rentals.panelTitle')}
            </h3>
            
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                {t('rentals.dueDateLabel')}
            </label>
            <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-3 sm:py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 transition focus:ring focus:ring-blue-500/20"
                disabled={isLoading}
            />
            
            <button
                onClick={handleSubmit}
                disabled={isLoading || !dueDate}
                {/* Wyższy padding pionowy na mobilkach dla łatwiejszego klikania */}
                className="w-full mt-4 py-3 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-xs font-bold rounded-lg transition disabled:opacity-50"
            >
                {isLoading ? t('common.loading') : t('rentals.submitBtn')}
            </button>
        </div>
    );
}
```
