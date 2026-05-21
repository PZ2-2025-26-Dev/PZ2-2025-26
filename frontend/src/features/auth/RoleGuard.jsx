import React from 'react';
import { hasPermission } from './permissions';

export default function RoleGuard({ user, requiredPermission, children }) {
    if (hasPermission(user, requiredPermission)) {
        return <>{children}</>;
    }

    return null;
}