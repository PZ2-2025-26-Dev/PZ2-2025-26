export const ENDPOINTS = {
    AUTH: {
        LOGIN: '/auth/login',
        REFRESH: '/auth/refresh',
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
        BASE: '/locations',
        TREE: '/locations/tree',
    }
};
