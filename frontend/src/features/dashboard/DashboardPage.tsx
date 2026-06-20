import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/StatusBadge';
import QrScannerDialog from '@/components/QrScannerDialog';
import type { AppUser, InventoryItem } from '@/types';
import RoleGuard from '../auth/RoleGuard';
import { PERMISSIONS, hasPermission } from '../auth/permissions';
import { useCategories } from '../categories/useCategories';
import { ITEM_STATUSES, useInventory } from '../inventory/useInventory';
import UserManager from '../users/UserManager';
import AddAssetModal from './AddAssetModal';
import CategoryManager from './CategoryManager';
import ItemDetailsModal from './ItemDetailsModal';

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

    const [items, setItems] = useState<InventoryItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('inventory');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
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

    const getStatusLabel = (status: string) => t(`dashboard.itemStatuses.${status}`, { defaultValue: status });

    const handleQrScan = (decodedText: string) => {
        setIsQrScannerOpen(false);
        setSearchQuery(decodedText);
    };

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
        <div className="flex min-h-screen flex-col bg-slate-50 font-sans transition-colors duration-300 dark:bg-slate-900">
            <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-0 lg:px-8">
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-[10px] font-bold tracking-wider text-white dark:bg-emerald-600 sm:text-xs">AGH</div>
                        <div className="min-w-0">
                            <h1 className="text-[11px] font-bold uppercase leading-tight tracking-tight text-slate-900 dark:text-white sm:text-xs">{t('dashboard.dashboard')}</h1>
                            <p className="mt-0.5 truncate text-[9px] text-slate-500 dark:text-slate-400 sm:text-[10px]">
                                {t('dashboard.welcome')}, <span className="font-semibold text-slate-700 dark:text-slate-200">{user.name}</span>
                                {' '}(<span className="font-mono rounded bg-slate-100 px-1 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">{user.role}</span>)
                            </p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 sm:gap-2 sm:border-l sm:border-slate-200 sm:pl-3 dark:sm:border-slate-800">
                        <button
                            onClick={() => i18n.changeLanguage(i18n.language === 'PL' ? 'EN' : 'PL')}
                            className="rounded px-1.5 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 sm:px-2 sm:text-xs"
                        >
                            {i18n.language === 'PL' ? 'EN' : 'PL'}
                        </button>
                        <button
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                            aria-label={isDarkMode ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'}
                        >
                            {isDarkMode ? (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.243 17.657l.707.707M7.757 6.364l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
                            ) : (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                            )}
                        </button>
                        <button
                            onClick={onLogout}
                            className="flex items-center justify-center rounded-lg bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/60 sm:px-2.5 sm:py-1.5 sm:text-xs sm:font-medium"
                            aria-label={t('dashboard.logout')}
                        >
                            <svg className="h-3.5 w-3.5 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span className="hidden sm:inline">{t('dashboard.logout')}</span>
                        </button>
                    </div>
                </div>

                {canViewList && (
                    <div className="mx-auto max-w-7xl overflow-x-auto border-t border-slate-100 px-3 dark:border-slate-800/50 sm:px-6 lg:px-8">
                        <div className="flex min-w-max gap-4 sm:gap-6">
                            <button
                                onClick={() => setActiveTab('inventory')}
                                className={`whitespace-nowrap border-b-2 py-3 text-xs font-semibold transition-colors ${activeTab === 'inventory' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                {t('dashboard.tabInventory')}
                            </button>
                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                                <button
                                    onClick={() => setActiveTab('users')}
                                    className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 py-3 text-xs font-semibold transition-colors ${activeTab === 'users' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    {t('dashboard.tabUsers')}
                                    {pendingUserCount > 0 && (
                                        <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{pendingUserCount}</span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('categories')}
                                    className={`whitespace-nowrap border-b-2 py-3 text-xs font-semibold transition-colors ${activeTab === 'categories' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    {t('dashboard.tabCategories')}
                                </button>
                            </RoleGuard>
                        </div>
                    </div>
                )}
            </nav>

            <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
                {!canViewList ? (
                    <div className="mx-auto my-auto max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-xl font-bold text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">✕</div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('dashboard.accessDeniedTitle')}</h3>
                        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('dashboard.accessDeniedDesc')}</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {activeTab === 'inventory' && (
                            <>
                                {error && (
                                    <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400">
                                        <span>{error}</span>
                                        <button type="button" onClick={() => clearError()} className="text-rose-500 hover:text-rose-700">✕</button>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                                    {([
                                        { title: t('dashboard.totalAssets'), count: stats.total, color: 'text-slate-900 dark:text-white' },
                                        { title: t('dashboard.borrowedAssets'), count: stats.borrowed, color: 'text-blue-600 dark:text-blue-400' },
                                        { title: t('dashboard.pendingApprovals'), count: stats.pending, color: 'text-amber-600 dark:text-amber-400' },
                                        { title: t('dashboard.damagedAssets'), count: stats.damaged, color: 'text-rose-600 dark:text-rose-400' },
                                    ] as const).map((stat) => (
                                        <div key={stat.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-950">
                                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{stat.title}</div>
                                            <div className={`mt-1 text-xl font-bold ${stat.color}`}>{stat.count}</div>
                                        </div>
                                    ))}
                                </div>

                                <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                                    <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
                                        <div className="relative w-full max-w-md">
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                            </span>
                                            <input
                                                type="text"
                                                placeholder={t('dashboard.searchPlaceholder')}
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-4 text-xs text-slate-800 transition focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                            />
                                        </div>
                                        <div className="flex w-full flex-wrap items-center justify-center gap-2 md:w-auto md:justify-end">
                                            <button
                                                type="button"
                                                onClick={() => setIsQrScannerOpen(true)}
                                                className="flex min-w-[7.5rem] flex-1 items-center justify-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:flex-none sm:py-1.5"
                                            >
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3M16 3h3a2 2 0 012 2v3M21 16v3a2 2 0 01-2 2h-3M8 21H5a2 2 0 01-2-2v-3M7 8h3v3H7V8zm7 0h3v3h-3V8zM7 14h3v3H7v-3zm7 0h1m2 0v3h-3v-1" />
                                                </svg>
                                                <span>{t('qrScanner.button')}</span>
                                            </button>
                                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_EXPORT}>
                                                <button className="flex min-w-[7.5rem] flex-1 items-center justify-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:flex-none sm:py-1.5">
                                                    <span>⬇</span><span>{t('dashboard.exportXlsx')}</span>
                                                </button>
                                            </RoleGuard>
                                            <RoleGuard user={user} requiredPermission={PERMISSIONS.ITEM_CREATE}>
                                                <button
                                                    onClick={() => setIsAddModalOpen(true)}
                                                    className="flex min-w-[7.5rem] flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:flex-none sm:py-1.5"
                                                >
                                                    <span>+</span><span>{t('dashboard.addAsset')}</span>
                                                </button>
                                            </RoleGuard>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-900 sm:flex-row sm:flex-wrap">
                                        <div className="flex w-full items-center gap-2 sm:w-auto">
                                            <span className="shrink-0 font-medium text-slate-400">{t('dashboard.filterStatus')}:</span>
                                            <select
                                                value={statusFilter}
                                                onChange={(e) => setStatusFilter(e.target.value)}
                                                className="min-w-0 flex-1 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:flex-none"
                                            >
                                                <option value="all">{t('dashboard.all')}</option>
                                                {ITEM_STATUSES.map((status) => (
                                                    <option key={status} value={status}>{getStatusLabel(status)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex w-full items-center gap-2 sm:w-auto">
                                            <span className="shrink-0 font-medium text-slate-400">{t('dashboard.filterCategory')}:</span>
                                            <select
                                                value={categoryFilter}
                                                onChange={(e) => setCategoryFilter(e.target.value)}
                                                className="min-w-0 flex-1 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:flex-none"
                                            >
                                                <option value="all">{t('dashboard.all')}</option>
                                                {categories.map((category) => (
                                                    <option key={category.id} value={category.name}>{category.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </section>

                                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-slate-200 bg-slate-50/80 font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-900/40">
                                                    <th className="px-4 py-2.5">{t('dashboard.thId')}</th>
                                                    <th className="px-4 py-2.5">{t('dashboard.thName')}</th>
                                                    <th className="px-4 py-2.5">{t('dashboard.thCategory')}</th>
                                                    <th className="px-4 py-2.5">{t('dashboard.thLocation')}</th>
                                                    <th className="px-4 py-2.5">{t('dashboard.thStatus')}</th>
                                                    <th className="px-4 py-2.5">{t('dashboard.thOwner')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-900/60">
                                                {isLoading && filteredItems.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="py-8 text-center font-medium text-slate-400 dark:text-slate-500">
                                                            {t('userManager.loading')}
                                                        </td>
                                                    </tr>
                                                ) : filteredItems.length > 0 ? filteredItems.map((item) => (
                                                    <tr
                                                        key={item.id}
                                                        onClick={() => { setSelectedItem(item); setIsDetailsModalOpen(true); }}
                                                        className="cursor-pointer transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                                                    >
                                                        <td className="px-4 py-3 font-mono text-slate-400 dark:text-slate-500">{item.inventory_number ?? item.id}</td>
                                                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                                            <div>{item.name}</div>
                                                            {item.description && (
                                                                <div className="line-clamp-1 text-[10px] font-normal text-slate-400">{item.description}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.category}</td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.location}</td>
                                                        <td className="px-4 py-3">
                                                            <StatusBadge status={item.status} label={getStatusLabel(item.status)} />
                                                            {item.borrower && <div className="mt-0.5 text-[9px] text-slate-400 dark:text-slate-500">{item.borrower} ({item.dueDate})</div>}
                                                        </td>
                                                        <td className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">{item.owner}</td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan={6} className="py-8 text-center font-medium text-slate-400 dark:text-slate-500">{t('dashboard.noResults')}</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTab === 'users' && (
                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                                <UserManager onPendingCountChange={setPendingUserCount} />
                            </RoleGuard>
                        )}

                        {activeTab === 'categories' && (
                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                                <CategoryManager />
                            </RoleGuard>
                        )}
                    </div>
                )}
            </main>

            <AddAssetModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={() => refreshItems()}
                user={user}
            />
            <QrScannerDialog
                isOpen={isQrScannerOpen}
                onClose={() => setIsQrScannerOpen(false)}
                onScan={handleQrScan}
            />
            <ItemDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                item={selectedItem}
                user={user}
                onUpdateStatus={handleUpdateItemStatus}
            />
        </div>
    );
}
