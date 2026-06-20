import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../../components/StatusBadge';
import SystemClock from '../../components/SystemClock';
import QrScannerDialog from '../../components/QrScannerDialog';
import RoleGuard from '../auth/RoleGuard';
import { PERMISSIONS, hasPermission } from '../auth/permissions';
import { useCategories } from '../categories/useCategories';
import { ITEM_STATUSES, useInventory } from '../inventory/useInventory';
import UserManager from '../users/UserManager';
import CategoryManager from './CategoryManager';
import AddAssetModal from './AddAssetModal';
import ItemDetailsModal from './ItemDetailsModal';

export default function DashboardPage({ user, onLogout, isDarkMode, setIsDarkMode }) {
    const { t, i18n } = useTranslation();
    const { listItems, isLoading, error, clearError } = useInventory();
    const { listCategories } = useCategories();

    const [items, setItems] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [categories, setCategories] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('inventory');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [pendingUserCount, setPendingUserCount] = useState(0);

    useEffect(() => {
        const root = window.document.documentElement;
        if (isDarkMode) root.classList.add('dark');
        else root.classList.remove('dark');
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

    const getStatusLabel = (status) => t(`dashboard.itemStatuses.${status}`, { defaultValue: status });

    const handleQrScan = (decodedText) => {
        console.log('QR code scan result:', decodedText);
    };

    const handleUpdateItemStatus = (itemId, newStatus, clearBorrower = false, newBorrower = null, newDueDate = null) => {
        setItems((prevItems) => prevItems.map((item) => {
            if (item.id === itemId) {
                return {
                    ...item,
                    status: newStatus,
                    borrower: newBorrower ?? (clearBorrower ? null : item.borrower),
                    dueDate: newDueDate ?? (clearBorrower ? null : item.dueDate),
                };
            }
            return item;
        }));
        setIsDetailsModalOpen(false);
    };

    const toggleLanguage = () => {
        i18n.changeLanguage(i18n.language === 'PL' ? 'EN' : 'PL');
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 flex flex-col font-sans">
            <nav className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-sm">
                <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-0 lg:px-8">
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-[10px] font-bold tracking-wider text-white dark:bg-emerald-600 sm:text-xs">AGH</div>
                        <div className="min-w-0">
                            <h1 className="text-[11px] font-bold uppercase leading-tight tracking-tight text-slate-900 dark:text-white sm:text-xs">{t('dashboard.dashboard')}</h1>
                            <p className="mt-0.5 truncate text-[9px] text-slate-500 dark:text-slate-400 sm:text-[10px]">
                                {t('dashboard.welcome')}, <span className="font-semibold text-slate-700 dark:text-slate-200">{user.name}</span>
                                {' '}({t('dashboard.role')}: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-600 dark:text-slate-400 text-[9px] font-bold">{user.role}</span>)
                            </p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 sm:gap-3">
                        <div className="hidden md:block">
                            <SystemClock lang={i18n.language} />
                        </div>
                        <div className="flex items-center gap-1 border-slate-200 dark:border-slate-800 sm:gap-2 sm:border-l sm:pl-3">
                            <button onClick={toggleLanguage} className="rounded px-1.5 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 sm:px-2 sm:text-xs">{i18n.language === 'PL' ? 'EN' : 'PL'}</button>
                            <button
                                onClick={() => setIsDarkMode(!isDarkMode)}
                                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                                aria-label={isDarkMode ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'}
                            >
                                {isDarkMode ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3" /></svg> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646" /></svg>}
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
                </div>

                {canViewList && (
                    <div className="mx-auto max-w-7xl overflow-x-auto border-t border-slate-100 px-3 dark:border-slate-800/50 sm:px-6 lg:px-8">
                        <div className="flex min-w-max gap-4 sm:gap-6">
                            <button onClick={() => setActiveTab('inventory')} className={`whitespace-nowrap py-3 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'inventory' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{t('dashboard.tabInventory')}</button>
                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                                <button onClick={() => setActiveTab('users')} className={`whitespace-nowrap py-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${activeTab === 'users' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                    <span>{t('dashboard.tabUsers')}</span>
                                    {pendingUserCount > 0 && <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingUserCount}</span>}
                                </button>
                                <button onClick={() => setActiveTab('categories')} className={`whitespace-nowrap py-3 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'categories' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{t('dashboard.tabCategories')}</button>
                            </RoleGuard>
                        </div>
                    </div>
                )}
            </nav>

            <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex flex-col">
                {!canViewList ? (
                    <div className="my-auto max-w-md mx-auto text-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm space-y-4">
                        <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">✕</div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('dashboard.accessDeniedTitle')}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t('dashboard.accessDeniedDesc')}</p>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fadeIn">
                        {activeTab === 'inventory' && (
                            <>
                                {error && (
                                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400 flex justify-between items-start gap-3">
                                        <span>{error}</span>
                                        <button type="button" onClick={clearError} className="text-rose-500 hover:text-rose-700">✕</button>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {[
                                        { title: t('dashboard.totalAssets'), count: stats.total, color: 'text-slate-900 dark:text-white' },
                                        { title: t('dashboard.borrowedAssets'), count: stats.borrowed, color: 'text-blue-600 dark:text-blue-400' },
                                        { title: t('dashboard.pendingApprovals'), count: stats.pending, color: 'text-amber-600 dark:text-amber-400' },
                                        { title: t('dashboard.damagedAssets'), count: stats.damaged, color: 'text-rose-600 dark:text-rose-400' },
                                    ].map((stat) => (
                                        <div key={stat.title} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl shadow-sm">
                                            <div className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">{stat.title}</div>
                                            <div className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.count}</div>
                                        </div>
                                    ))}
                                </div>

                                <section className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm space-y-4">
                                    <div className="flex flex-col items-center gap-4 md:flex-row md:items-center md:justify-between">
                                        <div className="relative w-full max-w-md">
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                            </span>
                                            <input type="text" placeholder={t('dashboard.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 transition text-slate-800 dark:text-slate-100" />
                                        </div>
                                        <div className="flex w-full flex-wrap items-center justify-center gap-2 md:w-auto md:justify-end">
                                            <button
                                                type="button"
                                                onClick={() => setIsQrScannerOpen(true)}
                                                className="flex min-w-[7.5rem] flex-1 items-center justify-center space-x-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:flex-none sm:py-1.5"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3M16 3h3a2 2 0 012 2v3M21 16v3a2 2 0 01-2 2h-3M8 21H5a2 2 0 01-2-2v-3M7 8h3v3H7V8zm7 0h3v3h-3V8zM7 14h3v3H7v-3zm7 0h1m2 0v3h-3v-1" />
                                                </svg>
                                                <span>{t('qrScanner.button')}</span>
                                            </button>
                                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_EXPORT}>
                                                <button className="flex min-w-[7.5rem] flex-1 items-center justify-center space-x-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:flex-none sm:py-1.5"><span>⬇</span><span>{t('dashboard.exportXlsx')}</span></button>
                                            </RoleGuard>
                                            <RoleGuard user={user} requiredPermission={PERMISSIONS.ITEM_CREATE}>
                                                <button onClick={() => setIsAddModalOpen(true)} className="flex min-w-[7.5rem] flex-1 items-center justify-center space-x-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:flex-none sm:py-1.5"><span>+</span><span>{t('dashboard.addAsset')}</span></button>
                                            </RoleGuard>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-900 sm:flex-row sm:flex-wrap sm:justify-center md:justify-start">
                                        <div className="flex w-full max-w-md items-center gap-2 sm:w-auto">
                                            <span className="shrink-0 text-slate-400 font-medium">{t('dashboard.filterStatus')}:</span>
                                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-w-0 flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 focus:outline-none text-slate-700 dark:text-slate-300 text-xs sm:flex-none">
                                                <option value="all">{t('dashboard.all')}</option>
                                                {ITEM_STATUSES.map((status) => (
                                                    <option key={status} value={status}>{getStatusLabel(status)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex w-full max-w-md items-center gap-2 sm:w-auto">
                                            <span className="shrink-0 text-slate-400 font-medium">{t('dashboard.filterCategory')}:</span>
                                            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="min-w-0 flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 focus:outline-none text-slate-700 dark:text-slate-300 text-xs sm:flex-none">
                                                <option value="all">{t('dashboard.all')}</option>
                                                {categories.map((category) => (
                                                    <option key={category.id} value={category.name}>{category.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </section>

                                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="bg-slate-50/80 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                                                    <th className="py-2.5 px-4">{t('dashboard.thId')}</th>
                                                    <th className="py-2.5 px-4">{t('dashboard.thName')}</th>
                                                    <th className="py-2.5 px-4">{t('dashboard.thCategory')}</th>
                                                    <th className="py-2.5 px-4">{t('dashboard.thLocation')}</th>
                                                    <th className="py-2.5 px-4">{t('dashboard.thStatus')}</th>
                                                    <th className="py-2.5 px-4">{t('dashboard.thOwner')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-900/60">
                                                {isLoading && filteredItems.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="6" className="py-8 text-center text-slate-400 dark:text-slate-500 font-medium">
                                                            {t('userManager.loading')}
                                                        </td>
                                                    </tr>
                                                ) : filteredItems.length > 0 ? filteredItems.map((item) => (
                                                    <tr
                                                        key={item.id}
                                                        onClick={() => { setSelectedItem(item); setIsDetailsModalOpen(true); }}
                                                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition cursor-pointer"
                                                    >
                                                        <td className="py-3 px-4 font-mono text-slate-400 dark:text-slate-500">{item.inventory_number ?? item.id}</td>
                                                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                                                            <div>{item.name}</div>
                                                            {item.description && (
                                                                <div className="text-[10px] text-slate-400 font-normal line-clamp-1">{item.description}</div>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{item.category}</td>
                                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{item.location}</td>
                                                        <td className="py-3 px-4">
                                                            <StatusBadge status={item.status} label={getStatusLabel(item.status)} />
                                                            {item.borrower && <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">{item.borrower} ({item.dueDate})</div>}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">{item.owner}</td>
                                                    </tr>
                                                )) : (
                                                    <tr><td colSpan="6" className="py-8 text-center text-slate-400 dark:text-slate-500 font-medium">{t('dashboard.noResults')}</td></tr>
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
