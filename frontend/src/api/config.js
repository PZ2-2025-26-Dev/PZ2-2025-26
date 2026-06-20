/**
 * Bazowy URL API. Domyślnie bezpośrednio na backend (port 8000).
 * Proxy Vite (/api) działa tylko gdy dev server jest uruchomiony z vite.config.js.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
