export const ENDPOINTS = {
    AUTH: {
        LOGIN: '/auth/login',
        REFRESH: '/auth/refresh',
    },
    USERS: {
        BASE: '/api/v1/users',
        DETAILS: (id) => `/api/v1/users/${id}`,
    },
    ITEMS: {
        BASE: '/items',
        DETAILS: (id) => `/items/${id}`,
        BORROW: (id) => `/items/${id}/borrow`,
        RETURN: (id) => `/items/${id}/return`,
        EXTERNAL_RENT: (id) => `/items/${id}/rent-external`,
    },
    CATEGORIES: {
        BASE: '/categories',
        TREE: '/categories/tree',
    },
    LOCATIONS: {
        BUILDINGS: '/buildings',
        ROOMS: '/rooms',
        TREE: '/locations/tree',
    }
};
