/** Mapowanie statusów przedmiotu: backend (EN) ↔ wyświetlanie (PL w mockach). */

export const ITEM_STATUS = {
    AVAILABLE: 'available',
    PENDING_APPROVAL: 'pending_approval',
    RESERVED: 'reserved',
    LOANED: 'loaned',
    BROKEN: 'broken',
};

const LEGACY_TO_API = {
    dostępny: ITEM_STATUS.AVAILABLE,
    'oczekuje akceptacji': ITEM_STATUS.PENDING_APPROVAL,
    zarezerwowany: ITEM_STATUS.RESERVED,
    wypożyczony: ITEM_STATUS.LOANED,
    uszkodzony: ITEM_STATUS.BROKEN,
};

const API_TO_LEGACY = Object.fromEntries(
    Object.entries(LEGACY_TO_API).map(([legacy, api]) => [api, legacy])
);

/** Normalizuje status do wartości API (np. `dostępny` → `available`). */
export const normalizeItemStatus = (status) => LEGACY_TO_API[status] ?? status;

/** Zwraca etykietę do wyświetlenia (zachowuje polskie mocki lub tłumaczenie). */
export const getItemStatusLabel = (status, t) => {
    const apiStatus = normalizeItemStatus(status);
    return t(`itemStatuses.${apiStatus}`, { defaultValue: API_TO_LEGACY[apiStatus] ?? status });
};

export const STATUS_BADGE_CLASSES = {
    [ITEM_STATUS.AVAILABLE]: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
    [ITEM_STATUS.PENDING_APPROVAL]: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
    [ITEM_STATUS.RESERVED]: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
    [ITEM_STATUS.LOANED]: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
    [ITEM_STATUS.BROKEN]: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400',
};

export const getStatusBadgeClass = (status) => {
    const apiStatus = normalizeItemStatus(status);
    return STATUS_BADGE_CLASSES[apiStatus] ?? STATUS_BADGE_CLASSES[ITEM_STATUS.AVAILABLE];
};

/** Czy identyfikator przedmiotu pochodzi z API (numeryczny). */
export const isApiItemId = (itemId) => Number.isInteger(Number(itemId)) && String(itemId).match(/^\d+$/);
