import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Search, UserPlus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AppUser } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getEntryName, useGuests, type DirectoryEntry, type Guest } from './useGuests';

type DirectoryTab = 'list' | 'create';

const emptyForm = (): Pick<Guest, 'firstName' | 'lastName' | 'email'> => ({
    firstName: '',
    lastName: '',
    email: '',
});

type UserDirectoryProps = {
    user: AppUser;
};

export default function UserDirectory({ user }: UserDirectoryProps) {
    const { t } = useTranslation();
    const { browseUsers, createGuest, updateGuest, deleteGuest, isLoading, error, clearError, isGuest } = useGuests();
    const isAdmin = user.role === 'admin';

    const [activeTab, setActiveTab] = useState<DirectoryTab>('list');
    const [entries, setEntries] = useState<DirectoryEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [createForm, setCreateForm] = useState(emptyForm);
    const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
    const [editForm, setEditForm] = useState<Guest | null>(null);

    const refreshEntries = useCallback(async (search = searchQuery) => {
        const result = await browseUsers(search ? { search, limit: 100 } : { limit: 100 });
        if (result.success) {
            setEntries(result.entries);
        }
    }, [browseUsers, searchQuery]);

    useEffect(() => {
        void refreshEntries('');
    }, [refreshEntries]);

    const filteredEntries = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return entries;

        return entries.filter((entry) => {
            const name = getEntryName(entry).toLowerCase();
            const email = isGuest(entry) ? entry.email.toLowerCase() : '';
            return name.includes(query) || email.includes(query);
        });
    }, [entries, searchQuery]);

    const handleSearch = () => {
        void refreshEntries(searchQuery);
    };

    const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!createForm.firstName.trim()) return;

        const result = await createGuest(createForm);
        if (result.success && result.guest) {
            setEntries((current) => [result.guest!, ...current]);
            setCreateForm(emptyForm());
            setActiveTab('list');
        }
    };

    const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editingGuest || !editForm) return;

        const result = await updateGuest(editingGuest.id, editForm);
        if (result.success && result.guest) {
            setEntries((current) =>
                current.map((entry) => (isGuest(entry) && entry.id === result.guest!.id ? result.guest! : entry)),
            );
            setEditingGuest(null);
            setEditForm(null);
        }
    };

    const handleDelete = async (guest: Guest) => {
        if (!window.confirm(t('guests.deleteConfirm', { name: getEntryName(guest) }))) {
            return;
        }

        const result = await deleteGuest(guest.id);
        if (result.success) {
            setEntries((current) => current.filter((entry) => !(isGuest(entry) && entry.id === guest.id)));
        }
    };

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('guests.title')}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('guests.desc')}</p>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertTitle>{t('auth.loginErrorTitle')}</AlertTitle>
                    <AlertDescription className="flex items-center justify-between gap-3">
                        <span>{error}</span>
                        <Button variant="ghost" size="sm" onClick={clearError}>✕</Button>
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800">
                <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition-colors ${
                        activeTab === 'list'
                            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <Users className="size-4" />
                    {t('guests.tabList')}
                </button>
                <button
                    type="button"
                    onClick={() => { setActiveTab('create'); clearError(); }}
                    className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition-colors ${
                        activeTab === 'create'
                            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <UserPlus className="size-4" />
                    {t('guests.tabCreate')}
                </button>
            </div>

            {activeTab === 'list' && (
                <div className="space-y-4">
                    <Card>
                        <CardContent className="space-y-4 p-4">
                            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                                <div className="space-y-2">
                                    <Label htmlFor="directory-search">{t('guests.search')}</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                                        <Input
                                            id="directory-search"
                                            value={searchQuery}
                                            onChange={(event) => setSearchQuery(event.target.value)}
                                            onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                                            placeholder={t('guests.searchPlaceholder')}
                                            className="pl-9"
                                        />
                                    </div>
                                </div>
                                <Button onClick={handleSearch} disabled={isLoading}>
                                    {t('dashboard.refresh')}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/80 dark:bg-slate-900/50">
                                    <TableHead>{t('guests.firstName')}</TableHead>
                                    <TableHead>{t('guests.lastName')}</TableHead>
                                    <TableHead>{t('guests.email')}</TableHead>
                                    <TableHead>{t('userManager.thRole')}</TableHead>
                                    {isAdmin && <TableHead className="text-right">{t('guests.actions')}</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEntries.length > 0 ? filteredEntries.map((entry, index) => (
                                    <TableRow key={isGuest(entry) ? `guest-${entry.id}` : `user-${entry.firstName}-${entry.lastName}-${index}`}>
                                        <TableCell>{entry.firstName}</TableCell>
                                        <TableCell>{entry.lastName || '—'}</TableCell>
                                        <TableCell>{isGuest(entry) ? (entry.email || '—') : '—'}</TableCell>
                                        <TableCell>{t(`userManager.roles.${entry.role}`, { defaultValue: entry.role })}</TableCell>
                                        {isAdmin && (
                                            <TableCell className="text-right">
                                                {isGuest(entry) ? (
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setEditingGuest(entry);
                                                                setEditForm({ ...entry });
                                                                clearError();
                                                            }}
                                                        >
                                                            {t('guests.edit')}
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => void handleDelete(entry)}
                                                        >
                                                            {t('guests.delete')}
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">{t('guests.readOnly')}</span>
                                                )}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={isAdmin ? 5 : 4} className="py-10 text-center text-slate-400">
                                            {isLoading ? t('userManager.loading') : t('guests.noResults')}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            )}

            {activeTab === 'create' && (
                <Card>
                    <CardContent className="p-4 sm:p-5">
                        <form className="mx-auto max-w-lg space-y-4" onSubmit={(event) => void handleCreate(event)}>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('guests.addTitle')}</h3>

                            <div className="space-y-2">
                                <Label htmlFor="guest-first-name">{t('guests.firstName')}</Label>
                                <Input
                                    id="guest-first-name"
                                    value={createForm.firstName}
                                    onChange={(event) => setCreateForm((current) => ({ ...current, firstName: event.target.value }))}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="guest-last-name">{t('guests.lastName')}</Label>
                                <Input
                                    id="guest-last-name"
                                    value={createForm.lastName}
                                    onChange={(event) => setCreateForm((current) => ({ ...current, lastName: event.target.value }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="guest-email">{t('guests.email')}</Label>
                                <Input
                                    id="guest-email"
                                    type="email"
                                    value={createForm.email}
                                    onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                                    placeholder={t('guests.emailOptional')}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => setActiveTab('list')}>
                                    {t('guests.cancel')}
                                </Button>
                                <Button type="submit" disabled={isLoading || !createForm.firstName.trim()}>
                                    {isLoading ? t('guests.saving') : t('guests.save')}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Dialog open={Boolean(editingGuest && editForm)} onOpenChange={(open) => !open && setEditingGuest(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('guests.edit')}</DialogTitle>
                        <DialogDescription>{t('guests.editDesc')}</DialogDescription>
                    </DialogHeader>
                    {editForm && (
                        <form className="space-y-4" onSubmit={(event) => void handleSaveEdit(event)}>
                            <div className="space-y-2">
                                <Label htmlFor="edit-guest-first-name">{t('guests.firstName')}</Label>
                                <Input
                                    id="edit-guest-first-name"
                                    value={editForm.firstName}
                                    onChange={(event) => setEditForm((current) => current ? { ...current, firstName: event.target.value } : current)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-guest-last-name">{t('guests.lastName')}</Label>
                                <Input
                                    id="edit-guest-last-name"
                                    value={editForm.lastName}
                                    onChange={(event) => setEditForm((current) => current ? { ...current, lastName: event.target.value } : current)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-guest-email">{t('guests.email')}</Label>
                                <Input
                                    id="edit-guest-email"
                                    type="email"
                                    value={editForm.email}
                                    onChange={(event) => setEditForm((current) => current ? { ...current, email: event.target.value } : current)}
                                />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setEditingGuest(null)}>
                                    {t('guests.cancel')}
                                </Button>
                                <Button type="submit" disabled={isLoading}>
                                    {isLoading ? t('guests.saving') : t('userManager.save')}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
