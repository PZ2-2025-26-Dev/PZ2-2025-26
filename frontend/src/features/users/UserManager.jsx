import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUsers } from './useUsers';

const ROLE_OPTIONS = ['admin', 'user', 'observer'];
const APPROVAL_ROLE_OPTIONS = ['user', 'observer'];
const STATUS_OPTIONS = ['active', 'pending_approval', 'inactive'];

const getUserName = (user) => `${user.firstName} ${user.lastName}`.trim();

export default function UserManager({ onPendingCountChange }) {
    const { t } = useTranslation();
    const { listUsers, updateUser, deleteUser, isLoading, error, clearError } = useUsers();

    const [users, setUsers] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [filters, setFilters] = useState({
        search: '',
        role: 'all',
        status: 'all',
        page: 1,
        limit: 20,
    });
    const [approvalRoles, setApprovalRoles] = useState({});
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState(null);

    const pendingCount = useMemo(
        () => users.filter((user) => user.status === 'pending_approval').length,
        [users]
    );

    useEffect(() => {
        onPendingCountChange?.(pendingCount);
    }, [onPendingCountChange, pendingCount]);

    const refreshUsers = async () => {
        const result = await listUsers(filters);
        if (result.success) {
            setUsers(result.users);
            setTotalCount(result.totalCount);
        }
    };

    useEffect(() => {
        refreshUsers();
    }, [filters.role, filters.status, filters.page, filters.limit]);

    const handleSearchSubmit = (event) => {
        event.preventDefault();
        setFilters((current) => ({ ...current, page: 1 }));
        refreshUsers();
    };

    const patchUserInList = (updatedUser) => {
        setUsers((current) => current.map((user) => (user.id === updatedUser.id ? updatedUser : user)));
    };

    const handleApprove = async (user) => {
        const role = approvalRoles[user.id] ?? 'user';
        const result = await updateUser(user.id, {
            ...user,
            role,
            status: 'active',
        });

        if (result.success) {
            patchUserInList(result.user);
        }
    };

    const handleDeactivate = async (user) => {
        const result = await updateUser(user.id, {
            ...user,
            status: 'inactive',
        });

        if (result.success) {
            patchUserInList(result.user);
        }
    };

    const handleOpenEdit = (user) => {
        setEditingUser(user);
        setEditForm({ ...user });
        clearError();
    };

    const handleSaveEdit = async (event) => {
        event.preventDefault();
        const result = await updateUser(editingUser.id, editForm);

        if (result.success) {
            patchUserInList(result.user);
            setEditingUser(null);
            setEditForm(null);
        }
    };

    const handleDelete = async (user) => {
        if (!window.confirm(t('userManager.deleteConfirm', { name: getUserName(user) || user.email }))) {
            return;
        }

        const result = await deleteUser(user.id);
        if (result.success) {
            setUsers((current) => current.filter((item) => item.id !== user.id));
            setTotalCount((current) => Math.max(current - 1, 0));
        }
    };

    const totalPages = Math.max(Math.ceil(totalCount / filters.limit), 1);

    return (
        <div className="space-y-4 animate-fadeIn">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl shadow-sm">
                    <div className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">{t('userManager.totalUsers')}</div>
                    <div className="text-xl font-bold mt-1 text-slate-900 dark:text-white">{totalCount}</div>
                </div>
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl shadow-sm">
                    <div className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">{t('userManager.pendingUsers')}</div>
                    <div className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">{pendingCount}</div>
                </div>
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl shadow-sm">
                    <div className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">{t('userManager.activeUsers')}</div>
                    <div className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{users.filter((user) => user.status === 'active').length}</div>
                </div>
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl shadow-sm">
                    <div className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">{t('userManager.adminUsers')}</div>
                    <div className="text-xl font-bold mt-1 text-blue-600 dark:text-blue-400">{users.filter((user) => user.role === 'admin').length}</div>
                </div>
            </div>

            <section className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm space-y-4">
                <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="relative flex-grow max-w-lg">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </span>
                        <input
                            type="text"
                            value={filters.search}
                            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                            placeholder={t('userManager.searchPlaceholder')}
                            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 transition text-slate-800 dark:text-slate-100"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <select
                            value={filters.role}
                            onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value, page: 1 }))}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 focus:outline-none text-slate-700 dark:text-slate-300"
                        >
                            <option value="all">{t('userManager.allRoles')}</option>
                            {ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>{t(`userManager.roles.${role}`)}</option>
                            ))}
                        </select>
                        <select
                            value={filters.status}
                            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 focus:outline-none text-slate-700 dark:text-slate-300"
                        >
                            <option value="all">{t('userManager.allStatuses')}</option>
                            {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>{t(`userManager.statuses.${status}`)}</option>
                            ))}
                        </select>
                        <button type="submit" disabled={isLoading} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-lg transition disabled:opacity-50">
                            {t('userManager.search')}
                        </button>
                        <button type="button" onClick={refreshUsers} disabled={isLoading} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-medium rounded-lg transition disabled:opacity-50">
                            {isLoading ? t('userManager.loading') : t('userManager.refresh')}
                        </button>
                    </div>
                </form>

                {error && (
                    <div className="px-4 py-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-400 text-xs flex justify-between items-start gap-4">
                        <span>{error}</span>
                        <button onClick={clearError} className="font-bold text-rose-500 hover:text-rose-700">x</button>
                    </div>
                )}
            </section>

            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50/80 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                                <th className="py-2.5 px-4">{t('userManager.thUser')}</th>
                                <th className="py-2.5 px-4">{t('userManager.thRole')}</th>
                                <th className="py-2.5 px-4">{t('userManager.thStatus')}</th>
                                <th className="py-2.5 px-4 text-right">{t('userManager.thActions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-900/60">
                            {users.length > 0 ? users.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                                    <td className="py-3 px-4">
                                        <div className="font-medium text-slate-900 dark:text-white">{getUserName(user) || t('userManager.unnamedUser')}</div>
                                        <div className="text-[10px] text-slate-400 font-normal">{user.email}</div>
                                        <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">ID: {user.id}</div>
                                    </td>
                                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{t(`userManager.roles.${user.role}`, { defaultValue: user.role })}</td>
                                    <td className="py-3 px-4">
                                        <span className={`inline-block px-2 py-0.5 rounded-full font-medium tracking-wide ${user.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : user.status === 'pending_approval' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                            {t(`userManager.statuses.${user.status}`, { defaultValue: user.status })}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex flex-wrap justify-end gap-2">
                                            {user.status === 'pending_approval' && (
                                                <>
                                                    <select
                                                        value={approvalRoles[user.id] ?? 'user'}
                                                        onChange={(event) => setApprovalRoles((current) => ({ ...current, [user.id]: event.target.value }))}
                                                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 focus:outline-none text-slate-700 dark:text-slate-300"
                                                    >
                                                        {APPROVAL_ROLE_OPTIONS.map((role) => (
                                                            <option key={role} value={role}>{t(`userManager.roles.${role}`)}</option>
                                                        ))}
                                                    </select>
                                                    <button onClick={() => handleApprove(user)} disabled={isLoading} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-400 font-medium rounded transition disabled:opacity-50">{t('userManager.approve')}</button>
                                                </>
                                            )}
                                            {user.status !== 'inactive' && (
                                                <button onClick={() => handleDeactivate(user)} disabled={isLoading} className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400 font-medium rounded transition disabled:opacity-50">{t('userManager.deactivate')}</button>
                                            )}
                                            <button onClick={() => handleOpenEdit(user)} disabled={isLoading} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded transition disabled:opacity-50">{t('userManager.edit')}</button>
                                            <button onClick={() => handleDelete(user)} disabled={isLoading} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 dark:text-rose-400 font-medium rounded transition disabled:opacity-50">{t('userManager.delete')}</button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="4" className="py-8 text-center text-slate-400 dark:text-slate-500 font-medium">{isLoading ? t('userManager.loading') : t('userManager.noResults')}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <button
                    onClick={() => setFilters((current) => ({ ...current, page: Math.max(current.page - 1, 1) }))}
                    disabled={filters.page <= 1 || isLoading}
                    className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg disabled:opacity-50"
                >
                    {t('userManager.prev')}
                </button>
                <span>{t('userManager.pageInfo', { page: filters.page, total: totalPages })}</span>
                <button
                    onClick={() => setFilters((current) => ({ ...current, page: Math.min(current.page + 1, totalPages) }))}
                    disabled={filters.page >= totalPages || isLoading}
                    className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg disabled:opacity-50"
                >
                    {t('userManager.next')}
                </button>
            </div>

            {editingUser && editForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <form onSubmit={handleSaveEdit} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-2xl shadow-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-900 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">{t('userManager.editTitle')}</h2>
                            <button type="button" onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm">x</button>
                        </div>
                        <div className="p-6 space-y-4 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className="block">
                                    <span className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('userManager.firstName')}</span>
                                    <input required value={editForm.firstName} onChange={(event) => setEditForm((current) => ({ ...current, firstName: event.target.value }))} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100" />
                                </label>
                                <label className="block">
                                    <span className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('userManager.lastName')}</span>
                                    <input required value={editForm.lastName} onChange={(event) => setEditForm((current) => ({ ...current, lastName: event.target.value }))} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100" />
                                </label>
                            </div>
                            <label className="block">
                                <span className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('userManager.email')}</span>
                                <input type="email" required value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100" />
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className="block">
                                    <span className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('userManager.thRole')}</span>
                                    <select value={editForm.role} onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value }))} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-300">
                                        {ROLE_OPTIONS.map((role) => (
                                            <option key={role} value={role}>{t(`userManager.roles.${role}`)}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('userManager.thStatus')}</span>
                                    <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-300">
                                        {STATUS_OPTIONS.map((status) => (
                                            <option key={status} value={status}>{t(`userManager.statuses.${status}`)}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50/70 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-900 flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">{t('userManager.cancel')}</button>
                            <button type="submit" disabled={isLoading} className="px-4 py-2 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-lg transition disabled:opacity-50">{isLoading ? t('userManager.saving') : t('userManager.save')}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
