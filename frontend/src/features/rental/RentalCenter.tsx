import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AppUser, InventoryItem } from '@/types';
import { useInventory } from '../inventory/useInventory';
import { type Guest, useGuests } from '../guests/useGuests';
import { type Loan, type LoanStatus, useLoans } from './useLoans';

type RentalCenterProps = {
    user: AppUser;
};

const STATUS_VARIANT: Record<LoanStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'secondary',
    approved: 'default',
    denied: 'destructive',
    loaned: 'default',
    returned: 'outline',
};

export default function RentalCenter({ user }: RentalCenterProps) {
    const { t } = useTranslation();
    const { listItems, isLoading: itemsLoading } = useInventory();
    const { listLoans, createLoan, createExternalLoan, approveLoan, denyLoan, activateLoan, returnLoan, isLoading: loansLoading, error, clearError } = useLoans();
    const { browseUsers } = useGuests();

    const [loans, setLoans] = useState<Loan[]>([]);
    const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
    const [guests, setGuests] = useState<Guest[]>([]);

    // Borrow dialog state
    const [isBorrowDialogOpen, setIsBorrowDialogOpen] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [loanPurpose, setLoanPurpose] = useState('');

    // External rental dialog state
    const [isExternalDialogOpen, setIsExternalDialogOpen] = useState(false);
    const [externalItemId, setExternalItemId] = useState('');
    const [externalDueDate, setExternalDueDate] = useState('');
    const [externalPurpose, setExternalPurpose] = useState('');
    const [externalGuestId, setExternalGuestId] = useState('');
    const [guestSearch, setGuestSearch] = useState('');

    // Return/deny dialog state
    const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
    const [actionLoan, setActionLoan] = useState<Loan | null>(null);
    const [actionType, setActionType] = useState<'deny' | 'return' | null>(null);
    const [actionComment, setActionComment] = useState('');

    const isLoading = itemsLoading || loansLoading;
    const isOwnerOrAdmin = user.role === 'admin' || user.role === 'user';
    const userId = Number(user.id);

    const refresh = useCallback(async () => {
        const [loansResult, itemsResult] = await Promise.all([
            listLoans(),
            listItems({ status: 'available', limit: 100 }),
        ]);
        if (loansResult.success) setLoans(loansResult.loans);
        if (itemsResult.success) setAvailableItems(itemsResult.items);
    }, [listLoans, listItems]);

    const refreshGuests = useCallback(async (search?: string) => {
        const result = await browseUsers({ search, limit: 100 });
        if (result.success) {
            const entries = result.entries as (Guest | { role: string })[];
            setGuests(entries.filter((e): e is Guest => e.role === 'guest'));
        }
    }, [browseUsers]);

    useEffect(() => { void refresh(); }, [refresh]);

    const myLoans = useMemo(() =>
        loans.filter((l) => l.borrower?.id === userId),
        [loans, userId],
    );

    const pendingOnMyItems = useMemo(() =>
        loans.filter((l) => l.item.owner.id === userId && l.status === 'pending'),
        [loans, userId],
    );

    const approvedOnMyItems = useMemo(() =>
        loans.filter((l) => l.item.owner.id === userId && l.status === 'approved'),
        [loans, userId],
    );

    const activeOnMyItems = useMemo(() =>
        loans.filter((l) => l.item.owner.id === userId && l.status === 'loaned'),
        [loans, userId],
    );

    const filteredGuests = useMemo(() =>
        guests.filter((g) => {
            const q = guestSearch.toLowerCase();
            return !q || `${g.firstName} ${g.lastName} ${g.email}`.toLowerCase().includes(q);
        }),
        [guests, guestSearch],
    );

    const handleOpenBorrow = () => {
        setSelectedItemId(availableItems[0] ? String(availableItems[0].id) : '');
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        setDueDate(nextWeek ?? '');
        setLoanPurpose('');
        setIsBorrowDialogOpen(true);
    };

    const handleSubmitBorrow = async () => {
        if (!selectedItemId || !dueDate || !loanPurpose.trim()) return;
        const result = await createLoan({
            item_id: selectedItemId,
            declared_return_date: new Date(dueDate).toISOString(),
            loan_purpose: loanPurpose.trim(),
        });
        if (result.success) {
            setIsBorrowDialogOpen(false);
            void refresh();
        }
    };

    const handleOpenExternal = async () => {
        await refreshGuests();
        const ownedAvailable = availableItems.filter((item) => item.ownerId === userId);
        setExternalItemId(ownedAvailable[0] ? String(ownedAvailable[0].id) : '');
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        setExternalDueDate(nextWeek ?? '');
        setExternalPurpose('');
        setExternalGuestId('');
        setGuestSearch('');
        setIsExternalDialogOpen(true);
    };

    const handleSubmitExternal = async () => {
        if (!externalItemId || !externalDueDate || !externalPurpose.trim() || !externalGuestId) return;
        const result = await createExternalLoan({
            item_id: externalItemId,
            guest_id: Number(externalGuestId),
            declared_return_date: new Date(externalDueDate).toISOString(),
            loan_purpose: externalPurpose.trim(),
        });
        if (result.success) {
            setIsExternalDialogOpen(false);
            void refresh();
        }
    };

    const handleApprove = async (loan: Loan) => {
        const result = await approveLoan(loan.id);
        if (result.success) void refresh();
    };

    const handleActivate = async (loan: Loan) => {
        const result = await activateLoan(loan.id);
        if (result.success) void refresh();
    };

    const openActionDialog = (loan: Loan, type: 'deny' | 'return') => {
        setActionLoan(loan);
        setActionType(type);
        setActionComment('');
        setIsActionDialogOpen(true);
    };

    const handleConfirmAction = async () => {
        if (!actionLoan || !actionType) return;
        const result = actionType === 'deny'
            ? await denyLoan(actionLoan.id, actionComment || undefined)
            : await returnLoan(actionLoan.id, actionComment || undefined);
        if (result.success) {
            setIsActionDialogOpen(false);
            void refresh();
        }
    };

    const statusLabel = (s: LoanStatus) => t(`rentalCenter.statuses.${s}`, { defaultValue: s });
    const formatDate = (d: string) => new Date(d).toLocaleDateString();

    const ownedAvailableItems = availableItems.filter((i) => i.ownerId === userId);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.loans')}</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('rentalCenter.subtitle', { defaultValue: 'Zarządzaj wnioskami o wypożyczenie sprzętu' })}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={isLoading}>
                        <span className={isLoading ? 'inline-block animate-spin' : ''} aria-hidden="true">↻</span>
                    </Button>
                    {isOwnerOrAdmin && (
                        <Button variant="secondary" size="sm" onClick={() => void handleOpenExternal()}>
                            {t('rentalCenter.externalRent', { defaultValue: 'Wypożycz dla gościa' })}
                        </Button>
                    )}
                    <Button onClick={handleOpenBorrow} disabled={availableItems.length === 0}>
                        + {t('rentalCenter.openRequestForm', { defaultValue: 'Złóż wniosek' })}
                    </Button>
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <span aria-hidden="true">⚠</span>
                    <AlertTitle>{t('auth.loginErrorTitle')}</AlertTitle>
                    <AlertDescription className="flex items-center justify-between gap-3">
                        <span>{error}</span>
                        <Button variant="ghost" size="sm" onClick={clearError}>✕</Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* Owner sections */}
            {isOwnerOrAdmin && pendingOnMyItems.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">{t('rentalCenter.pendingApprovals', { defaultValue: 'Oczekujące wnioski' })}</CardTitle>
                        <CardDescription className="text-xs">{pendingOnMyItems.length} {t('rentalCenter.pendingCount', { defaultValue: 'wniosków do zatwierdzenia' })}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {pendingOnMyItems.map((loan) => (
                            <div key={loan.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium text-slate-900 dark:text-white">{loan.item.name}</div>
                                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {t('rentalCenter.borrower', { defaultValue: 'Wnioskujący' })}: <span className="font-medium">{loan.borrower?.name ?? '—'}</span>
                                        {' · '}{t('rentalCenter.dueDate', { defaultValue: 'Data zwrotu' })}: {formatDate(loan.declared_return_date)}
                                    </div>
                                    {loan.loan_purpose && (
                                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            {t('rentalCenter.purpose', { defaultValue: 'Cel' })}: {loan.loan_purpose}
                                        </div>
                                    )}
                                </div>
                                <div className="ml-4 flex shrink-0 gap-2">
                                    <Button size="sm" onClick={() => void handleApprove(loan)} disabled={isLoading}>
                                        {t('rentalCenter.approve', { defaultValue: 'Zatwierdź' })}
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => openActionDialog(loan, 'deny')} disabled={isLoading}>
                                        {t('rentalCenter.deny', { defaultValue: 'Odrzuć' })}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {isOwnerOrAdmin && approvedOnMyItems.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">{t('rentalCenter.awaitingHandover', { defaultValue: 'Oczekujące na wydanie' })}</CardTitle>
                        <CardDescription className="text-xs">{approvedOnMyItems.length} {t('rentalCenter.handoverCount', { defaultValue: 'do wydania' })}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {approvedOnMyItems.map((loan) => (
                            <div key={loan.id} className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium text-slate-900 dark:text-white">{loan.item.name}</div>
                                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {loan.borrower?.name ?? '—'} · {t('rentalCenter.dueDate', { defaultValue: 'Data zwrotu' })}: {formatDate(loan.declared_return_date)}
                                    </div>
                                </div>
                                <div className="ml-4 shrink-0">
                                    <Button size="sm" onClick={() => void handleActivate(loan)} disabled={isLoading}>
                                        {t('rentalCenter.confirmHandover', { defaultValue: 'Potwierdź wydanie' })}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {isOwnerOrAdmin && activeOnMyItems.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">{t('rentalCenter.activeLoans', { defaultValue: 'Aktywne wypożyczenia' })}</CardTitle>
                        <CardDescription className="text-xs">{activeOnMyItems.length} {t('rentalCenter.activeCount', { defaultValue: 'w terenie' })}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {activeOnMyItems.map((loan) => (
                            <div key={loan.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium text-slate-900 dark:text-white">{loan.item.name}</div>
                                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {loan.is_external ? t('rentalCenter.guest', { defaultValue: 'Gość' }) : ''} {loan.borrower?.name ?? '—'}
                                        {' · '}{t('rentalCenter.dueDate', { defaultValue: 'Data zwrotu' })}: {formatDate(loan.declared_return_date)}
                                    </div>
                                </div>
                                <div className="ml-4 shrink-0">
                                    <Button size="sm" variant="outline" onClick={() => openActionDialog(loan, 'return')} disabled={isLoading}>
                                        {t('rentalCenter.confirmReturn', { defaultValue: 'Potwierdź zwrot' })}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* My requests */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">{t('rentalCenter.myRequests', { defaultValue: 'Moje wnioski' })}</CardTitle>
                    <CardDescription className="text-xs">{myLoans.length} {t('rentalCenter.requests', { defaultValue: 'wniosków' })}</CardDescription>
                </CardHeader>
                <CardContent>
                    {myLoans.length > 0 ? (
                        <div className="space-y-3">
                            {myLoans.map((loan) => (
                                <div key={loan.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium text-slate-900 dark:text-white">{loan.item.name}</div>
                                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                            <span>{t('rentalCenter.dueDate', { defaultValue: 'Data zwrotu' })}: {formatDate(loan.declared_return_date)}</span>
                                            <span>{t('rentalCenter.requested', { defaultValue: 'Złożono' })}: {formatDate(loan.created_at)}</span>
                                        </div>
                                        {loan.loan_purpose && (
                                            <div className="mt-1 text-xs text-slate-400">{loan.loan_purpose}</div>
                                        )}
                                    </div>
                                    <div className="ml-4 flex shrink-0 items-center gap-3">
                                        <Badge variant={STATUS_VARIANT[loan.status]} className="whitespace-nowrap text-[10px]">
                                            {statusLabel(loan.status)}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-8 text-center text-slate-400">{t('rentalCenter.noRequests', { defaultValue: 'Brak wniosków' })}</div>
                    )}
                </CardContent>
            </Card>

            {/* Borrow dialog */}
            <Dialog open={isBorrowDialogOpen} onOpenChange={(open) => !open && setIsBorrowDialogOpen(false)}>
                <DialogContent className="max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>{t('rentalCenter.requestTitle', { defaultValue: 'Nowy wniosek o wypożyczenie' })}</DialogTitle>
                        <DialogDescription>{t('rentalCenter.requestInfo', { defaultValue: 'Wniosek trafi do właściciela sprzętu do zatwierdzenia.' })}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="borrow-item">{t('rentalCenter.itemLabel', { defaultValue: 'Sprzęt' })}</Label>
                            <select
                                id="borrow-item"
                                value={selectedItemId}
                                onChange={(e) => setSelectedItemId(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            >
                                <option value="">{t('rentalCenter.itemPlaceholder', { defaultValue: 'Wybierz sprzęt' })}</option>
                                {availableItems.map((item) => (
                                    <option key={item.id} value={String(item.id)}>
                                        {item.name}{item.category ? ` — ${item.category}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="borrow-date">{t('rentalCenter.selectDueDate', { defaultValue: 'Planowana data zwrotu' })}</Label>
                            <Input
                                id="borrow-date"
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="borrow-purpose">{t('rentalCenter.purposeLabel', { defaultValue: 'Cel wypożyczenia' })}</Label>
                            <Textarea
                                id="borrow-purpose"
                                value={loanPurpose}
                                onChange={(e) => setLoanPurpose(e.target.value)}
                                placeholder={t('rentalCenter.purposePlaceholder', { defaultValue: 'Opisz cel wypożyczenia...' })}
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBorrowDialogOpen(false)} disabled={isLoading}>
                            {t('rentalCenter.cancel', { defaultValue: 'Anuluj' })}
                        </Button>
                        <Button
                            onClick={() => void handleSubmitBorrow()}
                            disabled={isLoading || !selectedItemId || !dueDate || !loanPurpose.trim()}
                        >
                            {isLoading ? t('rentalCenter.submitting', { defaultValue: 'Wysyłanie...' }) : t('rentalCenter.submitRequest', { defaultValue: 'Złóż wniosek' })}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* External rental dialog */}
            <Dialog open={isExternalDialogOpen} onOpenChange={(open) => !open && setIsExternalDialogOpen(false)}>
                <DialogContent className="max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>{t('rentalCenter.externalRentTitle', { defaultValue: 'Wypożyczenie dla gościa' })}</DialogTitle>
                        <DialogDescription>{t('rentalCenter.externalRentDesc', { defaultValue: 'Wydaj przedmiot bezpośrednio gościowi zewnętrznemu.' })}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="ext-item">{t('rentalCenter.itemLabel', { defaultValue: 'Sprzęt' })}</Label>
                            <select
                                id="ext-item"
                                value={externalItemId}
                                onChange={(e) => setExternalItemId(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            >
                                <option value="">{t('rentalCenter.itemPlaceholder', { defaultValue: 'Wybierz sprzęt' })}</option>
                                {ownedAvailableItems.map((item) => (
                                    <option key={item.id} value={String(item.id)}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                            {ownedAvailableItems.length === 0 && (
                                <p className="text-xs text-slate-400">{t('rentalCenter.noOwnedAvailable', { defaultValue: 'Brak dostępnych przedmiotów, których jesteś właścicielem.' })}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>{t('rentalCenter.guestLabel', { defaultValue: 'Gość' })}</Label>
                            <Input
                                placeholder={t('rentalCenter.guestSearch', { defaultValue: 'Szukaj gościa...' })}
                                value={guestSearch}
                                onChange={(e) => {
                                    setGuestSearch(e.target.value);
                                    void refreshGuests(e.target.value);
                                }}
                            />
                            <select
                                value={externalGuestId}
                                onChange={(e) => setExternalGuestId(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            >
                                <option value="">{t('rentalCenter.guestPlaceholder', { defaultValue: 'Wybierz gościa' })}</option>
                                {filteredGuests.map((g) => (
                                    <option key={g.id} value={String(g.id)}>
                                        {`${g.firstName} ${g.lastName}`.trim() || g.email}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ext-date">{t('rentalCenter.selectDueDate', { defaultValue: 'Planowana data zwrotu' })}</Label>
                            <Input
                                id="ext-date"
                                type="date"
                                value={externalDueDate}
                                onChange={(e) => setExternalDueDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ext-purpose">{t('rentalCenter.purposeLabel', { defaultValue: 'Cel wypożyczenia' })}</Label>
                            <Textarea
                                id="ext-purpose"
                                value={externalPurpose}
                                onChange={(e) => setExternalPurpose(e.target.value)}
                                placeholder={t('rentalCenter.purposePlaceholder', { defaultValue: 'Opisz cel wypożyczenia...' })}
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsExternalDialogOpen(false)} disabled={isLoading}>
                            {t('rentalCenter.cancel', { defaultValue: 'Anuluj' })}
                        </Button>
                        <Button
                            onClick={() => void handleSubmitExternal()}
                            disabled={isLoading || !externalItemId || !externalDueDate || !externalPurpose.trim() || !externalGuestId}
                        >
                            {isLoading ? t('rentalCenter.submitting', { defaultValue: 'Wysyłanie...' }) : t('rentalCenter.confirmHandoverBtn', { defaultValue: 'Wypożycz' })}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Deny / Return comment dialog */}
            <Dialog open={isActionDialogOpen} onOpenChange={(open) => !open && setIsActionDialogOpen(false)}>
                <DialogContent className="max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>
                            {actionType === 'deny'
                                ? t('rentalCenter.denyTitle', { defaultValue: 'Odrzuć wniosek' })
                                : t('rentalCenter.returnTitle', { defaultValue: 'Potwierdź zwrot' })}
                        </DialogTitle>
                        <DialogDescription>
                            {actionLoan?.item.name}
                            {actionType === 'return' && (
                                <span className="ml-1 text-xs">
                                    — {t('rentalCenter.returnIssueHint', { defaultValue: 'Opcjonalnie opisz problem ze zwrotem.' })}
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="action-comment">
                            {actionType === 'deny'
                                ? t('rentalCenter.denyComment', { defaultValue: 'Komentarz (opcjonalnie)' })
                                : t('rentalCenter.returnComment', { defaultValue: 'Uwagi dotyczące zwrotu (opcjonalnie)' })}
                        </Label>
                        <Textarea
                            id="action-comment"
                            value={actionComment}
                            onChange={(e) => setActionComment(e.target.value)}
                            placeholder={actionType === 'return' ? t('rentalCenter.returnIssuePlaceholder', { defaultValue: 'np. uszkodzony kabel...' }) : ''}
                            rows={2}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsActionDialogOpen(false)} disabled={isLoading}>
                            {t('rentalCenter.cancel', { defaultValue: 'Anuluj' })}
                        </Button>
                        <Button
                            variant={actionType === 'deny' ? 'destructive' : 'default'}
                            onClick={() => void handleConfirmAction()}
                            disabled={isLoading}
                        >
                            {isLoading
                                ? t('rentalCenter.submitting', { defaultValue: 'Wysyłanie...' })
                                : actionType === 'deny'
                                    ? t('rentalCenter.deny', { defaultValue: 'Odrzuć' })
                                    : t('rentalCenter.confirmReturn', { defaultValue: 'Potwierdź zwrot' })}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
