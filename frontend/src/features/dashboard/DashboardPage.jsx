import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SystemClock from '../../components/SystemClock';
import RoleGuard from '../auth/RoleGuard';
import { PERMISSIONS, hasPermission } from '../auth/permissions';
import CategoryManager from './CategoryManager';
import AddAssetModal from './AddAssetModal';
import ItemDetailsModal from './ItemDetailsModal';
import LocationManager from '../locations/LocationManager';
// import { useInventory } from './useInventory';

export default function DashboardPage({ user, onLogout, isDarkMode, setIsDarkMode }) {
    const { t, i18n } = useTranslation();

    const [items, setItems] = useState([
        { id: 'AGH-WFIIS-0042', name: 'Oscyloskop cyfrowy InfiniiVision', producer: 'Keysight', model: 'DSOX2002A', serialNumber: 'MY54321098', status: 'dostępny', category: 'Oscyloskopy', location: 'Budynek D10 / Pokój 204 / Szafa A', owner: 'dr inż. Jan Kowalski' },
        { id: 'AGH-WFIIS-0113', name: 'Generator funkcji arbitralnych', producer: 'Tektronix', model: 'AFG1022', serialNumber: 'TEK7654321', status: 'wypożyczony', category: 'Generatory funkcyjne', location: 'Budynek D11 / Pokój 105 / Szafa B', owner: 'prof. dr hab. Andrzej Nowak', borrower: 'Jakub Wiśniewski', dueDate: '2026-06-01' },
        { id: 'AGH-WFIIS-0391', name: 'Zasilacz laboratoryjny programowalny', producer: 'Rigol', model: 'DP832', serialNumber: 'DP8B123456', status: 'oczekuje akceptacji', category: 'Zasilacze laboratoryjne', location: 'Budynek D10 / Pokój 204 / Szafa C', owner: 'dr inż. Jan Kowalski', borrower: 'Anna Malik' }
    ]);
    // const { items, isLoading, error, addAsset } = useInventory(); docelowe użycie
    // useEffect(() => {
    //     fetchItems();
    // }, [fetchItems]);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');

    const [activeTab, setActiveTab] = useState('inventory');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const [selectedItem, setSelectedItem] = useState(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    const [pendingUsers, setPendingUsers] = useState([
        { id: 'req-001', name: 'Anna Malik', email: 'amalik@student.agh.edu.pl', date: '2026-05-18', reason: 'Praca dyplomowa' },
        { id: 'req-002', name: 'Firma Tech-Pomiar Sp. z o.o.', email: 'kontakt@techpomiar.pl', date: '2026-05-20', reason: 'Zlecenie zewnętrzne WFiIS' }
    ]);

    useEffect(() => {
        const root = window.document.documentElement;
        if (isDarkMode) root.classList.add('dark');
        else root.classList.remove('dark');
    }, [isDarkMode]);

    const canViewList = hasPermission(user, PERMISSIONS.ITEM_LIST);

    const filteredItems = canViewList ? items.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.producer.toLowerCase().includes(searchQuery.toLowerCase()) || item.id.toLowerCase().includes(searchQuery.toLowerCase()) || item.serialNumber.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
        const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
        return matchesSearch && matchesStatus && matchesCategory;
    }) : [];

    const handleApproveUser = (id) => {
        setPendingUsers(pendingUsers.filter(u => u.id !== id));
    };

    const handleSaveAsset = (newAsset) => {
        setItems([newAsset, ...items]);
    };

    const handleUpdateItemStatus = (itemId, newStatus, clearBorrower = false, newBorrower = null, newDueDate = null) => {
        setItems(prevItems => prevItems.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    status: newStatus,
                    borrower: newBorrower ? newBorrower : (clearBorrower ? null : item.borrower),
                    dueDate: newDueDate ? newDueDate : (clearBorrower ? null : item.dueDate)
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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 bg-emerald-700 dark:bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold text-xs tracking-wider">AGH</div>
                        <div>
                            <h1 className="font-bold text-xs tracking-tight text-slate-900 dark:text-white uppercase">{t('dashboard.dashboard')}</h1>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                {t('dashboard.welcome')}, <span className="font-semibold text-slate-700 dark:text-slate-200">{user.name}</span>
                                {' '}({t('dashboard.role')}: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-600 dark:text-slate-400 text-[9px] font-bold">{user.role}</span>)
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <SystemClock lang={i18n.language} />
                        <div className="flex items-center space-x-2 border-l border-slate-200 dark:border-slate-800 pl-4">
                            <button onClick={toggleLanguage} className="px-2 py-1 text-xs font-bold rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">{i18n.language === 'PL' ? 'EN' : 'PL'}</button>
                            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                                {isDarkMode ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3" /></svg> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646" /></svg>}
                            </button>
                            <button onClick={onLogout} className="ml-2 px-2.5 py-1.5 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 text-xs font-medium rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/60 transition">{t('dashboard.logout')}</button>
                        </div>
                    </div>
                </div>

                {canViewList && (
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-100 dark:border-slate-800/50">
                        <div className="flex space-x-6">
                            <button onClick={() => setActiveTab('inventory')} className={`py-3 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'inventory' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{t('dashboard.tabInventory')}</button>
                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                                <button onClick={() => setActiveTab('users')} className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${activeTab === 'users' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                    <span>{t('dashboard.tabUsers')}</span>
                                    {pendingUsers.length > 0 && <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingUsers.length}</span>}
                                </button>
                                <button onClick={() => setActiveTab('categories')} className={`py-3 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'categories' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{t('dashboard.tabCategories')}</button>
                                <button onClick={() => setActiveTab('locations')} className={`py-3 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'locations' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{t('dashboard.tabLocations')}</button>
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
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {[
                                        { title: t('dashboard.totalAssets'), count: items.length + 1245, color: 'text-slate-900 dark:text-white' }, // Dynamiczny licznik oparty na stanie
                                        { title: t('dashboard.borrowedAssets'), count: '142', color: 'text-blue-600 dark:text-blue-400' },
                                        { title: t('dashboard.pendingApprovals'), count: '7', color: 'text-amber-600 dark:text-amber-400' },
                                        { title: t('dashboard.damagedAssets'), count: '3', color: 'text-rose-600 dark:text-rose-400' }
                                    ].map((stat, idx) => (
                                        <div key={idx} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl shadow-sm">
                                            <div className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">{stat.title}</div>
                                            <div className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.count}</div>
                                        </div>
                                    ))}
                                </div>

                                <section className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm space-y-4">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="relative flex-grow max-w-md">
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                            </span>
                                            <input type="text" placeholder={t('dashboard.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 transition text-slate-800 dark:text-slate-100" />
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_EXPORT}>
                                                <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition flex items-center space-x-1"><span>⬇</span><span>{t('dashboard.exportXlsx')}</span></button>
                                            </RoleGuard>
                                            <RoleGuard user={user} requiredPermission={PERMISSIONS.ITEM_CREATE}>
                                                <button onClick={() => setIsAddModalOpen(true)} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition flex items-center space-x-1"><span>+</span><span>{t('dashboard.addAsset')}</span></button>
                                            </RoleGuard>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-4 pt-3 border-t border-slate-100 dark:border-slate-900 text-xs">
                                        <div className="flex items-center space-x-1.5">
                                            <span className="text-slate-400 font-medium">{t('dashboard.filterStatus')}:</span>
                                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 focus:outline-none text-slate-700 dark:text-slate-300 text-xs">
                                                <option value="all">{t('dashboard.all')}</option>
                                                <option value="dostępny">dostępny</option>
                                                <option value="wypożyczony">wypożyczony</option>
                                                <option value="oczekuje akceptacji">oczekuje akceptacji</option>
                                                <option value="uszkodzony">uszkodzony</option>
                                                <option value="zarezerwowany">zarezerwowany</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center space-x-1.5">
                                            <span className="text-slate-400 font-medium">{t('dashboard.filterCategory')}:</span>
                                            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 focus:outline-none text-slate-700 dark:text-slate-300 text-xs">
                                                <option value="all">{t('dashboard.all')}</option>
                                                <option value="Aparatura pomiarowa">Aparatura pomiarowa</option>
                                                <option value="Oscyloskopy">Oscyloskopy</option>
                                                <option value="Generatory funkcyjne">Generatory funkcyjne</option>
                                                <option value="Aparatura zasilająca">Aparatura zasilająca</option>
                                                <option value="Zasilacze laboratoryjne">Zasilacze laboratoryjne</option>
                                                <option value="Sprzęt IT">Sprzęt IT</option>
                                                <option value="Laptopy">Laptopy</option>
                                                <option value="Akcesoria i optyka">Akcesoria i optyka</option>
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
                                            {filteredItems.length > 0 ? filteredItems.map(item => {
                                                const badgeColor = {
                                                    'dostępny': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
                                                    'wypożyczony': 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
                                                    'oczekuje akceptacji': 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
                                                    'uszkodzony': 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400',
                                                    'zarezerwowany': 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400'
                                                }[item.status];

                                                return (
                                                    <tr
                                                        key={item.id}
                                                        onClick={() => { setSelectedItem(item); setIsDetailsModalOpen(true); }}
                                                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition cursor-pointer"
                                                    >
                                                        <td className="py-3 px-4 font-mono text-slate-400 dark:text-slate-500">{item.id}</td>
                                                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                                                            <div>{item.name}</div>
                                                            <div className="text-[10px] text-slate-400 font-normal">{item.producer} / {item.model}</div>
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{item.category}</td>
                                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{item.location}</td>
                                                        <td className="py-3 px-4">
                                                            <span className={`inline-block px-2 py-0.5 rounded-full font-medium tracking-wide ${badgeColor}`}>{item.status}</span>
                                                            {item.borrower && <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">{item.borrower} ({item.dueDate})</div>}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">{item.owner}</td>
                                                    </tr>
                                                );
                                            }) : (
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
                                <div className="space-y-4 animate-fadeIn">
                                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6">
                                        <h2 className="text-base font-bold text-slate-900 dark:text-white">{t('dashboard.userReqTitle')}</h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('dashboard.userReqDesc')}</p>
                                        <div className="mt-6 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                <tr className="bg-slate-50/80 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                                                    <th className="py-3 px-4">Użytkownik / Podmiot</th>
                                                    <th className="py-3 px-4">Data wniosku</th>
                                                    <th className="py-3 px-4">Uzasadnienie</th>
                                                    <th className="py-3 px-4 text-right">Akcje</th>
                                                </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-900/60">
                                                {pendingUsers.length > 0 ? pendingUsers.map(req => (
                                                    <tr key={req.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20 transition">
                                                        <td className="py-3 px-4">
                                                            <div className="font-medium text-slate-900 dark:text-white">{req.name}</div>
                                                            <div className="text-[10px] text-slate-400">{req.email}</div>
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{req.date}</td>
                                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 italic">{req.reason}</td>
                                                        <td className="py-3 px-4 flex justify-end space-x-2">
                                                            <button onClick={() => handleApproveUser(req.id)} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-400 font-medium rounded transition">{t('dashboard.approveBtn')}</button>
                                                            <button onClick={() => handleApproveUser(req.id)} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 dark:text-rose-400 font-medium rounded transition">{t('dashboard.rejectBtn')}</button>
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr><td colSpan="4" className="py-6 text-center text-slate-500">Brak oczekujących wniosków.</td></tr>
                                                )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </RoleGuard>
                        )}

                        {activeTab === 'categories' && (
                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                                <CategoryManager />
                            </RoleGuard>
                        )}

                        {activeTab === 'locations' && (
                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                                <LocationManager />
                            </RoleGuard>
                        )}

                    </div>
                )}
            </main>

            <AddAssetModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleSaveAsset}
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
