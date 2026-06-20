import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ROLES } from '../auth/permissions';
import { useGuests } from './useGuests';

const getGuestName = (guest) => `${guest.firstName} ${guest.lastName}`.trim() || guest.email;

export default function GuestManager({ user }) {
    const { t } = useTranslation();
    const { listGuests, createGuest, updateGuest, deleteGuest, isLoading, error, clearError } = useGuests();

    const isAdmin = user?.role === ROLES.ADMIN;
    const canCreate = user?.role === ROLES.ADMIN || user?.role === ROLES.USER;

    const [guests, setGuests] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [search, setSearch] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [addForm, setAddForm] = useState({ firstName: '', lastName: '', email: '' });
    const [editingGuest, setEditingGuest] = useState(null);
    const [editForm, setEditForm] = useState(null);

    const refreshGuests = useCallback(async (searchQuery = search) => {
        const result = await listGuests(searchQuery ? { search: searchQuery, limit: 100, role: 'guest' } : { limit: 100, role: 'guest' });
        if (result.success) {
            setGuests(result.guests);
            setTotalCount(result.totalCount);
        }
    }, [listGuests, search]);

    useEffect(() => {
        refreshGuests('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSearchSubmit = (event) => {
        event.preventDefault();
        refreshGuests(search);
    };

    const handleCreate = async (event) => {
        event.preventDefault();
        clearError();

        const result = await createGuest(addForm);
        if (result.success) {
            setGuests((current) => [result.guest, ...current]);
            setTotalCount((current) => current + 1);
            setAddForm({ firstName: '', lastName: '', email: '' });
            setIsAddOpen(false);
        }
    };

    const handleSaveEdit = async (event) => {
        event.preventDefault();
        const result = await updateGuest(editingGuest.id, editForm);

        if (result.success) {
            setGuests((current) => current.map((g) => (g.id === result.guest.id ? result.guest : g)));
            setEditingGuest(null);
            setEditForm(null);
        }
    };

    const handleDelete = async (guest) => {
        if (!window.confirm(t('guests.deleteConfirm', { name: getGuestName(guest) }))) {
            return;
        }

        const result = await deleteGuest(guest.id);
        if (result.success) {
            setGuests((current) => current.filter((g) => g.id !== guest.id));
            setTotalCount((current) => Math.max(current - 1, 0));
        }
    };

    return (
        <div className="space-y-4 animate-fadeIn">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-xl shadow-sm">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('guests.title')}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('guests.desc')}</p>
            </div>

            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm space-y-4">
                <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('guests.search')}
                        className="flex-grow px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100"
                    />
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2 text-xs font-bold bg-slate-800 dark:bg-slate-700 text-white rounded-lg disabled:opacity-50"
                    >
                        {t('userManager.search')}
                    </button>
                    {canCreate && (
                        <button
                            type="button"
                            onClick={() => { setIsAddOpen(true); clearError(); }}
                            className="px-4 py-2 text-xs font-bold bg-emerald-700 dark:bg-emerald-600 text-white rounded-lg"
                        >
                            + {t('guests.addTitle')}
                        </button>
                    )}
                </form>

                {error && (
                    <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg px-3 py-2">
                        {error}
                    </div>
                )}

                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                    {t('userManager.totalUsers')}: {totalCount}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider">
                                <th className="py-2 px-3">{t('userManager.thUser')}</th>
                                <th className="py-2 px-3">{t('userManager.email')}</th>
                                {isAdmin && <th className="py-2 px-3">{t('userManager.thActions')}</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-900/60">
                            {guests.length > 0 ? guests.map((guest) => (
                                <tr key={guest.id}>
                                    <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">
                                        {getGuestName(guest) || t('userManager.unnamedUser')}
                                    </td>
                                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                                        {guest.email || '—'}
                                    </td>
                                    {isAdmin && (
                                        <td className="py-3 px-3 space-x-2">
                                            <button
                                                type="button"
                                                onClick={() => { setEditingGuest(guest); setEditForm({ ...guest }); clearError(); }}
                                                className="text-emerald-600 dark:text-emerald-400 font-medium"
                                            >
                                                {t('guests.edit')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(guest)}
                                                className="text-rose-600 dark:text-rose-400 font-medium"
                                            >
                                                {t('guests.delete')}
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={isAdmin ? 3 : 2} className="py-6 text-center text-slate-400">
                                        {isLoading ? t('userManager.loading') : t('guests.noResults')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <form
                        onSubmit={handleCreate}
                        className="w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xl"
                    >
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('guests.addTitle')}</h3>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t('guests.firstName')}</label>
                            <input
                                required
                                value={addForm.firstName}
                                onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t('guests.lastName')}</label>
                            <input
                                value={addForm.lastName}
                                onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t('guests.email')}</label>
                            <input
                                type="email"
                                value={addForm.email}
                                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setIsAddOpen(false)} className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700">
                                {t('guests.cancel')}
                            </button>
                            <button type="submit" disabled={isLoading} className="px-3 py-2 text-xs font-bold rounded-lg bg-emerald-700 text-white disabled:opacity-50">
                                {isLoading ? t('guests.saving') : t('guests.save')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {editingGuest && editForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <form
                        onSubmit={handleSaveEdit}
                        className="w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xl"
                    >
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('guests.edit')}</h3>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t('guests.firstName')}</label>
                            <input
                                required
                                value={editForm.firstName}
                                onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t('guests.lastName')}</label>
                            <input
                                value={editForm.lastName}
                                onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t('guests.email')}</label>
                            <input
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => { setEditingGuest(null); setEditForm(null); }} className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700">
                                {t('guests.cancel')}
                            </button>
                            <button type="submit" disabled={isLoading} className="px-3 py-2 text-xs font-bold rounded-lg bg-emerald-700 text-white disabled:opacity-50">
                                {isLoading ? t('guests.saving') : t('userManager.save')}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
