import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, RefreshCw, Search, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUsers } from './useUsers';

const ROLE_OPTIONS = ['admin', 'user', 'observer'];
const APPROVAL_ROLE_OPTIONS = ['user', 'observer'];
const STATUS_OPTIONS = ['active', 'pending_approval', 'inactive'];

type ManagedUser = {
    id: string | number;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    status: string;
};

const getUserName = (user: ManagedUser) => `${user.firstName} ${user.lastName}`.trim();

export default function UserManager({ onPendingCountChange }: { onPendingCountChange?: (count: number) => void }) {
    const { t } = useTranslation();
    const { listUsers, updateUser, deleteUser, isLoading, error, clearError } = useUsers();
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [filters, setFilters] = useState({ search: '', role: 'all', status: 'all', page: 1, limit: 20 });
    const [approvalRoles, setApprovalRoles] = useState<Record<string, string>>({});
    const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
    const [editForm, setEditForm] = useState<ManagedUser | null>(null);
    const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);

    const pendingCount = useMemo(() => users.filter((user) => user.status === 'pending_approval').length, [users]);
    const totalPages = Math.max(Math.ceil(totalCount / filters.limit), 1);

    useEffect(() => onPendingCountChange?.(pendingCount), [onPendingCountChange, pendingCount]);

    const refreshUsers = useCallback(async () => {
        const result = await listUsers(filters);
        if (result.success) {
            setUsers(result.users);
            setTotalCount(result.totalCount);
        }
    }, [filters, listUsers]);

    useEffect(() => {
        void refreshUsers();
    }, [filters.role, filters.status, filters.page, filters.limit, refreshUsers]);

    const patchUser = (updatedUser: ManagedUser) => {
        setUsers((current) => current.map((user) => user.id === updatedUser.id ? updatedUser : user));
    };

    const handleApprove = async (user: ManagedUser) => {
        const result = await updateUser(user.id, { ...user, role: approvalRoles[String(user.id)] ?? 'user', status: 'active' });
        if (result.success && result.user) patchUser(result.user);
    };

    const handleDeactivate = async (user: ManagedUser) => {
        const result = await updateUser(user.id, { ...user, status: 'inactive' });
        if (result.success && result.user) patchUser(result.user);
    };

    const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editingUser || !editForm) return;
        const result = await updateUser(editingUser.id, editForm);
        if (result.success && result.user) {
            patchUser(result.user);
            setEditingUser(null);
            setEditForm(null);
        }
    };

    const confirmDelete = async () => {
        if (!userToDelete) return;
        const result = await deleteUser(userToDelete.id);
        if (result.success) {
            setUsers((current) => current.filter((user) => user.id !== userToDelete.id));
            setTotalCount((current) => Math.max(current - 1, 0));
            setUserToDelete(null);
        }
    };

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard title={t('userManager.totalUsers')} value={totalCount} icon={Users} />
                <StatCard title={t('userManager.pendingUsers')} value={pendingCount} icon={UserCheck} className="text-amber-600 dark:text-amber-400" />
                <StatCard title={t('userManager.activeUsers')} value={users.filter((user) => user.status === 'active').length} icon={UserCheck} className="text-emerald-600 dark:text-emerald-400" />
                <StatCard title={t('userManager.adminUsers')} value={users.filter((user) => user.role === 'admin').length} icon={ShieldCheck} className="text-blue-600 dark:text-blue-400" />
            </div>

            <Card>
                <CardContent className="space-y-4 p-4">
                    <form onSubmit={(event) => { event.preventDefault(); setFilters((current) => ({ ...current, page: 1 })); void refreshUsers(); }} className="flex flex-col gap-3 lg:flex-row">
                        <div className="relative flex-1">
                            <Label htmlFor="user-search" className="sr-only">{t('userManager.searchPlaceholder')}</Label>
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                            <Input id="user-search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder={t('userManager.searchPlaceholder')} className="pl-9" />
                        </div>
                        <div className="space-y-2 lg:contents">
                            <Label htmlFor="user-filter-role" className="sr-only">{t('userManager.thRole')}</Label>
                            <Select value={filters.role} onValueChange={(role) => setFilters((current) => ({ ...current, role, page: 1 }))}>
                                <SelectTrigger id="user-filter-role" className="lg:w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('userManager.allRoles')}</SelectItem>
                                {ROLE_OPTIONS.map((role) => <SelectItem key={role} value={role}>{t(`userManager.roles.${role}`)}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        </div>
                        <div className="space-y-2 lg:contents">
                            <Label htmlFor="user-filter-status" className="sr-only">{t('userManager.thStatus')}</Label>
                            <Select value={filters.status} onValueChange={(status) => setFilters((current) => ({ ...current, status, page: 1 }))}>
                                <SelectTrigger id="user-filter-status" className="lg:w-48"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('userManager.allStatuses')}</SelectItem>
                                {STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{t(`userManager.statuses.${status}`)}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        </div>
                        <Button type="submit" variant="secondary" disabled={isLoading}><Search />{t('userManager.search')}</Button>
                        <Button type="button" onClick={() => void refreshUsers()} disabled={isLoading}><RefreshCw className={isLoading ? 'animate-spin' : ''} />{t('userManager.refresh')}</Button>
                    </form>
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle />
                            <AlertTitle>{t('auth.loginErrorTitle')}</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                            <Button variant="ghost" size="icon-sm" className="absolute right-2 top-2" onClick={clearError} aria-label={t('a11y.dismiss')}><span aria-hidden="true">×</span></Button>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            <Card className="overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/80 dark:bg-slate-900/50">
                            <TableHead>{t('userManager.thUser')}</TableHead>
                            <TableHead>{t('userManager.thRole')}</TableHead>
                            <TableHead>{t('userManager.thStatus')}</TableHead>
                            <TableHead className="text-right">{t('userManager.thActions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.length > 0 ? users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <div className="font-medium">{getUserName(user) || t('userManager.unnamedUser')}</div>
                                    <div className="text-xs text-slate-400">{user.email}</div>
                                    <div className="font-mono text-[10px] text-slate-400">ID: {user.id}</div>
                                </TableCell>
                                <TableCell className="text-slate-600 dark:text-slate-400">{t(`userManager.roles.${user.role}`)}</TableCell>
                                <TableCell><StatusBadge status={user.status} label={t(`userManager.statuses.${user.status}`)} /></TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap justify-end gap-2">
                                        {user.status === 'pending_approval' && (
                                            <>
                                                <Select value={approvalRoles[String(user.id)] ?? 'user'} onValueChange={(role) => setApprovalRoles((current) => ({ ...current, [String(user.id)]: role }))}>
                                                    <SelectTrigger id={`approval-role-${user.id}`} className="h-8 w-32" aria-label={t('userManager.approvalRoleFor', { name: getUserName(user) || user.email })}><SelectValue /></SelectTrigger>
                                                    <SelectContent>{APPROVAL_ROLE_OPTIONS.map((role) => <SelectItem key={role} value={role}>{t(`userManager.roles.${role}`)}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <Button size="sm" onClick={() => void handleApprove(user)}>{t('userManager.approve')}</Button>
                                            </>
                                        )}
                                        {user.status !== 'inactive' && <Button variant="warning" size="sm" onClick={() => void handleDeactivate(user)}>{t('userManager.deactivate')}</Button>}
                                        <Button variant="secondary" size="sm" onClick={() => { setEditingUser(user); setEditForm({ ...user }); clearError(); }}>{t('userManager.edit')}</Button>
                                        <Button variant="destructive" size="sm" onClick={() => setUserToDelete(user)}>{t('userManager.delete')}</Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={4} className="py-10 text-center text-slate-400">{isLoading ? t('userManager.loading') : t('userManager.noResults')}</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>

            <div className="flex items-center justify-between text-xs text-slate-500">
                <Button variant="outline" size="sm" onClick={() => setFilters((current) => ({ ...current, page: Math.max(current.page - 1, 1) }))} disabled={filters.page <= 1 || isLoading}>{t('userManager.prev')}</Button>
                <span>{t('userManager.pageInfo', { page: filters.page, total: totalPages })}</span>
                <Button variant="outline" size="sm" onClick={() => setFilters((current) => ({ ...current, page: Math.min(current.page + 1, totalPages) }))} disabled={filters.page >= totalPages || isLoading}>{t('userManager.next')}</Button>
            </div>

            <Dialog open={Boolean(editingUser && editForm)} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader><DialogTitle>{t('userManager.editTitle')}</DialogTitle></DialogHeader>
                    {editForm && (
                        <form id="edit-user-form" onSubmit={handleSaveEdit} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2"><Label htmlFor="edit-user-first-name">{t('userManager.firstName')}</Label><Input id="edit-user-first-name" value={editForm.firstName} onChange={(event) => setEditForm({ ...editForm, firstName: event.target.value })} required /></div>
                                <div className="space-y-2"><Label htmlFor="edit-user-last-name">{t('userManager.lastName')}</Label><Input id="edit-user-last-name" value={editForm.lastName} onChange={(event) => setEditForm({ ...editForm, lastName: event.target.value })} required /></div>
                            </div>
                            <div className="space-y-2"><Label htmlFor="edit-user-email">{t('userManager.email')}</Label><Input id="edit-user-email" type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} required /></div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-user-role">{t('userManager.thRole')}</Label>
                                    <Select value={editForm.role} onValueChange={(role) => setEditForm({ ...editForm, role })}><SelectTrigger id="edit-user-role"><SelectValue /></SelectTrigger><SelectContent>{ROLE_OPTIONS.map((role) => <SelectItem key={role} value={role}>{t(`userManager.roles.${role}`)}</SelectItem>)}</SelectContent></Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-user-status">{t('userManager.thStatus')}</Label>
                                    <Select value={editForm.status} onValueChange={(status) => setEditForm({ ...editForm, status })}><SelectTrigger id="edit-user-status"><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{t(`userManager.statuses.${status}`)}</SelectItem>)}</SelectContent></Select>
                                </div>
                            </div>
                        </form>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingUser(null)}>{t('userManager.cancel')}</Button>
                        <Button type="submit" form="edit-user-form" disabled={isLoading}>{isLoading ? t('userManager.saving') : t('userManager.save')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(userToDelete)} onOpenChange={(open) => !open && setUserToDelete(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{t('userManager.delete')}</DialogTitle>
                        <DialogDescription>{userToDelete && t('userManager.deleteConfirm', { name: getUserName(userToDelete) || userToDelete.email })}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUserToDelete(null)}>{t('userManager.cancel')}</Button>
                        <Button variant="destructive" onClick={() => void confirmDelete()}>{t('userManager.delete')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
