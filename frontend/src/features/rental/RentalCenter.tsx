import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { AppUser, InventoryItem } from '@/types';
import { type DirectoryEntry, type Guest, getEntryName, useGuests } from '../guests/useGuests';
import ItemAttachmentsPanel from '../inventory/ItemAttachmentsPanel';
import { useItemAttachments } from '../inventory/useItemAttachments';
import { useInventory } from '../inventory/useInventory';
import { type Loan, type LoanStatus, type ReturnCondition, useLoans } from './useLoans';

type RentalCenterProps = {
    user: AppUser;
};

type TabKey = 'my' | 'owned' | 'all';
type ActionType = 'reject' | 'return' | 'confirm-return' | 'reject-return';
type StatusFilter = LoanStatus | 'all';

const LOAN_STATUSES: StatusFilter[] = ['all', 'pending_approval', 'active', 'return_pending_confirmation', 'closed', 'rejected'];

const STATUS_VARIANT: Record<LoanStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending_approval: 'secondary',
    active: 'default',
    return_pending_confirmation: 'secondary',
    closed: 'outline',
    rejected: 'destructive',
};

const CONDITION_OPTIONS: ReturnCondition[] = ['ok', 'broken', 'missing'];

const toIsoDate = (date: string) => new Date(date).toISOString();

