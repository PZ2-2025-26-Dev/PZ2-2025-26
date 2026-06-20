import type { ReactNode } from 'react';

import type { AppUser } from '@/types';
import { hasPermission } from './permissions';

export default function RoleGuard({
    user,
    requiredPermission,
    children,
}: {
    user: AppUser;
    requiredPermission: string;
    children: ReactNode;
}) {
    return hasPermission(user, requiredPermission) ? <>{children}</> : null;
}
