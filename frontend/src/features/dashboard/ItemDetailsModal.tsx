import { Fragment, useEffect, useState } from 'react';
import {
    CalendarDays,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    History,
    Lock,
    MapPin,
    QrCode,
    ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import type { AppUser, InventoryItem } from '@/types';
import { PERMISSIONS, hasPermission } from '../auth/permissions';
import { useInventory } from '../inventory/useInventory';

type HistoryEntry = {
    id: string | number;
    updated_at: string;
    updated_by: string;
    description: string;
};

type ItemDetailsModalProps = {
    isOpen: boolean;
    onClose: () => void;
    item: InventoryItem | null;
    user: AppUser;
    onUpdateStatus: (
        itemId: string | number,
        status: string,
        clearBorrower?: boolean,
        borrower?: string | null,
        dueDate?: string | null,
    ) => void;
};

export default function ItemDetailsModal({
    isOpen,
    onClose,
    item,
    user,
    onUpdateStatus,
}: ItemDetailsModalProps) {
    const { t } = useTranslation();
    const { getItemHistory } = useInventory();
    const [returnDate, setReturnDate] = useState('');
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editedDescription, setEditedDescription] = useState('');
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    useEffect(() => {
        if (!isOpen) return;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setReturnDate(tomorrow.toISOString().split('T')[0]);
        setEditedDescription(item?.description ?? '');
        setIsEditingDescription(false);
        setIsDescriptionOpen(false);
        setIsHistoryOpen(false);
    }, [isOpen, item]);

    if (!item) return null;

    const isOwner = user.name === item.owner || hasPermission(user, PERMISSIONS.SYSTEM_MANAGE);
    const canBorrow = user.role === 'regular' || user.role === 'admin';

    const toggleHistory = async () => {
        const shouldOpen = !isHistoryOpen;
        setIsHistoryOpen(shouldOpen);
        if (shouldOpen && history.length === 0) {
            const result = await getItemHistory(item.id);
            if (result.success) setHistory(result.data);
        }
    };

    const renderDescription = (text: string) => {
        const urlPattern = /(https?:\/\/[^\s]+)/g;
        return text.split(urlPattern).map((part, index) => part.match(/^https?:\/\//) ? (
            <a key={`${part}-${index}`} href={part} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-700 underline dark:text-emerald-400">
                <ExternalLink className="size-3.5" />
                {t('itemDetailsModal.openLink')}
            </a>
        ) : <Fragment key={`${part}-${index}`}>{part}</Fragment>);
    };

    const workflowPanel = () => {
        if (isOwner) {
            return (
                <Card className="border-emerald-200 dark:border-emerald-900/50">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                            <ShieldCheck className="size-5" />
                            <CardTitle className="text-base">{t('itemDetailsModal.ownerPanel')}</CardTitle>
                        </div>
                        <CardDescription>{t('itemDetailsModal.ownerDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {item.status === 'oczekuje akceptacji' && (
                            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                                <strong className="text-sm text-amber-700 dark:text-amber-300">{t('itemDetailsModal.reqPending')}</strong>
                                <p className="text-xs text-slate-600 dark:text-slate-400">{t('itemDetailsModal.reqDesc', { borrower: item.borrower || 'Ktoś' })}</p>
                                <Button className="w-full" onClick={() => onUpdateStatus(item.id, 'zarezerwowany')}>{t('itemDetailsModal.btnAccept')}</Button>
                                <Button variant="secondary" className="w-full" onClick={() => onUpdateStatus(item.id, 'dostępny', true)}>{t('itemDetailsModal.btnReject')}</Button>
                            </div>
                        )}
                        {item.status === 'zarezerwowany' && (
                            <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/60 dark:bg-violet-950/30">
                                <strong className="text-sm text-violet-700 dark:text-violet-300">{t('itemDetailsModal.handover')}</strong>
                                <p className="text-xs text-slate-600 dark:text-slate-400">{t('itemDetailsModal.handoverDesc')}</p>
                                <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => onUpdateStatus(item.id, 'wypożyczony')}>{t('itemDetailsModal.btnGive')}</Button>
                            </div>
                        )}
                        {item.status === 'wypożyczony' && (
                            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/60 dark:bg-blue-950/30">
                                <strong className="text-sm text-blue-700 dark:text-blue-300">{t('itemDetailsModal.returnPending')}</strong>
                                <p className="text-xs text-slate-600 dark:text-slate-400">{t('itemDetailsModal.returnDesc', { borrower: item.borrower, dueDate: item.dueDate || 'Brak' })}</p>
                                <Button variant="info" className="w-full" onClick={() => onUpdateStatus(item.id, 'dostępny', true)}>{t('itemDetailsModal.btnReturn')}</Button>
                            </div>
                        )}
                        {item.status !== 'uszkodzony' && (
                            <Button variant="destructive" className="w-full" onClick={() => onUpdateStatus(item.id, 'uszkodzony')}>
                                {t('itemDetailsModal.markDamaged')}
                            </Button>
                        )}
                    </CardContent>
                </Card>
            );
        }

        if (item.status === 'dostępny' && canBorrow) {
            return (
                <Card className="border-blue-200 dark:border-blue-900/50">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                            <CalendarDays className="size-5" />
                            <CardTitle className="text-base">{t('itemDetailsModal.borrowPanel')}</CardTitle>
                        </div>
                        <CardDescription>{t('itemDetailsModal.borrowDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="return-date">{t('itemDetailsModal.dateLabel')}</Label>
                            <Input id="return-date" type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
                        </div>
                        <Button variant="info" className="w-full" onClick={() => returnDate && onUpdateStatus(item.id, 'oczekuje akceptacji', false, user.name, returnDate)}>
                            {t('itemDetailsModal.btnSubmitReq')}
                        </Button>
                    </CardContent>
                </Card>
            );
        }

        return (
            <Card>
                <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900"><Lock className="size-5 text-slate-400" /></div>
                    <strong className="text-sm text-slate-700 dark:text-slate-300">Tylko do odczytu</strong>
                    <p className="text-xs text-slate-500">{t('itemDetailsModal.readOnlyDesc', { owner: item.owner })}</p>
                </CardContent>
            </Card>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                    <div className="pr-8">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('itemDetailsModal.detailsTitle')}</p>
                        <DialogTitle className="text-xl">{item.name}</DialogTitle>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <StatusBadge status={item.status} label={item.status.toUpperCase()} />
                            <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-500 dark:bg-slate-900">ID: {item.id}</span>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-5">
                        <Card>
                            <CardHeader><CardTitle className="text-sm">{t('itemDetailsModal.techSpec')}</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                {[
                                    [t('itemDetailsModal.producer'), item.producer],
                                    [t('itemDetailsModal.model'), item.model],
                                    [t('itemDetailsModal.sn'), item.serialNumber],
                                    [t('itemDetailsModal.category'), item.category],
                                ].map(([label, value]) => (
                                    <div key={label} className="flex justify-between gap-4">
                                        <span className="text-slate-500">{label}</span>
                                        <span className="text-right font-medium">{value || '-'}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="space-y-4 pt-5">
                                <div className="flex items-center justify-between">
                                    <Button variant="ghost" size="sm" onClick={() => setIsDescriptionOpen((open) => !open)}>
                                        {t('itemDetailsModal.description')}
                                        {isDescriptionOpen ? <ChevronUp /> : <ChevronDown />}
                                    </Button>
                                    {isOwner && <Button variant="link" onClick={() => { setIsDescriptionOpen(true); setIsEditingDescription(true); }}>{t('itemDetailsModal.editDescription')}</Button>}
                                </div>
                                {isDescriptionOpen && (isEditingDescription ? (
                                    <div className="space-y-3">
                                        <Textarea maxLength={256} value={editedDescription} onChange={(event) => setEditedDescription(event.target.value)} />
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-400">{editedDescription.length}/256</span>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" onClick={() => setIsEditingDescription(false)}>{t('itemDetailsModal.cancel')}</Button>
                                                <Button size="sm" onClick={() => setIsEditingDescription(false)}>{t('itemDetailsModal.save')}</Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{renderDescription(item.description || '-')}</p>
                                ))}
                                <Separator />
                                <Button variant="ghost" size="sm" onClick={toggleHistory}>
                                    <History />{t('itemDetailsModal.history')}{isHistoryOpen ? <ChevronUp /> : <ChevronDown />}
                                </Button>
                                {isHistoryOpen && (
                                    <div className="space-y-3">
                                        {history.length > 0 ? history.map((entry) => (
                                            <div key={entry.id} className="border-l-2 border-emerald-300 pl-4 text-sm">
                                                <p className="text-xs text-slate-400">{entry.updated_at}</p>
                                                <strong>{entry.updated_by}</strong>
                                                <p className="text-slate-600 dark:text-slate-400">{entry.description}</p>
                                            </div>
                                        )) : <p className="text-xs text-slate-400">{t('dashboard.noResults')}</p>}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="space-y-4 pt-5">
                                <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><MapPin className="size-4 text-emerald-500" />{item.location}</div>
                                <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-300 py-6 text-slate-400 dark:border-slate-700">
                                    <QrCode className="mb-2 size-14" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">{t('itemDetailsModal.qrCode')}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    <div>{workflowPanel()}</div>
                </div>

                <DialogFooter>
                    <Button variant="secondary" onClick={onClose}>{t('itemDetailsModal.close')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