export default function RentalCenter({ user }: RentalCenterProps) {
    const { t } = useTranslation();
    const { listItems, isLoading: itemsLoading } = useInventory();
    const {
        listLoans,
        createLoan,
        createExternalLoan,
        approveLoan,
        rejectLoan,
        returnLoan,
        confirmReturn,
        isLoading: loansLoading,
        error,
        clearError,
    } = useLoans();
    const { browseUsers, createGuest } = useGuests();

    const [activeTab, setActiveTab] = useState<TabKey>('my');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [myLoans, setMyLoans] = useState<Loan[]>([]);
    const [ownedLoans, setOwnedLoans] = useState<Loan[]>([]);
    const [allLoans, setAllLoans] = useState<Loan[]>([]);
    const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
    const [guests, setGuests] = useState<Guest[]>([]);

    const [isBorrowDialogOpen, setIsBorrowDialogOpen] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [note, setNote] = useState('');

    const [isExternalDialogOpen, setIsExternalDialogOpen] = useState(false);
    const [externalItemId, setExternalItemId] = useState('');
    const [externalDueDate, setExternalDueDate] = useState('');
    const [externalNote, setExternalNote] = useState('');
    const [externalGuestId, setExternalGuestId] = useState('');
    const [guestSearch, setGuestSearch] = useState('');
    const [newGuestFirstName, setNewGuestFirstName] = useState('');
    const [newGuestLastName, setNewGuestLastName] = useState('');
    const [newGuestEmail, setNewGuestEmail] = useState('');

    const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
    const [actionLoan, setActionLoan] = useState<Loan | null>(null);
    const [actionType, setActionType] = useState<ActionType | null>(null);
    const [actionCondition, setActionCondition] = useState<ReturnCondition>('ok');
    const [actionNote, setActionNote] = useState('');
    const actionItemId = actionLoan?.item.id ?? null;
    const showActionAttachments = isActionDialogOpen && ['return', 'confirm-return', 'reject-return'].includes(actionType ?? '');
    const {
        attachments: actionAttachments,
        isLoading: isActionAttachmentsLoading,
        isUploading: isUploadingActionAttachments,
        error: actionAttachmentsError,
        handleUpload: handleActionAttachmentUpload,
        handleDownload: handleActionAttachmentDownload,
        handleDelete: handleActionAttachmentDelete,
    } = useItemAttachments(actionItemId, showActionAttachments);

    const userId = Number(user.id);
    const isAdmin = user.role === 'admin';
    const isOwnerUser = user.role === 'user' || isAdmin;
    const isLoading = itemsLoading || loansLoading;

    const refreshGuests = useCallback(async (search?: string) => {
        const result = await browseUsers({ search, limit: 100 });
        if (result.success) {
            setGuests(result.entries.filter((entry: DirectoryEntry): entry is Guest => entry.role === 'guest'));
        }
    }, [browseUsers]);

    const refresh = useCallback(async () => {
        const [myResult, ownedResult, allResult, itemsResult] = await Promise.all([
            listLoans({ scope: 'my', status: statusFilter }),
            isOwnerUser ? listLoans({ scope: 'owned', status: statusFilter }) : Promise.resolve({ success: true, loans: [] as Loan[] }),
            isAdmin ? listLoans({ scope: 'all', status: statusFilter }) : Promise.resolve({ success: true, loans: [] as Loan[] }),
            listItems({ status: 'available', limit: 100 }),
        ]);

        if (myResult.success) setMyLoans(myResult.loans);
        if (ownedResult.success) setOwnedLoans(ownedResult.loans);
        if (allResult.success) setAllLoans(allResult.loans);
        if (itemsResult.success) setAvailableItems(itemsResult.items);
    }, [isAdmin, isOwnerUser, listItems, listLoans, statusFilter]);

    useEffect(() => { void refresh(); }, [refresh]);

    const currentLoans = activeTab === 'owned' ? ownedLoans : activeTab === 'all' ? allLoans : myLoans;
    const borrowableAvailableItems = useMemo(
        () => availableItems.filter((item) => item.ownerId !== userId),
        [availableItems, userId],
    );
    const ownedAvailableItems = useMemo(() => availableItems.filter((item) => item.ownerId === userId), [availableItems, userId]);
    const filteredGuests = useMemo(() => {
        const query = guestSearch.toLowerCase();
        return guests.filter((guest) => !query || `${guest.firstName} ${guest.lastName} ${guest.email}`.toLowerCase().includes(query));
    }, [guests, guestSearch]);

    const nextWeek = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? '';
    const statusLabel = (status: StatusFilter) => t(`rentalCenter.statuses.${status}`, { defaultValue: status });
    const conditionLabel = (condition: ReturnCondition) => t(`rentalCenter.conditions.${condition}`, { defaultValue: condition });
    const formatDate = (date: string | null) => date ? new Date(date).toLocaleDateString() : '-';
    const loanNote = (loan: Loan) => loan.note;
    const borrowerName = (loan: Loan) => loan.borrower?.name ?? '-';

    const openBorrowDialog = () => {
        setSelectedItemId(borrowableAvailableItems[0] ? String(borrowableAvailableItems[0].id) : '');
        setDueDate(nextWeek());
        setNote('');
        setIsBorrowDialogOpen(true);
    };

    const submitBorrow = async () => {
        if (!selectedItemId || !dueDate) return;
        const result = await createLoan({
            item_id: selectedItemId,
            declared_return_date: toIsoDate(dueDate),
            note: note.trim() || undefined,
        });
        if (result.success) {
            setIsBorrowDialogOpen(false);
            void refresh();
        }
    };

    const openExternalDialog = async () => {
        await refreshGuests();
        setExternalItemId(ownedAvailableItems[0] ? String(ownedAvailableItems[0].id) : '');
        setExternalDueDate(nextWeek());
        setExternalNote('');
        setExternalGuestId('');
        setGuestSearch('');
        setNewGuestFirstName('');
        setNewGuestLastName('');
        setNewGuestEmail('');
        setIsExternalDialogOpen(true);
    };

    const submitNewGuest = async () => {
        if (!newGuestFirstName.trim()) return;
        const result = await createGuest({
            firstName: newGuestFirstName.trim(),
            lastName: newGuestLastName.trim(),
            email: newGuestEmail.trim(),
        });
        if (result.success && result.guest) {
            setGuests((current) => [result.guest, ...current.filter((guest) => guest.id !== result.guest.id)]);
            setExternalGuestId(String(result.guest.id));
            setNewGuestFirstName('');
            setNewGuestLastName('');
            setNewGuestEmail('');
        }
    };

    const submitExternal = async () => {
        if (!externalItemId || !externalDueDate || !externalGuestId) return;
        const result = await createExternalLoan({
            item_id: externalItemId,
            guest_id: Number(externalGuestId),
            declared_return_date: toIsoDate(externalDueDate),
            note: externalNote.trim() || undefined,
        });
        if (result.success) {
            setIsExternalDialogOpen(false);
            void refresh();
        }
    };

    const approve = async (loan: Loan) => {
        const result = await approveLoan(loan.id);
        if (result.success) void refresh();
    };

    const openActionDialog = (loan: Loan, type: ActionType) => {
        setActionLoan(loan);
        setActionType(type);
        setActionCondition(loan.return_condition ?? 'ok');
        setActionNote('');
        setIsActionDialogOpen(true);
    };

    const submitAction = async () => {
        if (!actionLoan || !actionType) return;
        let result;
        if (actionType === 'reject') result = await rejectLoan(actionLoan.id, actionNote.trim() || undefined);
        if (actionType === 'return') result = await returnLoan(actionLoan.id, actionCondition, actionNote.trim() || undefined);
        if (actionType === 'confirm-return') result = await confirmReturn(actionLoan.id, true, actionCondition, actionNote.trim() || undefined);
        if (actionType === 'reject-return') result = await confirmReturn(actionLoan.id, false, undefined, actionNote.trim() || undefined);

        if (result?.success) {
            setIsActionDialogOpen(false);
            void refresh();
        }
    };

    const canApprove = (loan: Loan) => activeTab !== 'my' && loan.status === 'pending_approval';
    const canReturn = (loan: Loan) => loan.status === 'active' && (activeTab === 'my' || loan.item.owner.id === userId || isAdmin);
    const canConfirmReturn = (loan: Loan) => activeTab !== 'my' && loan.status === 'return_pending_confirmation';

    const renderLoanList = (loans: Loan[]) => (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm">{t(`rentalCenter.tabs.${activeTab}`, { defaultValue: t('rentalCenter.myRequests') })}</CardTitle>
                <CardDescription className="text-xs">
                    {loans.length} {t('rentalCenter.requests', { defaultValue: 'wniosków' })}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loans.length > 0 ? (
                    <div className="space-y-3">
                        {loans.map((loan) => (
                            <div key={loan.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium text-slate-900 dark:text-white">{loan.item.name}</span>
                                        <Badge variant={STATUS_VARIANT[loan.status]} className="whitespace-nowrap text-[10px]">
                                            {statusLabel(loan.status)}
                                        </Badge>
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                        <span>{t('rentalCenter.borrower', { defaultValue: 'Wnioskujący' })}: {borrowerName(loan)}</span>
                                        <span>{t('rentalCenter.owner', { defaultValue: 'Właściciel' })}: {loan.item.owner.name}</span>
                                        <span>{t('rentalCenter.dueDate', { defaultValue: 'Data zwrotu' })}: {formatDate(loan.declared_return_date)}</span>
                                        <span>{t('rentalCenter.requested', { defaultValue: 'Złożono' })}: {formatDate(loan.created_at)}</span>
                                    </div>
                                    {loanNote(loan) && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{loanNote(loan)}</div>}
                                    {loan.return_condition && (
                                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            {t('rentalCenter.returnCondition', { defaultValue: 'Stan przy zwrocie' })}: {conditionLabel(loan.return_condition)}
                                        </div>
                                    )}
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                    {canApprove(loan) && (
                                        <>
                                            <Button size="sm" onClick={() => void approve(loan)} disabled={isLoading}>
                                                {t('rentalCenter.approve', { defaultValue: 'Zatwierdź' })}
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={() => openActionDialog(loan, 'reject')} disabled={isLoading}>
                                                {t('rentalCenter.deny', { defaultValue: 'Odrzuć' })}
                                            </Button>
                                        </>
                                    )}
                                    {canReturn(loan) && (
                                        <Button size="sm" variant="outline" onClick={() => openActionDialog(loan, 'return')} disabled={isLoading}>
                                            {activeTab === 'my' ? t('rentalCenter.reportReturn', { defaultValue: 'Zgłoś zwrot' }) : t('rentalCenter.confirmReturn', { defaultValue: 'Potwierdź zwrot' })}
                                        </Button>
                                    )}
                                    {canConfirmReturn(loan) && (
                                        <>
                                            <Button size="sm" onClick={() => openActionDialog(loan, 'confirm-return')} disabled={isLoading}>
                                                {t('rentalCenter.confirmReturn', { defaultValue: 'Potwierdź zwrot' })}
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => openActionDialog(loan, 'reject-return')} disabled={isLoading}>
                                                {t('rentalCenter.rejectReturn', { defaultValue: 'Odrzuć zwrot' })}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-8 text-center text-slate-400">{t('rentalCenter.noRequests', { defaultValue: 'Brak wniosków' })}</div>
                )}
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.loans')}</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('rentalCenter.subtitle', { defaultValue: 'Zarządzaj wnioskami o wypożyczenie sprzętu' })}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                        aria-label={t('rentalCenter.statusFilter', { defaultValue: 'Filtr statusu' })}
                    >
                        {LOAN_STATUSES.map((status) => (
                            <option key={status} value={status}>{statusLabel(status)}</option>
                        ))}
                    </select>
                    <Button variant="outline" size="icon" onClick={() => void refresh()} disabled={isLoading} aria-label={t('rentalCenter.refresh', { defaultValue: 'Odśwież' })}>
                        <RefreshCw className={isLoading ? 'size-4 animate-spin' : 'size-4'} />
                    </Button>
                    {isOwnerUser && (
                        <Button variant="secondary" onClick={() => void openExternalDialog()}>
                            {t('rentalCenter.externalRent', { defaultValue: 'Wypożycz dla gościa' })}
                        </Button>
                    )}
                    <Button onClick={openBorrowDialog} disabled={borrowableAvailableItems.length === 0}>
                        {t('rentalCenter.openRequestForm', { defaultValue: 'Złóż wniosek' })}
                    </Button>
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertTitle>{t('auth.loginErrorTitle')}</AlertTitle>
                    <AlertDescription className="flex items-center justify-between gap-3">
                        <span>{error}</span>
                        <Button variant="ghost" size="sm" onClick={clearError}>x</Button>
                    </AlertDescription>
                </Alert>
            )}

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
                <TabsList className="w-full flex-wrap justify-start h-auto">
                    <TabsTrigger value="my">{t('rentalCenter.tabs.my', { defaultValue: 'Moje wypożyczenia' })}</TabsTrigger>
                    {isOwnerUser && <TabsTrigger value="owned">{t('rentalCenter.tabs.owned', { defaultValue: 'Mój sprzęt' })}</TabsTrigger>}
                    {isAdmin && <TabsTrigger value="all">{t('rentalCenter.tabs.all', { defaultValue: 'Wszystkie' })}</TabsTrigger>}
                </TabsList>
                <TabsContent value="my">{renderLoanList(currentLoans)}</TabsContent>
                {isOwnerUser && <TabsContent value="owned">{renderLoanList(currentLoans)}</TabsContent>}
                {isAdmin && <TabsContent value="all">{renderLoanList(currentLoans)}</TabsContent>}
            </Tabs>

            <Dialog open={isBorrowDialogOpen} onOpenChange={(open) => !open && setIsBorrowDialogOpen(false)}>
                <DialogContent className="max-w-md" onOpenAutoFocus={(event) => event.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>{t('rentalCenter.requestTitle', { defaultValue: 'Nowy wniosek o wypożyczenie' })}</DialogTitle>
                        <DialogDescription>{t('rentalCenter.requestInfo', { defaultValue: 'Wniosek trafi do właściciela sprzętu do zatwierdzenia.' })}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="borrow-item">{t('rentalCenter.itemLabel', { defaultValue: 'Sprzęt' })}</Label>
                            <select id="borrow-item" value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)} className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                                <option value="">{t('rentalCenter.itemPlaceholder', { defaultValue: 'Wybierz sprzęt' })}</option>
                                {borrowableAvailableItems.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="borrow-date">{t('rentalCenter.selectDueDate', { defaultValue: 'Planowana data zwrotu' })}</Label>
                            <Input id="borrow-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} min={new Date().toISOString().split('T')[0]} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="borrow-note">{t('rentalCenter.noteLabel', { defaultValue: 'Notatka (opcjonalnie)' })}</Label>
                            <Textarea id="borrow-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBorrowDialogOpen(false)} disabled={isLoading}>{t('rentalCenter.cancel', { defaultValue: 'Anuluj' })}</Button>
                        <Button onClick={() => void submitBorrow()} disabled={isLoading || !selectedItemId || !dueDate}>
                            {isLoading ? t('rentalCenter.submitting', { defaultValue: 'Wysyłanie...' }) : t('rentalCenter.submitRequest', { defaultValue: 'Złóż wniosek' })}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isExternalDialogOpen} onOpenChange={(open) => !open && setIsExternalDialogOpen(false)}>
                <DialogContent className="max-w-lg" onOpenAutoFocus={(event) => event.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>{t('rentalCenter.externalRentTitle', { defaultValue: 'Wypożyczenie dla gościa' })}</DialogTitle>
                        <DialogDescription>{t('rentalCenter.externalRentDesc', { defaultValue: 'Wydaj przedmiot bezpośrednio gościowi zewnętrznemu.' })}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="external-item">{t('rentalCenter.itemLabel', { defaultValue: 'Sprzęt' })}</Label>
                            <select id="external-item" value={externalItemId} onChange={(event) => setExternalItemId(event.target.value)} className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                                <option value="">{t('rentalCenter.itemPlaceholder', { defaultValue: 'Wybierz sprzęt' })}</option>
                                {ownedAvailableItems.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
                            </select>
                            {ownedAvailableItems.length === 0 && <p className="text-xs text-slate-400">{t('rentalCenter.noOwnedAvailable', { defaultValue: 'Brak dostępnych przedmiotów, których jesteś właścicielem.' })}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>{t('rentalCenter.guestLabel', { defaultValue: 'Gość' })}</Label>
                            <Input placeholder={t('rentalCenter.guestSearch', { defaultValue: 'Szukaj gościa...' })} value={guestSearch} onChange={(event) => { setGuestSearch(event.target.value); void refreshGuests(event.target.value); }} />
                            <select value={externalGuestId} onChange={(event) => setExternalGuestId(event.target.value)} className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                                <option value="">{t('rentalCenter.guestPlaceholder', { defaultValue: 'Wybierz gościa' })}</option>
                                {filteredGuests.map((guest) => <option key={guest.id} value={String(guest.id)}>{getEntryName(guest)}</option>)}
                            </select>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                            <div className="mb-3 text-xs font-semibold text-slate-600 dark:text-slate-300">{t('rentalCenter.addGuestInline', { defaultValue: 'Dodaj nowego gościa' })}</div>
                            <div className="grid gap-2 sm:grid-cols-3">
                                <Input placeholder={t('userDirectory.firstName', { defaultValue: 'Imię' })} value={newGuestFirstName} onChange={(event) => setNewGuestFirstName(event.target.value)} />
                                <Input placeholder={t('userDirectory.lastName', { defaultValue: 'Nazwisko' })} value={newGuestLastName} onChange={(event) => setNewGuestLastName(event.target.value)} />
                                <Input placeholder={t('userDirectory.email', { defaultValue: 'E-mail' })} value={newGuestEmail} onChange={(event) => setNewGuestEmail(event.target.value)} />
                            </div>
                            <Button className="mt-3" variant="outline" size="sm" onClick={() => void submitNewGuest()} disabled={isLoading || !newGuestFirstName.trim()}>
                                {t('rentalCenter.addGuest', { defaultValue: 'Dodaj gościa' })}
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="external-date">{t('rentalCenter.selectDueDate', { defaultValue: 'Planowana data zwrotu' })}</Label>
                            <Input id="external-date" type="date" value={externalDueDate} onChange={(event) => setExternalDueDate(event.target.value)} min={new Date().toISOString().split('T')[0]} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="external-note">{t('rentalCenter.noteLabel', { defaultValue: 'Notatka (opcjonalnie)' })}</Label>
                            <Textarea id="external-note" value={externalNote} onChange={(event) => setExternalNote(event.target.value)} rows={3} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsExternalDialogOpen(false)} disabled={isLoading}>{t('rentalCenter.cancel', { defaultValue: 'Anuluj' })}</Button>
                        <Button onClick={() => void submitExternal()} disabled={isLoading || !externalItemId || !externalDueDate || !externalGuestId}>
                            {isLoading ? t('rentalCenter.submitting', { defaultValue: 'Wysyłanie...' }) : t('rentalCenter.confirmHandoverBtn', { defaultValue: 'Wypożycz' })}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isActionDialogOpen} onOpenChange={(open) => !open && setIsActionDialogOpen(false)}>
                <DialogContent className="max-w-lg" onOpenAutoFocus={(event) => event.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>{actionLoan?.item.name}</DialogTitle>
                        <DialogDescription>{t(`rentalCenter.actions.${actionType}`, { defaultValue: '' })}</DialogDescription>
                    </DialogHeader>
                    {(actionType === 'return' || actionType === 'confirm-return') && (
                        <div className="space-y-2">
                            <Label htmlFor="return-condition">{t('rentalCenter.returnCondition', { defaultValue: 'Stan przy zwrocie' })}</Label>
                            <select id="return-condition" value={actionCondition} onChange={(event) => setActionCondition(event.target.value as ReturnCondition)} className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                                {CONDITION_OPTIONS.map((condition) => <option key={condition} value={condition}>{conditionLabel(condition)}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="action-note">{t('rentalCenter.noteLabel', { defaultValue: 'Notatka (opcjonalnie)' })}</Label>
                        <Textarea id="action-note" value={actionNote} onChange={(event) => setActionNote(event.target.value)} rows={3} />
                    </div>
                    {showActionAttachments && (
                        <div>
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                {t('rentalCenter.returnDocumentationHint', { defaultValue: 'Podczas odbioru przedmiotu możesz udokumentować jego aktualny stan zdjęciami lub plikami.' })}
                            </p>
                            <ItemAttachmentsPanel
                                attachments={actionAttachments}
                                isLoading={isActionAttachmentsLoading}
                                canUpload={true}
                                isUploading={isUploadingActionAttachments}
                                error={actionAttachmentsError}
                                onUpload={handleActionAttachmentUpload}
                                onDownload={handleActionAttachmentDownload}
                                onDelete={handleActionAttachmentDelete}
                            />
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsActionDialogOpen(false)} disabled={isLoading}>{t('rentalCenter.cancel', { defaultValue: 'Anuluj' })}</Button>
                        <Button variant={actionType === 'reject' ? 'destructive' : 'default'} onClick={() => void submitAction()} disabled={isLoading}>
                            {isLoading ? t('rentalCenter.submitting', { defaultValue: 'Wysyłanie...' }) : t('rentalCenter.saveAction', { defaultValue: 'Zapisz' })}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
