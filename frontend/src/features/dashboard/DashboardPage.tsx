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
import QrScannerDialog from '@/components/QrScannerDialog';
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
import InventoryToolbar from '../inventory/InventoryToolbar';
import BatchLabelExportDialog, {
    type BatchLabelFormat,
    type BatchLabelOptions,
} from '../inventory/BatchLabelExportDialog';
import { InventoryFiltersState } from '../inventory/InventoryFilters';
import { useUsers } from '../users/useUsers';
import { useLocations } from '../locations/useLocations';

type CategoryOption = {
    id: number;
    name: string;
    parentId: number | null;
    path: string;
};

type MenuSection = 'dashboard' | 'inventory' | 'loans' | 'locations' | 'directory' | 'users';

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
    const {
        listItems,
        isLoading,
        getItem,
        lookupItemByQrCode,
        downloadBatchLabels,
        error,
        clearError,
    } = useInventory();
    const { listCategories } = useCategories();
    const { exportItemsXlsx, isLoading: isExporting, error: exportError, clearError: clearExportError } = useExport();

    const [items, setItems] = useState<InventoryItem[]>([]);
    const [total, setTotal] = useState(0);

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
        sort: 'name:asc',
        page: 1,
        limit: 15,
        custom_params: undefined
    });

    const [activeSection, setActiveSection] = useState<MenuSection>(() => {
        const storedSection = localStorage.getItem(DASHBOARD_ACTIVE_SECTION_KEY);
        return isMenuSection(storedSection) ? storedSection : 'dashboard';
    });
    
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isBatchLabelDialogOpen, setIsBatchLabelDialogOpen] = useState(false);
    const [selectedLabelItems, setSelectedLabelItems] = useState<Map<string, InventoryItem>>(() => new Map());
    const [labelSelectionError, setLabelSelectionError] = useState<string | null>(null);
    const [pendingUserCount, setPendingUserCount] = useState(0);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
    const selectedLabelItemsList = useMemo(
        () => [...selectedLabelItems.values()],
        [selectedLabelItems],
    );
    const selectionScope = useMemo(() => JSON.stringify({
        ...filters,
        page: undefined,
    }), [filters]);
    const canSelectItemForLabel = useCallback((item: InventoryItem) => (
        canManageSystem || item.ownerId === Number(user.id)
    ), [canManageSystem, user.id]);
    const selectablePageItems = useMemo(
        () => items.filter(canSelectItemForLabel),
        [canSelectItemForLabel, items],
    );
    const allSelectablePageItemsAreSelected = (
        selectablePageItems.length > 0
        && selectablePageItems.every((item) => selectedLabelItems.has(item.id))
    );

    useEffect(() => {
        setSelectedLabelItems(new Map());
        setLabelSelectionError(null);
    }, [selectionScope]);

    type SortCriteria = {
        field: SortField;
        order: 'asc' | 'desc';
    };

    const [sortCriteria, setSortCriteria] = useState<SortCriteria[]>([
        { field: 'name', order: 'asc' }
    ]);

    useEffect(() => {
        localStorage.setItem(DASHBOARD_ACTIVE_SECTION_KEY, activeSection);
    }, [activeSection]);

    useEffect(() => {
        if (activeSection === 'users' && !canManageSystem) {
            setActiveSection('dashboard');
        }
    }, [activeSection, canManageSystem]);

    const refreshItems = useCallback(async () => {
        const result = await listItems({ ...filters, limit: filters.limit || 15 });
        if (result.success) {
            setItems(result.items);
            setTotal(result.total);
        }
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
        const result = await listUsers({ status: 'active', limit: 100 }, { browse: true });
        if (result.success) {
            setUsers(
                result.users.map((u: { id: number; firstName?: string | null; lastName?: string | null }) => ({
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
    }, [canViewList, refreshItems, refreshCategories, refreshUsers, refreshLocations]);

    const handleSort = (field: SortField, event: React.MouseEvent) => {
        setSortCriteria(prev => {
            const isShiftPressed = event.shiftKey;
            const existingIndex = prev.findIndex(c => c.field === field);

            if (isShiftPressed) {
                if (existingIndex > -1) {
                    const currentOrder = prev[existingIndex].order;
                    const nextOrder = currentOrder === 'asc' ? 'desc' : 'asc';
                    const updated = [...prev];
                    updated[existingIndex] = { field, order: nextOrder };
                    return updated;
                } else {
                    return [...prev, { field, order: 'asc' }];
                }
            } else {
                if (prev.length === 1 && prev[0].field === field) {
                    return [{ field, order: prev[0].order === 'asc' ? 'desc' : 'asc' }];
                }
                return [{ field, order: 'asc' }];
            }
        });
    };

    useEffect(() => {
        const sortString = sortCriteria
            .map(c => `${c.field}:${c.order}`)
            .join(',');

        setFilters(prev => ({
            ...prev,
            sort: sortString, 
            page: 1, 
        }));
    }, [sortCriteria]);

    const renderSortIcon = (field: SortField) => {
        const index = sortCriteria.findIndex(c => c.field === field);
        if (index === -1) return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-40" />;
        
        const criteria = sortCriteria[index];
        const icon = criteria.order === "asc" 
            ? <ArrowUp className="ml-2 h-4 w-4 inline text-primary" />
            : <ArrowDown className="ml-2 h-4 w-4 inline text-primary" />;

        return (
            <div className="inline-flex items-center">
                {icon}
                {sortCriteria.length > 1 && (
                    <span className="text-[9px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1 rounded ml-0.5 font-bold">
                        {index + 1}
                    </span>
                )}
            </div>
        );
    };

    const stats = useMemo(() => ({
        total: total,
        borrowed: items.filter((item) => item.status === 'loaned').length,
        pending: items.filter((item) => item.status === 'pending_approval').length,
        damaged: items.filter((item) => item.status === 'broken').length,
    }), [items, total]);

    const handleUpdateItemStatus = () => {
        refreshItems();
    };

    const handleQrScan = async (decodedText: string) => {
        setIsQrScannerOpen(false);
        const result = await lookupItemByQrCode(decodedText);
        if (result.success && result.item) {
            setSelectedItem(result.item);
            setIsDetailsModalOpen(true);
            return;
        }
        setFilters(prev => ({ ...prev, search: decodedText, page: 1 }));
    };

    const openItemDetails = async (item: InventoryItem) => {
        const result = await getItem(item.id);
        setSelectedItem(result.success && result.item ? result.item : item);
        setIsDetailsModalOpen(true);
    };

    const handleExportXlsx = useCallback(async () => {
        clearExportError();
        await exportItemsXlsx({
            ...filters,
            search: filters.search || searchQuery,
        });
    }, [clearExportError, exportItemsXlsx, filters, searchQuery]);

    const toggleItemForLabel = (item: InventoryItem) => {
        if (!canSelectItemForLabel(item)) return;

        const next = new Map(selectedLabelItems);
        if (next.has(item.id)) {
            next.delete(item.id);
            setLabelSelectionError(null);
            setSelectedLabelItems(next);
            return;
        }

        if (next.size >= 100) {
            setLabelSelectionError(t('batchLabels.limitError'));
            return;
        }

        next.set(item.id, item);
        setLabelSelectionError(null);
        setSelectedLabelItems(next);
    };

    const toggleSelectablePageItems = () => {
        const next = new Map(selectedLabelItems);

        if (allSelectablePageItemsAreSelected) {
            selectablePageItems.forEach((item) => next.delete(item.id));
            setLabelSelectionError(null);
            setSelectedLabelItems(next);
            return;
        }

        for (const item of selectablePageItems) {
            if (next.has(item.id)) continue;
            if (next.size >= 100) {
                setLabelSelectionError(t('batchLabels.limitError'));
                setSelectedLabelItems(next);
                return;
            }
            next.set(item.id, item);
        }

        setLabelSelectionError(null);
        setSelectedLabelItems(next);
    };

    const handleBatchLabelExport = async (
        itemIds: string[],
        format: BatchLabelFormat,
        options: BatchLabelOptions,
    ) => downloadBatchLabels(itemIds, format, options);

    const clearLabelSelection = () => {
        setSelectedLabelItems(new Map());
        setLabelSelectionError(null);
    };

    const handleItemUpdated = (updatedItem: InventoryItem) => {
        setItems((current) => current.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
        setSelectedItem(updatedItem);
        setSelectedLabelItems((current) => {
            if (!current.has(updatedItem.id)) return current;
            const next = new Map(current);
            next.set(updatedItem.id, updatedItem);
            return next;
        });
    };

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

    const menuItems: Array<{ id: MenuSection; label: string; icon: React.ReactNode; requiresPermission?: string }> = [
        { id: 'dashboard', label: t('dashboard.mainPanel'), icon: <LayoutDashboard className="size-5" /> },
        { id: 'inventory', label: t('dashboard.tabInventory'), icon: <Box className="size-5" /> },
        { id: 'loans', label: t('dashboard.loans'), icon: <ClipboardList className="size-5" /> },
        { id: 'locations', label: t('dashboard.locationsAndCategories'), icon: <MapPinned className="size-5" /> },
        { id: 'directory', label: t('dashboard.tabDirectory'), icon: <UserPlus className="size-5" />, requiresPermission: PERMISSIONS.ITEM_CREATE },
        { id: 'users', label: t('dashboard.tabUsers'), icon: <Users className="size-5" />, requiresPermission: PERMISSIONS.SYSTEM_MANAGE },
    ];

    const renderContent = () => {
        switch (activeSection) {
            case 'dashboard':
                return (
                    <div className="space-y-5">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.mainPanel')}</h2>
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                            <StatCard title={t('dashboard.totalAssets')} value={stats.total} icon={Box} />
                            <StatCard title={t('dashboard.borrowedAssets')} value={stats.borrowed} icon={PackageCheck} className="text-blue-600 dark:text-blue-400" />
                            <StatCard title={t('dashboard.pendingApprovals')} value={stats.pending} icon={Users} className="text-amber-600 dark:text-amber-400" />
                            <StatCard title={t('dashboard.damagedAssets')} value={stats.damaged} icon={AlertTriangle} className="text-rose-600 dark:text-rose-400" />
                        </div>
                    </div>
                );
            
            case 'inventory':
                return (
                    <div className="space-y-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.tabInventory')}</h2>
                           
                        </div>

                        <div className="space-y-4">
                            {error && (
                                <Alert variant="destructive">
                                    <AlertTriangle />
                                    <AlertTitle>{t('auth.loginErrorTitle')}</AlertTitle>
                                    <AlertDescription className="flex items-center justify-between gap-3">
                                        <span>{error}</span>
                                        <Button variant="outline" size="sm" onClick={() => clearError()}>✕</Button>
                                    </AlertDescription>
                                </Alert>
                            )}

                            {exportError && (
                                <Alert variant="destructive">
                                    <AlertTriangle />
                                    <AlertTitle>{t('auth.loginErrorTitle')}</AlertTitle>
                                    <AlertDescription className="flex items-center justify-between gap-3">
                                        <span>{exportError}</span>
                                        <Button variant="outline" size="sm" onClick={() => clearExportError()}>✕</Button>
                                    </AlertDescription>
                                </Alert>
                            )}

                            <InventoryToolbar
                                user={user}
                                filters={filters}
                                onChange={setFilters}
                                categories={categories}
                                locations={locations}
                                users={users}
                                onAdd={() => setIsAddModalOpen(true)}
                                onExport={handleExportXlsx}
                                onBatchLabelExport={() => setIsBatchLabelDialogOpen(true)}
                                onQrScan={() => setIsQrScannerOpen(true)}
                                selectedCount={selectedLabelItems.size}
                                isLoading={isLoading || isExporting}
                            />

                            {labelSelectionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="size-4" />
                                    <AlertTitle>{t('batchLabels.selectionErrorTitle')}</AlertTitle>
                                    <AlertDescription>{labelSelectionError}</AlertDescription>
                                </Alert>
                            )}

                            <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                                <div className="overflow-x-auto">
                                    <Table className="min-w-full">
                                        <TableHeader>
                                            <TableRow className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/40">
                                                <TableHead className="w-12 px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={allSelectablePageItemsAreSelected}
                                                        onChange={toggleSelectablePageItems}
                                                        disabled={selectablePageItems.length === 0}
                                                        aria-label={t('batchLabels.selectPage')}
                                                        title={t('batchLabels.selectPage')}
                                                        className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                </TableHead>
                                                {columns.map((col) => (
                                                    <TableHead
                                                        key={String(col.field)}
                                                        className={`
                                                            whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300
                                                            ${col.sortable ? "cursor-pointer select-none hover:text-slate-900 dark:hover:text-white" : ""}
                                                        `}
                                                        onClick={(e) => col.sortable && col.field && handleSort(col.field, e)}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            {col.label}
                                                            {col.sortable && col.field && renderSortIcon(col.field)}
                                                        </div>
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoading && items.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="py-10 text-center text-slate-400">
                                                        {t('userManager.loading')}
                                                    </TableCell>
                                                </TableRow>
                                            ) : items.length > 0 ? items.map((item) => (
                                                <TableRow key={item.id} className="cursor-pointer group border-b border-slate-100 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-900/40 transition-colors duration-150" onClick={() => void openItemDetails(item) }>
                                                    <TableCell
                                                        className="w-12 px-4 py-3"
                                                        onClick={(event) => event.stopPropagation()}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedLabelItems.has(item.id)}
                                                            onChange={() => toggleItemForLabel(item)}
                                                            disabled={
                                                                !canSelectItemForLabel(item)
                                                                || (selectedLabelItems.size >= 100 && !selectedLabelItems.has(item.id))
                                                            }
                                                            aria-label={t('batchLabels.selectItem', { name: item.name })}
                                                            title={
                                                                canSelectItemForLabel(item)
                                                                    ? t('batchLabels.selectItem', { name: item.name })
                                                                    : t('batchLabels.notAllowed')
                                                            }
                                                            className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap w-[120px] max-w-[120px] overflow-hidden text-ellipsis">{item.oldID ?? item.id}</TableCell>
                                                    <TableCell className="px-4 py-3">
                                                        <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                                                        {item.description && (
                                                            <div className="line-clamp-1 text-[10px] text-slate-400">{item.description}</div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.category}</TableCell>
                                                    <TableCell className="px-4 py-3 max-w-[220px] whitespace-normal text-slate-600 dark:text-slate-400">{item.location}</TableCell>
                                                    <TableCell className="px-4 py-3">
                                                        <StatusBadge status={item.status} label={getStatusLabel(item.status)} />
                                                        {item.borrower && <div className="mt-1 text-[9px] text-slate-400">{item.borrower} ({item.dueDate})</div>}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.owner}</TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow><TableCell colSpan={7} className="py-10 text-center text-slate-400">{t('dashboard.noResults')}</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>

                            {/* Paginacja serwerowa */}
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
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div>
                            <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{t('dashboard.tabLocations')}</h3>
                            <LocationManager canManage={false} canCreateRemote={false} />
                        </div>
                        <div>
                            <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{t('dashboard.tabCategories')}</h3>
                            <CategoryManager canManage={false} />
                        </div>
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
                        <Button variant="ghost" size="icon-sm" onClick={() => setIsDarkMode(!isDarkMode)} aria-label={isDarkMode ? 'Tryb jasny' : 'Tryb ciemny'}>
                            {isDarkMode ? <Sun /> : <Moon />}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={onLogout}>
                            <LogOut />
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
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="w-full"
                            aria-label="Przełącz menu boczne"
                        >
                            <Menu className="size-5" />
                        </Button>
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
                onSave={() => refreshItems()}
                user={user}
            />
            <ItemDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                item={selectedItem}
                user={user}
                onUpdateStatus={handleUpdateItemStatus}
                onItemUpdated={handleItemUpdated}
                onLocationChanged={handleItemLocationChanged}
            />
            <BatchLabelExportDialog
                open={isBatchLabelDialogOpen}
                onOpenChange={setIsBatchLabelDialogOpen}
                items={selectedLabelItemsList}
                onExport={handleBatchLabelExport}
                onCompleted={clearLabelSelection}
            />
            <QrScannerDialog
                isOpen={isQrScannerOpen}
                onClose={() => setIsQrScannerOpen(false)}
                onScan={handleQrScan}
            />
        </div>
    );
}
