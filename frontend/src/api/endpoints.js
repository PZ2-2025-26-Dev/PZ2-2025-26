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
        DETAILS: (id) => `/locations/${id}`,
<<<<<<< HEAD
        HISTORY: (id) => `/locations/${id}/history`,
=======
>>>>>>> 97b0ba2 (LocationManager view)
    },
    USERS: {
        BASE: '/users',
        DETAILS: (id) => `/users/${id}`,
    }
};
