import { useEffect, useState } from 'react';
import {
    AlertTriangle,
    Box,
    Download,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AppUser, InventoryItem } from '@/types';
import RoleGuard from '../auth/RoleGuard';
import { PERMISSIONS, hasPermission } from '../auth/permissions';
import UserManager from '../users/UserManager';
import AddAssetModal from './AddAssetModal';
import CategoryManager from './CategoryManager';
import ItemDetailsModal from './ItemDetailsModal';

const INITIAL_ITEMS: InventoryItem[] = [
    { id: 'AGH-WFIIS-0042', name: 'Oscyloskop cyfrowy InfiniiVision', producer: 'Keysight', model: 'DSOX2002A', serialNumber: 'MY54321098', status: 'dostępny', category: 'Oscyloskopy', location: 'Budynek D10 / Pokój 204 / Szafa A', owner: 'dr inż. Jan Kowalski', description: 'Dwukanałowy oscyloskop cyfrowy przeznaczony do pomiarów sygnałów analogowych i cyfrowych.' },
    { id: 'AGH-WFIIS-0113', name: 'Generator funkcji arbitralnych', producer: 'Tektronix', model: 'AFG1022', serialNumber: 'TEK7654321', status: 'wypożyczony', category: 'Generatory funkcyjne', location: 'Budynek D11 / Pokój 105 / Szafa B', owner: 'prof. dr hab. Andrzej Nowak', borrower: 'Jakub Wiśniewski', dueDate: '2026-06-01', description: 'Generator sygnałów arbitralnych. Dokumentacja producenta: https://en.wikipedia.org/wiki/Function_generator' },
    { id: 'AGH-WFIIS-0391', name: 'Zasilacz laboratoryjny programowalny', producer: 'Rigol', model: 'DP832', serialNumber: 'DP8B123456', status: 'oczekuje akceptacji', category: 'Zasilacze laboratoryjne', location: 'Budynek D10 / Pokój 204 / Szafa C', owner: 'dr inż. Jan Kowalski', borrower: 'Anna Malik', description: 'Trzykanałowy zasilacz laboratoryjny wykorzystywany w laboratoriach elektroniki, automatyki i systemów wbudowanych.' },
];

const CATEGORIES = ['Aparatura pomiarowa', 'Oscyloskopy', 'Generatory funkcyjne', 'Aparatura zasilająca', 'Zasilacze laboratoryjne', 'Sprzęt IT', 'Laptopy', 'Akcesoria i optyka'];
const STATUSES = ['dostępny', 'wypożyczony', 'oczekuje akceptacji', 'uszkodzony', 'zarezerwowany'];

type DashboardPageProps = {
    user: AppUser;
    onLogout: () => void;
    isDarkMode: boolean;
    setIsDarkMode: (enabled: boolean) => void;
};

export default function DashboardPage({ user, onLogout, isDarkMode, setIsDarkMode }: DashboardPageProps) {
    const { t, i18n } = useTranslation();
    const [items, setItems] = useState<InventoryItem[]>(INITIAL_ITEMS);
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
    const filteredItems = canViewList
        ? items.filter((item) => {
            const query = searchQuery.toLowerCase();
            const matchesSearch = [item.name, item.producer, String(item.id), item.serialNumber]
                .some((value) => value?.toLowerCase().includes(query));
            return matchesSearch
                && (statusFilter === 'all' || item.status === statusFilter)
                && (categoryFilter === 'all' || item.category === categoryFilter);
        })
        : [];

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
                                <TabsTrigger value="categories">{t('dashboard.tabCategories')}</TabsTrigger>
                            </RoleGuard>
                        </TabsList>

                        <TabsContent value="inventory" className="space-y-5">
                            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                                <StatCard title={t('dashboard.totalAssets')} value={items.length + 1245} icon={Box} />
                                <StatCard title={t('dashboard.borrowedAssets')} value="142" icon={PackageCheck} className="text-blue-600 dark:text-blue-400" />
                                <StatCard title={t('dashboard.pendingApprovals')} value="7" icon={Users} className="text-amber-600 dark:text-amber-400" />
                                <StatCard title={t('dashboard.damagedAssets')} value="3" icon={AlertTriangle} className="text-rose-600 dark:text-rose-400" />
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
                                                <Button variant="secondary" size="sm"><Download />{t('dashboard.exportXlsx')}</Button>
                                            </RoleGuard>
                                            <RoleGuard user={user} requiredPermission={PERMISSIONS.ITEM_CREATE}>
                                                <Button size="sm" onClick={() => setIsAddModalOpen(true)}><Plus />{t('dashboard.addAsset')}</Button>
                                            </RoleGuard>
                                        </div>
                                    </div>
                                    <div className="grid gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-2">
                                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                                            <SelectTrigger><SelectValue placeholder={t('dashboard.filterStatus')} /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">{t('dashboard.all')}</SelectItem>
                                                {STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                            <SelectTrigger><SelectValue placeholder={t('dashboard.filterCategory')} /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">{t('dashboard.all')}</SelectItem>
                                                {CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
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
                                        {filteredItems.length > 0 ? filteredItems.map((item) => (
                                            <TableRow key={item.id} className="cursor-pointer" onClick={() => { setSelectedItem(item); setIsDetailsModalOpen(true); }}>
                                                <TableCell className="font-mono text-xs text-slate-400">{item.id}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                                                    <div className="text-[10px] text-slate-400">{item.producer} / {item.model}</div>
                                                </TableCell>
                                                <TableCell className="text-slate-600 dark:text-slate-400">{item.category}</TableCell>
                                                <TableCell className="max-w-[220px] whitespace-normal text-slate-600 dark:text-slate-400">{item.location}</TableCell>
                                                <TableCell>
                                                    <StatusBadge status={item.status} />
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
                    </Tabs>
                )}
            </main>

            <AddAssetModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSave={(asset: InventoryItem) => setItems((current) => [asset, ...current])} user={user} />
            <ItemDetailsModal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} item={selectedItem} user={user} onUpdateStatus={handleUpdateItemStatus} />
        </div>
    );
}
