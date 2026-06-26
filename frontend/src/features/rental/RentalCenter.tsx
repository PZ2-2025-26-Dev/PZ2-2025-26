import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AppUser, InventoryItem } from '@/types';
import { useInventory } from '../inventory/useInventory';

type RentalRequest = {
    id: string;
    itemId: string | number;
    itemName: string;
    category: string;
    borrower: string;
    requestDate: string;
    dueDate: string;
    status: 'pending' | 'approved' | 'rejected' | 'returned';
};

type RentalCenterProps = {
    user: AppUser;
};

export default function RentalCenter({ user }: RentalCenterProps) {
    const { t } = useTranslation();
    const { listItems, isLoading, error, clearError } = useInventory();

    const [items, setItems] = useState<InventoryItem[]>([]);
    const [rentalRequests, setRentalRequests] = useState<RentalRequest[]>([
        {
            id: 'req-001',
            itemId: 1,
            itemName: 'Oscyloskop cyfrowy',
            category: 'Pomiarowe',
            borrower: user.name,
            requestDate: '2026-06-15',
            dueDate: '2026-06-22',
            status: 'approved',
        },
        {
            id: 'req-002',
            itemId: 2,
            itemName: 'Multimetr analogowy',
            category: 'Pomiarowe',
            borrower: user.name,
            requestDate: '2026-06-18',
            dueDate: '2026-06-25',
            status: 'pending',
        },
    ]);
    const [isRentalDialogOpen, setIsRentalDialogOpen] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

    const refreshItems = useCallback(async () => {
        const result = await listItems({ limit: 100 });
        if (result.success) {
            setItems(result.items);
        }
    }, [listItems]);

    useEffect(() => {
        void refreshItems();
    }, [refreshItems]);

    const availableItems = useMemo(() => {
        return items.filter((item) => item.status === 'available');
    }, [items]);

    const userRequests = useMemo(() => {
        return rentalRequests.filter((req) => req.borrower === user.name);
    }, [rentalRequests, user.name]);

    const selectedItem = useMemo(() => {
        return items.find((item) => String(item.id) === selectedItemId) ?? null;
    }, [items, selectedItemId]);

    const handleOpenRequestDialog = () => {
        const defaultItem = availableItems[0];
        setSelectedItemId(defaultItem ? String(defaultItem.id) : '');
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        setDueDate(nextWeek);
        setIsRentalDialogOpen(true);
    };

    const handleSubmitRequest = async () => {
        if (!selectedItem || !dueDate) return;

        setIsSubmittingRequest(true);
        try {
            await new Promise((resolve) => setTimeout(resolve, 800));

            const newRequest: RentalRequest = {
                id: `req-${Date.now()}`,
                itemId: selectedItem.id,
                itemName: selectedItem.name,
                category: selectedItem.category,
                borrower: user.name,
                requestDate: new Date().toISOString().split('T')[0],
                dueDate,
                status: 'pending',
            };

            setRentalRequests((current) => [...current, newRequest]);
            setIsRentalDialogOpen(false);
            setSelectedItemId('');
            setDueDate('');
        } finally {
            setIsSubmittingRequest(false);
        }
    };

    const getStatusLabel = (status: RentalRequest['status']) => {
        const labels: Record<RentalRequest['status'], string> = {
            pending: t('dashboard.itemStatuses.pending_approval'),
            approved: t('dashboard.itemStatuses.reserved'),
            rejected: t('dashboard.itemStatuses.broken'),
            returned: t('dashboard.itemStatuses.available'),
        };
        return labels[status] || status;
    };

    const getStatusColor = (status: RentalRequest['status']) => {
        const colors: Record<RentalRequest['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
            pending: 'secondary',
            approved: 'default',
            rejected: 'destructive',
            returned: 'outline',
        };
        return colors[status];
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.loans')}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {t('dashboard.loansPlaceholder')}
                </p>
            </div>

            {error && (
                <Alert variant="destructive">
                    <span aria-hidden="true">⚠</span>
                    <AlertTitle>{t('auth.loginErrorTitle')}</AlertTitle>
                    <AlertDescription className="flex items-center justify-between gap-3">
                        <span>{error}</span>
                        <Button variant="ghost" size="sm" onClick={clearError}>
                            ✕
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* New Request Action */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                    size="lg"
                    onClick={handleOpenRequestDialog}
                    disabled={isLoading || availableItems.length === 0}
                    className="w-full sm:w-auto"
                >
                    <span className="mr-2" aria-hidden="true">+</span>
                    {t('rentalCenter.openRequestForm', { defaultValue: 'Złóż wniosek' })}
                </Button>
                <Button variant="outline" size="sm" onClick={() => void refreshItems()} disabled={isLoading} aria-label={t('dashboard.refresh')} className="w-full sm:w-auto">
                    <span className={isLoading ? 'inline-block animate-spin' : ''} aria-hidden="true">↻</span>
                </Button>
            </div>

            {/* User Requests History */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">{t('rentalCenter.myRequests')}</CardTitle>
                    <CardDescription className="text-xs">{userRequests.length} {t('rentalCenter.requests')}</CardDescription>
                </CardHeader>
                <CardContent>
                    {userRequests.length > 0 ? (
                        <div className="space-y-3">
                            {userRequests.map((request) => (
                                <div
                                    key={request.id}
                                    className="flex items-center justify-between rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium text-slate-900 dark:text-white">{request.itemName}</div>
                                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                            <span>{t('rentalCenter.dueDate')}: {request.dueDate}</span>
                                            <span>{t('rentalCenter.requested')}: {request.requestDate}</span>
                                        </div>
                                    </div>
                                    <div className="ml-4 flex shrink-0 items-center gap-3">
                                        <Badge
                                            variant={getStatusColor(request.status)}
                                            className="whitespace-nowrap text-[10px]"
                                        >
                                            {getStatusLabel(request.status)}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-8 text-center text-slate-400">{t('rentalCenter.noRequests')}</div>
                    )}
                </CardContent>
            </Card>

            {/* Rental Request Dialog */}
            <Dialog open={isRentalDialogOpen} onOpenChange={(open: boolean) => !open && setIsRentalDialogOpen(false)}>
                <DialogContent className="max-w-md" onOpenAutoFocus={(event: Event) => event.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>{t('rentalCenter.requestTitle')}</DialogTitle>
                        <DialogDescription>{t('rentalCenter.requestDescription')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="request-item">{t('rentalCenter.itemLabel')}</Label>
                            <select
                                id="request-item"
                                value={selectedItemId}
                                onChange={(event) => setSelectedItemId(event.target.value)}
                                disabled={isSubmittingRequest || availableItems.length === 0}
                                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                            >
                                <option value="">{t('rentalCenter.itemPlaceholder')}</option>
                                {availableItems.map((item) => (
                                    <option key={item.id} value={String(item.id)}>
                                        {item.name} {item.category ? `— ${item.category}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="due-date">{t('rentalCenter.selectDueDate')}</Label>
                            <Input
                                id="due-date"
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                required
                            />
                        </div>

                        {selectedItem && (
                            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/50">
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">{selectedItem.name}</div>
                                <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">{selectedItem.description}</div>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <Badge variant="outline" className="text-[9px]">
                                        {selectedItem.category}
                                    </Badge>
                                    <Badge variant="outline" className="text-[9px]">
                                        {selectedItem.location}
                                    </Badge>
                                </div>
                            </div>
                        )}

                        {!selectedItem && availableItems.length > 0 && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                                {t('rentalCenter.requestInfo')}
                            </div>
                        )}

                        {availableItems.length === 0 && (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200">
                                {t('rentalCenter.noAvailableInDialog')}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRentalDialogOpen(false)} disabled={isSubmittingRequest}>
                            {t('rentalCenter.cancel')}
                        </Button>
                        <Button onClick={() => void handleSubmitRequest()} disabled={isSubmittingRequest || !dueDate}>
                            {isSubmittingRequest ? (
                                <>
                                    <span className="mr-2 inline-block animate-spin" aria-hidden="true">⟳</span>
                                    {t('rentalCenter.submitting')}
                                </>
                            ) : (
                                <>
                                    <span className="mr-2" aria-hidden="true">✓</span>
                                    {t('rentalCenter.submitRequest')}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

