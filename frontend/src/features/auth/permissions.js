export const ROLES = {
    ADMIN: 'admin',
    USER: 'user',
    OBSERVER: 'observer',
    ZERO_ACCESS: 'zero-access'
};

export const PERMISSIONS = {
    ITEM_CREATE: 'item:create',
    ITEM_LIST: 'item:list',
    ITEM_EDIT_OWN: 'item:edit:own',
    ITEM_EDIT_ANY: 'item:edit:any',
    SYSTEM_EXPORT: 'system:export',
    SYSTEM_MANAGE: 'system:manage'
};

export const ROLE_PERMISSIONS = {
    [ROLES.ADMIN]: [
        PERMISSIONS.ITEM_CREATE,
        PERMISSIONS.ITEM_LIST,
        PERMISSIONS.ITEM_EDIT_ANY,
        PERMISSIONS.SYSTEM_EXPORT,
        PERMISSIONS.SYSTEM_MANAGE
    ],
    [ROLES.USER]: [
        PERMISSIONS.ITEM_CREATE,
        PERMISSIONS.ITEM_LIST,
        PERMISSIONS.ITEM_EDIT_OWN
    ],
    [ROLES.OBSERVER]: [
        PERMISSIONS.ITEM_LIST
    ],
    [ROLES.ZERO_ACCESS]: []
};

export const hasPermission = (user, permission) => {
    if (!user || !user.role) return false;
    const permissions = ROLE_PERMISSIONS[user.role] || [];
    return permissions.includes(permission);
};