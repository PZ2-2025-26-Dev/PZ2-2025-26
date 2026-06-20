export const ENDPOINTS = {
    AUTH: {
        LOGIN: '/auth/login',
        REGISTER: '/auth/register',

        GOOGLE_LOGIN: '/auth/google/login',
        GOOGLE_CALLBACK: '/auth/google/callback',

        REFRESH: '/auth/refresh',
    },
    // USERS: {
    //     BASE: '/api/v1/users',
    //     DETAILS: (id) => `/api/v1/users/${id}`,
    // },
    ITEMS: {
        BASE: '/items',
        DETAILS: (id) => `/items/${id}`,
        HISTORY: (id) => `/items/${id}/history`,
    },
    CATEGORIES: {
        BASE: '/categories',
        TREE: '/categories/tree',
    },
    LOCATIONS: {
        BUILDINGS: '/buildings',
        ROOMS: '/rooms',
        TREE: '/locations/tree',
    },
    USERS: {
        BASE: '/users',
        DETAILS: (id) => `/users/${id}`,
    },
    GUESTS: {
        BASE: '/guests',
        DETAILS: (id) => `/guests/${id}`,
    },
    LOANS: {
        BASE: '/loans',
        DETAILS: (id) => `/loans/${id}`,
        RETURN: (id) => `/loans/${id}/return`,
    }
};
