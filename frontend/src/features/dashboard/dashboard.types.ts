import type { AppUser } from '@/types';
import type { AppPreferences } from '@/theme/appPreferences';

export type CategoryOption = {
    id: number;
    name: string;
    parentId: number | null;
    path: string;
};

export type MenuSection = 'dashboard' | 'inventory' | 'loans' | 'locations' | 'directory' | 'users' | 'statistics';

export type DashboardPageProps = {
    user: AppUser;
    onLogout: () => void;
    isDarkMode: boolean;
    setIsDarkMode: (enabled: boolean) => void;
    preferences: AppPreferences;
    onPreferencesChange: (preferences: AppPreferences) => void;
};
