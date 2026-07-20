import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Search, UserPlus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AppUser } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getEntryName, useGuests, type DirectoryEntry, type Guest } from './useGuests';
import { useUsers } from '../users/useUsers';

type DirectoryTab = 'list' | 'create';
type PromotedGuestRole = 'admin' | 'user' | 'observer';
const PROMOTED_GUEST_ROLES: PromotedGuestRole[] = ['user', 'observer', 'admin'];
const LEGACY_IMPORT_EMAIL_DOMAIN = '@import.example.com';

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
    const {
        updateUser,
        deleteUser,
        promoteGuest,
        isLoading: isUsersLoading,
        error: usersError,
        clearError: clearUsersError,
    } = useUsers();
    const isAdmin = user.role === 'admin';
    const isBusy = isLoading || isUsersLoading;
    const formError = error || usersError;

    const [activeTab, setActiveTab] = useState<DirectoryTab>('list');
    const [entries, setEntries] = useState<DirectoryEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [createForm, setCreateForm] = useState(emptyForm);
    const [editingEntry, setEditingEntry] = useState<DirectoryEntry | null>(null);
    const [editForm, setEditForm] = useState<DirectoryEntry | null>(null);
    const [entryToDelete, setEntryToDelete] = useState<DirectoryEntry | null>(null);
    const [promoteGuestAccount, setPromoteGuestAccount] = useState(false);
    const [promotePassword, setPromotePassword] = useState('');
    const [promoteRole, setPromoteRole] = useState<PromotedGuestRole>('user');
    const [showPromotePassword, setShowPromotePassword] = useState(false);

    const refreshEntries = useCallback(async (search = searchQuery) => {
        const result = await browseUsers(search ? { search, limit: 100, role: 'guest' } : { limit: 100, role: 'guest' });
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
            const email = (entry.email || '').toLowerCase();
            return name.includes(query) || email.includes(query);
        });
    }, [entries, searchQuery]);

    const handleSearch = () => {
        void refreshEntries(searchQuery);
    };

    const clearAllErrors = () => {
        clearError();
        clearUsersError();
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

    const closeEditDialog = () => {
        setEditingEntry(null);
        setEditForm(null);
        setPromoteGuestAccount(false);
        setPromotePassword('');
        setPromoteRole('user');
        setShowPromotePassword(false);
    };

    const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editingEntry || !editForm) return;

        const result = isGuest(editingEntry) && promoteGuestAccount
            ? await promoteGuest(editingEntry.id, {
                firstName: editForm.firstName,
                lastName: editForm.lastName || '',
                email: editForm.email || '',
                password: promotePassword,
                role: promoteRole,
            })
            : isGuest(editingEntry)
                ? await updateGuest(editingEntry.id, editForm as Guest)
            : await updateUser(editingEntry.id, {
                id: editingEntry.id,
                firstName: editForm.firstName,
                lastName: editForm.lastName || '',
                email: editForm.email || '',
                role: editForm.role,
                status: editForm.status || 'inactive',
            });
        const updatedEntry = isGuest(editingEntry) && !promoteGuestAccount ? result.guest : result.user;

        if (result.success && updatedEntry) {
            setEntries((current) =>
                updatedEntry.role === 'guest'
                    ? current.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry))
                    : current.filter((entry) => entry.id !== updatedEntry.id),
            );
            closeEditDialog();
        }
    };

    const confirmDelete = async () => {
        if (!entryToDelete) return;
        const entry = entryToDelete;
        const result = isGuest(entry) ? await deleteGuest(entry.id) : await deleteUser(entry.id);
        if (result.success) {
            setEntries((current) => current.filter((currentEntry) => currentEntry.id !== entry.id));
            setEntryToDelete(null);
        }
    };

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('guests.title')}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('guests.desc')}</p>
            </div>

            {formError && (
                <Alert variant="destructive">
                    <AlertTitle>{t('auth.loginErrorTitle')}</AlertTitle>
                    <AlertDescription className="flex items-center justify-between gap-3">
                        <span>{formError}</span>
                        <Button variant="ghost" size="sm" onClick={clearAllErrors}>✕</Button>
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800">
                <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition-colors ${
                        activeTab === 'list'
                            ? 'border-accent-500 text-accent-600 dark:text-accent-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <Users className="size-4" />
                    {t('guests.tabList')}
                </button>
                <button
                    type="button"
                    onClick={() => { setActiveTab('create'); clearAllErrors(); }}
                    className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition-colors ${
                        activeTab === 'create'
                            ? 'border-accent-500 text-accent-600 dark:text-accent-400'
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
                                <Button onClick={handleSearch} disabled={isBusy}>
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
                                        <TableCell>{entry.email || '—'}</TableCell>
                                        <TableCell>{t(`userManager.roles.${entry.role}`, { defaultValue: entry.role })}</TableCell>
                                        {isAdmin && (
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setEditingEntry(entry);
                                                            setEditForm({ ...entry });
                                                            setPromoteGuestAccount(false);
                                                            setPromotePassword('');
                                                            setPromoteRole('user');
                                                            setShowPromotePassword(false);
                                                            clearAllErrors();
                                                        }}
                                                    >
                                                        {t('guests.edit')}
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => setEntryToDelete(entry)}
                                                    >
                                                        {t('guests.delete')}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={isAdmin ? 5 : 4} className="py-10 text-center text-slate-400">
                                            {isBusy ? t('userManager.loading') : t('guests.noResults')}
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
                                <Button type="submit" disabled={isBusy || !createForm.firstName.trim()}>
                                    {isBusy ? t('guests.saving') : t('guests.save')}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Dialog
                open={Boolean(editingEntry && editForm)}
                onOpenChange={(open) => {
                    if (!open) {
                        closeEditDialog();
                    }
                }}
            >
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
                                    required={Boolean(editingEntry && isGuest(editingEntry) && promoteGuestAccount)}
                                />
                            </div>
                            {editingEntry && isGuest(editingEntry) && (
                                <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                                    <label className="flex items-start gap-3 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={promoteGuestAccount}
                                            onChange={(event) => {
                                                const checked = event.target.checked;
                                                setPromoteGuestAccount(checked);
                                                if (checked && editForm.email?.endsWith(LEGACY_IMPORT_EMAIL_DOMAIN)) {
                                                    setEditForm((current) => current ? { ...current, email: '' } : current);
                                                }
                                            }}
                                            className="mt-1 size-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
                                        />
                                        <span>
                                            <span className="block font-medium text-slate-900 dark:text-white">
                                                {t('guests.promoteToUser')}
                                            </span>
                                            <span className="block text-xs text-slate-500 dark:text-slate-400">
                                                {t('guests.promoteDesc')}
                                            </span>
                                        </span>
                                    </label>
                                    {promoteGuestAccount && (
                                        <div className="space-y-3">
                                            <div className="space-y-2">
                                                <Label htmlFor="promote-guest-role">{t('userManager.thRole')}</Label>
                                                <Select
                                                    value={promoteRole}
                                                    onValueChange={(role) => setPromoteRole(role as PromotedGuestRole)}
                                                >
                                                    <SelectTrigger id="promote-guest-role">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {PROMOTED_GUEST_ROLES.map((role) => (
                                                            <SelectItem key={role} value={role}>
                                                                {t(`userManager.roles.${role}`)}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="promote-guest-password">{t('guests.promotePassword')}</Label>
                                                <div className="relative">
                                                    <Input
                                                        id="promote-guest-password"
                                                        type={showPromotePassword ? 'text' : 'password'}
                                                        value={promotePassword}
                                                        onChange={(event) => setPromotePassword(event.target.value)}
                                                        minLength={8}
                                                        required
                                                        className="pr-10"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        className="absolute right-1 top-1/2 -translate-y-1/2"
                                                        onClick={() => setShowPromotePassword((current) => !current)}
                                                        aria-label={showPromotePassword ? t('auth.hidePassword') : t('auth.showPassword')}
                                                    >
                                                        {showPromotePassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={closeEditDialog}
                                >
                                    {t('guests.cancel')}
                                </Button>
                                <Button type="submit" disabled={isBusy}>
                                    {isBusy ? t('guests.saving') : t('userManager.save')}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
            <Dialog open={Boolean(entryToDelete)} onOpenChange={(open) => !open && setEntryToDelete(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{t('guests.delete')}</DialogTitle>
                        <DialogDescription>
                            {entryToDelete && t('guests.deleteConfirm', { name: getEntryName(entryToDelete) })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEntryToDelete(null)}>
                            {t('guests.cancel')}
                        </Button>
                        <Button variant="destructive" onClick={() => void confirmDelete()}>
                            {t('guests.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
