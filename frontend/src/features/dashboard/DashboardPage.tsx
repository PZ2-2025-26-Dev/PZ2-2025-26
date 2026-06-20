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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AppUser, InventoryItem } from '@/types';
import RoleGuard from '../auth/RoleGuard';
import { PERMISSIONS, hasPermission } from '../auth/permissions';
import { useCategories } from '../categories/useCategories';
import { ITEM_STATUSES, useInventory } from '../inventory/useInventory';
import UserManager from '../users/UserManager';
import LocationManager from '../locations/LocationManager';
import AddAssetModal from './AddAssetModal';
import CategoryManager from './CategoryManager';
import ItemDetailsModal from './ItemDetailsModal';
import { useExport } from '@/features/exports/useExport';

type CategoryOption = { id: number; name: string };

type DashboardPageProps = {
    user: AppUser;
    onLogout: () => void;
    isDarkMode: boolean;
    setIsDarkMode: (enabled: boolean) => void;
};


export default function DashboardPage({ user, onLogout, isDarkMode, setIsDarkMode }: DashboardPageProps) {
    const { t, i18n } = useTranslation();
    const { listItems, isLoading, error, clearError } = useInventory();
    const { listCategories } = useCategories();
    const { exportItemsXlsx } = useExport();

    const [items, setItems] = useState<InventoryItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('inventory');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [pendingUserCount, setPendingUserCount] = useState(0);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    const canViewList = hasPermission(user, PERMISSIONS.ITEM_LIST);

    const refreshItems = useCallback(async () => {
        const result = await listItems({ limit: 50 });
        if (result.success) {
            setItems(result.items);
            setTotalCount(result.total);
        }
    }, [listItems]);

    const refreshCategories = useCallback(async () => {
        const result = await listCategories({ limit: 100 });
        if (result.success) {
            setCategories(result.categories);
        }
    }, [listCategories]);

    useEffect(() => {
        if (!canViewList) return;
        refreshItems();
        refreshCategories();
    }, [canViewList, refreshItems, refreshCategories]);

    const filteredItems = useMemo(() => {
        if (!canViewList) return [];

        return items.filter((item) => {
            const query = searchQuery.toLowerCase();
            const matchesSearch = !query || [
                item.name,
                String(item.id),
                item.inventory_number,
                item.description,
                item.category,
                item.location,
                item.owner,
            ].some((value) => value?.toLowerCase().includes(query));
            const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
            const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
            return matchesSearch && matchesStatus && matchesCategory;
        });
    }, [canViewList, items, searchQuery, statusFilter, categoryFilter]);

    const stats = useMemo(() => ({
        total: totalCount,
        borrowed: items.filter((item) => item.status === 'loaned').length,
        pending: items.filter((item) => item.status === 'pending_approval').length,
        damaged: items.filter((item) => item.status === 'broken').length,
    }), [items, totalCount]);

    const handleUpdateItemStatus = (
        itemId: string | number,
        newStatus: string,
        clearBorrower = false,
        newBorrower: string | null = null,
        newDueDate: string | null = null,
    ) => {
        setItems((current) => current.map((item) => item.id === itemId ? {
            ...item,
            status: newStatus,
            borrower: newBorrower ?? (clearBorrower ? null : item.borrower),
            dueDate: newDueDate ?? (clearBorrower ? null : item.dueDate),
        } : item));
        setIsDetailsModalOpen(false);
    };

    const getStatusLabel = (status: string) => t(`dashboard.itemStatuses.${status}`, { defaultValue: status });

    const handleExportXlsx = useCallback(async () => {
        await exportItemsXlsx({
            search: searchQuery,
            status: statusFilter,
            category: categoryFilter,
        });
    }, [exportItemsXlsx, searchQuery, statusFilter, categoryFilter]);

    return (
        <div className="flex min-h-screen flex-col bg-slate-50 font-sans dark:bg-slate-900">
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-xs font-bold tracking-wider text-white dark:bg-emerald-600">AGH</div>
                        <div className="min-w-0">
                            <h1 className="truncate text-xs font-bold uppercase tracking-tight text-slate-900 dark:text-white">{t('dashboard.dashboard')}</h1>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                <span className="truncate">{t('dashboard.welcome')}, {user.name}</span>
                                <Badge variant="secondary" className="hidden text-[9px] sm:inline-flex">{user.role}</Badge>
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

            <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
                {!canViewList ? (
                    <Alert variant="destructive" className="m-auto max-w-md">
                        <AlertTriangle />
                        <AlertTitle>{t('dashboard.accessDeniedTitle')}</AlertTitle>
                        <AlertDescription>{t('dashboard.accessDeniedDesc')}</AlertDescription>
                    </Alert>
                ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="inventory"><Box />{t('dashboard.tabInventory')}</TabsTrigger>
                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                                <TabsTrigger value="users">
                                    <Users />{t('dashboard.tabUsers')}
                                    {pendingUserCount > 0 && <Badge variant="destructive" className="h-4 px-1.5 text-[9px]">{pendingUserCount}</Badge>}
                                </TabsTrigger>
                                <TabsTrigger value="locations"><MapPinned />{t('dashboard.tabLocations')}</TabsTrigger>
                                <TabsTrigger value="categories">{t('dashboard.tabCategories')}</TabsTrigger>
                            </RoleGuard>
                        </TabsList>

                        <TabsContent value="inventory" className="space-y-5">
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

                            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                                <StatCard title={t('dashboard.totalAssets')} value={stats.total} icon={Box} />
                                <StatCard title={t('dashboard.borrowedAssets')} value={stats.borrowed} icon={PackageCheck} className="text-blue-600 dark:text-blue-400" />
                                <StatCard title={t('dashboard.pendingApprovals')} value={stats.pending} icon={Users} className="text-amber-600 dark:text-amber-400" />
                                <StatCard title={t('dashboard.damagedAssets')} value={stats.damaged} icon={AlertTriangle} className="text-rose-600 dark:text-rose-400" />
                            </div>

                            <Card>
                                <CardContent className="space-y-4 p-4">
                                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                                        <div className="relative max-w-md flex-1">
                                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                                            <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t('dashboard.searchPlaceholder')} className="pl-9" />
                                        </div>
                                        <div className="flex gap-2">
                                           <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_EXPORT}>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={handleExportXlsx}
                                                >
                                                    <Download />
                                                    {t('dashboard.exportXlsx')}
                                                </Button>
                                            </RoleGuard>
                                            <RoleGuard user={user} requiredPermission={PERMISSIONS.ITEM_CREATE}>
                                                <Button size="sm" onClick={() => setIsAddModalOpen(true)}><Plus />{t('dashboard.addAsset')}</Button>
                                            </RoleGuard>
                                        </div>
                                    </div>
                                    <div className="grid gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="status-filter">{t('dashboard.filterStatus')}</Label>
                                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                                <SelectTrigger id="status-filter"><SelectValue placeholder={t('dashboard.all')} /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">{t('dashboard.all')}</SelectItem>
                                                    {ITEM_STATUSES.map((status) => (
                                                        <SelectItem key={status} value={status}>{getStatusLabel(status)}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="category-filter">{t('dashboard.filterCategory')}</Label>
                                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                                <SelectTrigger id="category-filter"><SelectValue placeholder={t('dashboard.all')} /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">{t('dashboard.all')}</SelectItem>
                                                    {categories.map((category) => (
                                                        <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50/80 dark:bg-slate-900/50">
                                            <TableHead>{t('dashboard.thId')}</TableHead>
                                            <TableHead>{t('dashboard.thName')}</TableHead>
                                            <TableHead>{t('dashboard.thCategory')}</TableHead>
                                            <TableHead>{t('dashboard.thLocation')}</TableHead>
                                            <TableHead>{t('dashboard.thStatus')}</TableHead>
                                            <TableHead>{t('dashboard.thOwner')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading && filteredItems.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="py-10 text-center text-slate-400">
                                                    {t('userManager.loading')}
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredItems.length > 0 ? filteredItems.map((item) => (
                                            <TableRow key={item.id} className="cursor-pointer" onClick={() => { setSelectedItem(item); setIsDetailsModalOpen(true); }}>
                                                <TableCell className="font-mono text-xs text-slate-400">{item.inventory_number ?? item.id}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                                                    {item.description && (
                                                        <div className="line-clamp-1 text-[10px] text-slate-400">{item.description}</div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-slate-600 dark:text-slate-400">{item.category}</TableCell>
                                                <TableCell className="max-w-[220px] whitespace-normal text-slate-600 dark:text-slate-400">{item.location}</TableCell>
                                                <TableCell>
                                                    <StatusBadge status={item.status} label={getStatusLabel(item.status)} />
                                                    {item.borrower && <div className="mt-1 text-[9px] text-slate-400">{item.borrower} ({item.dueDate})</div>}
                                                </TableCell>
                                                <TableCell className="text-slate-600 dark:text-slate-400">{item.owner}</TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow><TableCell colSpan={6} className="py-10 text-center text-slate-400">{t('dashboard.noResults')}</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>

                        <TabsContent value="users">
                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                                <UserManager onPendingCountChange={setPendingUserCount} />
                            </RoleGuard>
                        </TabsContent>
                        <TabsContent value="categories">
                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                                <CategoryManager />
                            </RoleGuard>
                        </TabsContent>
                        <TabsContent value="locations">
                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                                <LocationManager />
                            </RoleGuard>
                        </TabsContent>
                    </Tabs>
                )}
            </main>

            <AddAssetModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={() => refreshItems()}
                user={user}
            />
            <ItemDetailsModal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} item={selectedItem} user={user} onUpdateStatus={handleUpdateItemStatus} />
        </div>
    );
}
