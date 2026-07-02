import type { AppUser } from '@/types';

export type CategoryOption = {
    id: number;
    name: string;
    parentId: number | null;
    path: string;
};

export type MenuSection = 'dashboard' | 'inventory' | 'loans' | 'locations' | 'directory' | 'users';

export type DashboardPageProps = {
    user: AppUser;
    onLogout: () => void;
    isDarkMode: boolean;
    setIsDarkMode: (enabled: boolean) => void;
};
