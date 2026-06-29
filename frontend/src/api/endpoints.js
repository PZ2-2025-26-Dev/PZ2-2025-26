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
        HISTORY: (id) => `/items/${id}/history`,
        SCAN: (code) => `/items/scan/${encodeURIComponent(code)}`,
        QR: (id, format) => `/items/${id}/qr.${format}`,
        LABEL: (id, format) => `/items/${id}/label.${format}`,
        ATTACHMENTS: (id) => `/items/${id}/attachments`,
        ATTACHMENT_DOWNLOAD: (itemId, attachmentId) => `/items/${itemId}/attachments/${attachmentId}/download`,
        ATTACHMENT_DELETE: (itemId, attachmentId) => `/items/${itemId}/attachments/${attachmentId}`,
    },
    CATEGORIES: {
        BASE: '/categories',
        DETAILS: (id) => `/categories/${id}`,
        TREE: '/categories/tree',
    },
    LOCATIONS: {
        BASE: '/locations',
        DETAILS: (id) => `/locations/${id}`,
        HISTORY: (id) => `/locations/${id}/history`,
    },
    USERS: {
        BASE: '/users',
        BROWSE: '/users/browse',
        GUESTS: '/users/guests',
        DETAILS: (id) => `/users/${id}`,
    },
    LOANS: {
        BASE: '/loans',
        EXTERNAL: '/loans/external',
        DETAILS: (id) => `/loans/${id}`,
        APPROVE: (id) => `/loans/${id}/approve`,
        DENY: (id) => `/loans/${id}/deny`,
        RETURN: (id) => `/loans/${id}/return`,
        CONFIRM_RETURN: (id) => `/loans/${id}/confirm-return`,
    },
};
