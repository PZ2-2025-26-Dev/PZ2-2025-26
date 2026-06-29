import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Box,
    Download,
    MapPinned,
    LogOut,
    Moon,
    PackageCheck,
    Plus,
    Search,
    Sun,
    Users,
    LayoutDashboard,
    ClipboardList,
    Menu,
    X,
    ChevronDown,
    ChevronRight,
    UserPlus,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import SystemClock from '@/components/SystemClock';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AppUser, InventoryItem } from '@/types';
import RoleGuard from '../auth/RoleGuard';
import { PERMISSIONS, hasPermission } from '../auth/permissions';
import { useCategories } from './useCategories';
import { ITEM_STATUSES, useInventory } from '../inventory/useInventory';
import { useExport } from '@/features/exports/useExport';
import UserManager from '../users/UserManager';
import UserDirectory from '../guests/UserDirectory';
import LocationManager from '../locations/LocationManager';
import AddAssetModal from './AddAssetModal';
import CategoryManager from './CategoryManager';
import ItemDetailsModal from './ItemDetailsModal';
import RentalCenter from '../rental/RentalCenter';
import InventoryFilters, { InventoryFiltersState } from '../inventory/InventoryFilters';
import InventoryToolbar from '../inventory/InventoryToolbar';
import { useUsers } from '../users/useUsers';
import { useLocations } from '../locations/useLocations';
import QrScannerDialog from '@/components/QrScannerDialog';

type CategoryOption = {
    id: number;
    name: string;
    parentId: number | null;
    path: string;
};

type MenuSection = 'dashboard' | 'inventory' | 'loans' | 'locations' | 'directory' | 'users';

export type ApiUser = {
    id: number;
    firstName: string;
    lastName: string;
};

const DASHBOARD_ACTIVE_SECTION_KEY = 'dashboard.activeSection';

function isMenuSection(value: string | null): value is MenuSection {
    return value === 'dashboard' || value === 'inventory' || value === 'loans' || value === 'locations' || value === 'directory' || value === 'users';
}

type DashboardPageProps = {
    user: AppUser;
    onLogout: () => void;
    isDarkMode: boolean;
    setIsDarkMode: (enabled: boolean) => void;
};

export default function DashboardPage({ user, onLogout, isDarkMode, setIsDarkMode }: DashboardPageProps) {
    const { t, i18n } = useTranslation();
    const { listItems, error, clearError } = useInventory();
    const { listCategories } = useCategories();
    const { exportItemsXlsx } = useExport();

    const [items, setItems] = useState<InventoryItem[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    // Dodane brakujące stany dla filtrów (pobierane docelowo z API)
    const [locations, setLocations] = useState<Array<{ id: number; path: string }>>([]);
    const [users, setUsers] = useState<Array<{ id: number; name: string }>>([]);
    const { listUsers } = useUsers();
    const { listLocations } = useLocations();

    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    
    const [filters, setFilters] = useState<InventoryFiltersState>({
        uuid: '',
        name: '',
        description: '',
        status: '',
        categoryId: '',
        locationId: '',
        ownerId: '',
        borrowerId: '',
        search: '',
        sort_by: 'name',
        sort_order: 'asc',
        page: 1,
        limit: 15,
        parameters: undefined,
    });

    const [stats, setStats] = useState({
        total: 0,
        loaned: 0,
        pending: 0,
        broken: 0,
    });

    const [activeSection, setActiveSection] = useState<MenuSection>(() => {
        const storedSection = localStorage.getItem(DASHBOARD_ACTIVE_SECTION_KEY);
        return isMenuSection(storedSection) ? storedSection : 'dashboard';
    });

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [pendingUserCount, setPendingUserCount] = useState(0);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

    type SortField = "id" | "name" | "category" | "location" | "status" | "owner";

    const columns: Array<{
        label: React.ReactNode;
        field?: SortField;
        sortable?: boolean;
    }> = [
        { label: "ID", field: "id", sortable: true },
        { label: t('dashboard.thName'), field: "name", sortable: true },
        { label: t('dashboard.tabCategories'), field: "category", sortable: true },
        { label: t('dashboard.tabLocations'), field: "location", sortable: true },
        { label: t('dashboard.thStatus'), field: "status", sortable: true },
        { label: t('addAssetModal.owner'), field: "owner", sortable: true },
    ];

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    const canViewList = hasPermission(user, PERMISSIONS.ITEM_LIST);
    const canManageSystem = hasPermission(user, PERMISSIONS.SYSTEM_MANAGE);

    useEffect(() => {
        localStorage.setItem(DASHBOARD_ACTIVE_SECTION_KEY, activeSection);
    }, [activeSection]);

    useEffect(() => {
        if (activeSection === 'users' && !canManageSystem) {
            setActiveSection('dashboard');
        }
    }, [activeSection, canManageSystem]);

    const refreshItems = useCallback(async () => {
        setIsLoading(true);
        const result = await listItems({ ...filters, limit: 50 });
        if (result.success) {
            setItems(result.items);
            setTotal(result.total);
            
            // Wyliczenie statystyk na żywo z pobranych przedmiotów
            const computedStats = { total: result.total, loaned: 0, pending: 0, broken: 0 };
                result.items.forEach((item: InventoryItem) => {
                    if (item.status === 'loaned') computedStats.loaned++;
                    else if (item.status === 'pending_approval') computedStats.pending++;
                    else if (item.status === 'broken') computedStats.broken++;
                });
            setStats(computedStats);
        }

        setIsLoading(false);
    }, [listItems, filters]);

    const refreshCategories = useCallback(async () => {
        const result = await listCategories();
        if (result.success) {
            setCategories(result.categories.map((category) => ({
                id: category.id,
                name: category.name,
                parentId: category.parentId,
                path: category.path,
            })));
        }
    }, [listCategories]);

    const refreshUsers = useCallback(async () => {
        const result = await listUsers({ status: 'active', limit: 100 });

        if (result.success) {
            setUsers(
                result.users.map(u => ({
                    id: u.id,
                    name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
                }))
            );
        }
    }, [listUsers]);

    const refreshLocations = useCallback(async () => {
        const result = await listLocations();

        if (result.success) {
            setLocations(result.locations);
        }
    }, [listLocations]);

    useEffect(() => {
        if (!canViewList) return;

        refreshItems();
        refreshCategories();
        refreshUsers();
        refreshLocations();
    }, [canViewList, refreshItems, refreshCategories, refreshUsers, refreshLocations, filters]);

    const handleSort = (field: SortField) => {
        setFilters(prev => {
            const isSameField = prev.sort_by === field;
            const nextOrder = isSameField && prev.sort_order === "asc" ? "desc" : "asc";

            return {
                ...prev,
                sort_by: field,
                sort_order: nextOrder,
                page: 1,
            };
        });
    };

    const renderSortIcon = (field: SortField ) => {
        if (filters.sort_by !== field) return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-40" />;
        return filters.sort_order === "asc" 
            ? <ArrowUp className="ml-2 h-4 w-4 inline text-primary" />
            : <ArrowDown className="ml-2 h-4 w-4 inline text-primary" />;
    };

    const handleUpdateItemStatus = () => {
        refreshItems();
    };

    
    const handleQrScan = (decodedText: string) => {
        setSearchQuery(decodedText);
        setIsQrScannerOpen(false);
    };

    const handleExportXlsx = useCallback(async () => {
        await exportItemsXlsx({
            ...filters,
            search: filters.search || searchQuery,
        });
    }, [exportItemsXlsx, filters, searchQuery]);
    const handleItemLocationChanged = (itemId: string | number, location: { id: number; path: string }) => {
        setItems((current) => current.map((item) => item.id === itemId ? {
            ...item,
            location: location.path,
            locationId: location.id,
        } : item));
        setSelectedItem((current) => current?.id === itemId ? {
            ...current,
            location: location.path,
            locationId: location.id,
        } : current);
        void refreshItems();
    };

    const getStatusLabel = (status: string) => t(`dashboard.itemStatuses.${status}`);

    const menuItems = [
        { id: 'dashboard', label: t('dashboard.mainPanel'), icon: <LayoutDashboard className="size-5" /> },
        { id: 'inventory', label: t('dashboard.tabInventory'), icon: <Box className="size-5" /> },
        { id: 'loans', label: t('dashboard.loans'), icon: <ClipboardList className="size-5" /> },
        { id: 'locations', label: canManageSystem ? t('dashboard.locationsAndCategories') : t('dashboard.tabLocations'), icon: <MapPinned className="size-5" /> },
        { id: 'directory', label: t('dashboard.tabDirectory'), icon: <UserPlus className="size-5" />, requiresPermission: PERMISSIONS.ITEM_CREATE },
        { id: 'users', label: t('dashboard.tabUsers'), icon: <Users className="size-5" />, requiresPermission: PERMISSIONS.SYSTEM_MANAGE },
    
    ];

    const renderContent = () => {
        switch (activeSection) {
            case 'dashboard':
                return (
                    <div className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <StatCard title={t('dashboard.totalAssets')} value={stats.total} icon={Box} />
                            <StatCard title={t('dashboard.borrowedAssets')} value={stats.loaned} icon={PackageCheck} className="text-blue-600 dark:text-blue-400" />
                            <StatCard title={t('dashboard.pendingApprovals')} value={stats.pending} icon={Users} className="text-amber-600 dark:text-amber-400" />
                            <StatCard title={t('dashboard.damagedAssets')} value={stats.broken} icon={AlertTriangle} className="text-rose-600 dark:text-rose-400" />
                        </div>
                        {error && (
                            <Alert variant="destructive">
                                <AlertTriangle />
                                <AlertTitle>{t('auth.loginErrorTitle')}</AlertTitle>
                                <AlertDescription className="flex items-center justify-between gap-3">
                                    <span>{error}</span>
                                    <Button variant="outline" size="sm" onClick={clearError}>✕</Button>
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                );
            case 'inventory':
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.dashboard')}</h2>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('dashboard.dashboardDesc')}</p>
                        </div>
                        <InventoryToolbar
                            user={user}
                            filters={filters}
                            onChange={setFilters}
                            categories={categories}
                            locations={locations}
                            users={users}
                            onAdd={() => setIsAddModalOpen(true)}
                            onExport={handleExportXlsx}
                            isLoading={isLoading}
                            />

                        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 overflow-hidden">
                            <div className="overflow-x-auto">
                                <Table className="min-w-full">
                                    
                                    {/* HEADER */}
                                    <TableHeader>
                                        <TableRow className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/40">
                                            {columns.map((col) => (
                                                <TableHead
                                                    key={String(col.field)}
                                                    className={`
                                                        whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300
                                                        ${col.sortable ? "cursor-pointer select-none hover:text-slate-900 dark:hover:text-white" : ""}
                                                    `}
                                                    onClick={() => col.sortable && col.field && handleSort(col.field)}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        {col.label}
                                                        {col.sortable && col.field && renderSortIcon(col.field)}
                                                    </div>
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>

                                    {/* BODY */}
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="py-12 text-center text-sm text-slate-400">
                                                    {t('common.loading')}
                                                </TableCell>
                                            </TableRow>
                                        ) : items.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="py-12 text-center text-sm text-slate-400">
                                                    {t('dashboard.noResults')}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            items.map((item, index) => (
                                                <TableRow
                                                    key={item.id}
                                                    onClick={() => {
                                                        setSelectedItem(item);
                                                        setIsDetailsModalOpen(true);
                                                    }}
                                                    className="
                                                        group cursor-pointer border-b border-slate-100
                                                        hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-900/40
                                                        transition-colors duration-150
                                                    "
                                                >
                                                    <TableCell className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap w-[120px] max-w-[120px] overflow-hidden text-ellipsis">
                                                        {item.id}
                                                    </TableCell>

                                                    <TableCell className="px-4 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-slate-900 dark:text-white">
                                                                {item.name}
                                                            </span>
                                                            {item.description && (
                                                                <span className="text-xs text-slate-400 line-clamp-1">
                                                                    {item.description}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                                        {item.category}
                                                    </TableCell>

                                                    <TableCell className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                                        {item.location}
                                                    </TableCell>

                                                    <TableCell className="px-4 py-3">
                                                        <StatusBadge status={item.status} />
                                                    </TableCell>

                                                    <TableCell className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                                        {item.owner}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Paginacja */}
                        <div className="flex items-center justify-between space-x-2 py-4">
                            <div className="text-sm text-muted-foreground">
                                {t("dashboard.shown")} {items.length} {t("dashboard.of")} {total} {t("dashboard.items")}
                            </div>
                            <div className="flex space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setFilters(prev => ({ ...prev, page: Math.max((prev.page || 1) - 1, 1) }))}
                                    disabled={filters.page === 1 || isLoading}
                                >
                                    {t("inventoryFilters.common.previous")}
                                </Button>
                                <div className="flex items-center justify-center text-sm font-medium px-2">
                                    {t('inventoryFilters.common.page')} {filters.page} z {Math.ceil(total / (filters.limit || 15))}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                                    disabled={items.length < (filters.limit || 15) || isLoading}
                                >
                                    {t("inventoryFilters.common.next")}
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            case 'loans':
                return <RentalCenter user={user} />;
            case 'locations':
                return canManageSystem ? (
                        <div className="grid gap-6 lg:grid-cols-2">
                            <div>
                                <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{t('dashboard.tabLocations')}</h3>
                                <LocationManager canManage />
                            </div>
                            <div>
                                <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{t('dashboard.tabCategories')}</h3>
                                <CategoryManager />
                            </div>
                        </div>
                ) : (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t('dashboard.tabLocations')}</h3>
                        <LocationManager
                            canManage={false}
                            canCreateRemote={user.role === 'user'}
                        />
                    </div>
                );
            
            case 'directory':
                return (
                    <RoleGuard user={user} requiredPermission={PERMISSIONS.ITEM_CREATE}>
                        <UserDirectory user={user} />
                    </RoleGuard>
                );

            case 'users':
                return (
                    <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                        <UserManager onPendingCountChange={setPendingUserCount} />
                    </RoleGuard>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-slate-50 font-sans dark:bg-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
                <div className="mx-auto flex h-16 max-w-full items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="lg:hidden"
                        >
                            {isSidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                        </Button>
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-xs font-bold tracking-wider text-white dark:bg-emerald-600">AGH</div>
                        <div className="min-w-0">
                            <h1 className="truncate text-xs font-bold uppercase tracking-tight text-slate-900 dark:text-white">{t('dashboard.dashboard')}</h1>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                <span className="truncate">{t('dashboard.welcome')}, {user.name}</span>
                                <Badge variant="secondary" className="hidden text-[9px] sm:inline-flex">{t(`userManager.roles.${user.role}`)}</Badge>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2">
                        <SystemClock lang={i18n.language} />
                        <Button variant="ghost" size="sm" onClick={() => i18n.changeLanguage(i18n.language === 'PL' ? 'EN' : 'PL')}>
                            {i18n.language === 'PL' ? 'EN' : 'PL'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setIsDarkMode(!isDarkMode)} aria-label={isDarkMode ? 'Tryb jasny' : 'Tryb ciemny'}>
                            {isDarkMode ? <Sun className="size-5" /> : <Moon className="size-5" />}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={onLogout}>
                            <LogOut className="size-4 mr-1" />
                            <span className="hidden sm:inline">{t('dashboard.logout')}</span>
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <aside
                    className={`fixed left-0 top-16 z-30 h-[calc(100vh-64px)] border-r border-slate-200 bg-white/95 backdrop-blur transition-all duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-950/95 lg:relative lg:top-0 lg:z-0 lg:translate-x-0 ${
                        isSidebarOpen ? 'w-64 translate-x-0' : 'w-16 -translate-x-full lg:translate-x-0'
                    }`}
                >
                    <nav className="flex flex-col gap-1 overflow-y-auto px-2 py-2">
                        {menuItems.map((item) => {
                            const requiresPermission = item.requiresPermission ? hasPermission(user, item.requiresPermission) : true;
                            
                            if (!requiresPermission) return null;

                            const isActive = activeSection === item.id;
                            const pendingBadge = item.id === 'users' && pendingUserCount > 0;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setActiveSection(item.id);
                                    }}
                                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                                        isActive
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                                    } ${!isSidebarOpen && 'lg:justify-center'}`}
                                    title={!isSidebarOpen ? item.label : undefined}
                                >
                                    <span className="shrink-0">{item.icon}</span>
                                    {isSidebarOpen && (
                                        <>
                                            <span className="flex-1 text-left">{item.label}</span>
                                            {pendingBadge && (
                                                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                                                    {pendingUserCount}
                                                </Badge>
                                            )}
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Main content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                        {(activeSection === 'inventory' || activeSection === 'dashboard') && !canViewList ? (
                            <Alert variant="destructive" className="m-auto max-w-md">
                                <AlertTriangle />
                                <AlertTitle>{t('dashboard.accessDeniedTitle')}</AlertTitle>
                                <AlertDescription>{t('dashboard.accessDeniedDesc')}</AlertDescription>
                            </Alert>
                        ) : (
                            renderContent()
                        )}
                    </div>
                </main>
            </div>

            <AddAssetModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={refreshItems}
                user={user}
            />
            <ItemDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                item={selectedItem}
                user={user}
                onUpdateStatus={handleUpdateItemStatus}
                onLocationChanged={handleItemLocationChanged}
            />
            <QrScannerDialog
                isOpen={isQrScannerOpen}
                onClose={() => setIsQrScannerOpen(false)}
                onScan={handleQrScan}
            />
        </div>
    );
}