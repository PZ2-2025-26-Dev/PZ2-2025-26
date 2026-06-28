import { Fragment, useEffect, useState } from 'react';
import {
    AlertCircle,
    CalendarDays,
    ChevronDown,
    ChevronUp,
    CircleAlert,
    ExternalLink,
    History,
    Lock,
    MapPin,
    QrCode,
    ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/StatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import type { AppUser, InventoryItem } from '@/types';
import { PERMISSIONS, hasPermission } from '../auth/permissions';
import ItemAttachmentsPanel from '../inventory/ItemAttachmentsPanel';
import { useItemAttachments } from '../inventory/useItemAttachments';
import { ITEM_HISTORY_PAGE_LIMIT, useInventory } from '../inventory/useInventory';
import { useLocations, type Location } from '../locations/useLocations';

type HistoryEntry = {
    id: string | number;
    updated_at: string;
    updated_by: string | number;
    change_type: string;
    description: string | null;
};

type HistoryPagination = {
    page: number;
    limit: number;
    total: number;
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
    onLocationChanged?: (itemId: string | number, location: { id: number; path: string }) => void;
};

export default function ItemDetailsModal({
    isOpen,
    onClose,
    item,
    user,
    onUpdateStatus,
    onLocationChanged,
}: ItemDetailsModalProps) {
    const { t, i18n } = useTranslation();
    const {
        getItemHistory,
        updateItem,
        isLoading: isInventoryLoading,
        error: itemUpdateError,
        clearError: clearItemUpdateError,
    } = useInventory();
    const {
        listLocations,
        createLocation,
        isLoading: isLocationLoading,
        error: locationCreateError,
        clearError: clearLocationCreateError,
    } = useLocations();
    const [returnDate, setReturnDate] = useState('');
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editedDescription, setEditedDescription] = useState('');
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [historyPagination, setHistoryPagination] = useState<HistoryPagination | null>(null);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [availableLocations, setAvailableLocations] = useState<Location[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState('');
    const [isRemoteLocationDialogOpen, setIsRemoteLocationDialogOpen] = useState(false);
    const [remoteLocationName, setRemoteLocationName] = useState('');
    const [remoteLocationAddress, setRemoteLocationAddress] = useState('');
    const [remoteLocationDescription, setRemoteLocationDescription] = useState('');

    const itemId = item?.id ?? null;
    const {
        attachments,
        isLoading: isAttachmentsLoading,
        isUploading: isUploadingAttachments,
        error: attachmentError,
        hasApiItemId,
        handleUpload,
        handleDownload,
        handleDelete,
    } = useItemAttachments(itemId, isOpen);

    useEffect(() => {
        if (!isOpen || !item) return;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setReturnDate(tomorrow.toISOString().split('T')[0]);
        setEditedDescription(item?.description ?? '');
        setIsEditingDescription(false);
        setIsDescriptionOpen(false);
        setIsHistoryOpen(false);
        setHistory([]);
        setHistoryPagination(null);
        setHistoryError(null);
        setAvailableLocations([]);
        setSelectedLocationId(String(item.locationId ?? ''));
        setIsRemoteLocationDialogOpen(false);
        setRemoteLocationName('');
        setRemoteLocationAddress('');
        setRemoteLocationDescription('');
        clearLocationCreateError();
        clearItemUpdateError();

        void listLocations().then((result) => {
            if (!result.success) return;

            const locations = result.locations
                .filter((location) => location.isActive)
                .sort((first, second) => first.path.localeCompare(second.path));
            const currentLocation = locations.find((location) => location.id === item.locationId)
                ?? locations.find((location) => location.path === item.location);

            setAvailableLocations(locations);
            setSelectedLocationId(currentLocation ? String(currentLocation.id) : '');
        });
    }, [clearItemUpdateError, clearLocationCreateError, isOpen, item, listLocations]);

    if (!item) return null;

    const isOwner = user.name === item.owner
        || item.ownerId === user.id
        || hasPermission(user, PERMISSIONS.SYSTEM_MANAGE);
    const canBorrow = user.role === 'regular' || user.role === 'admin';

    const loadHistory = async (page: number, replace = false) => {
        setHistoryError(null);
        const result = await getItemHistory(item.id, page, ITEM_HISTORY_PAGE_LIMIT);

        if (!result.success) {
            setHistoryError(result.error ?? t('itemDetailsModal.historyLoadError'));
            return;
        }

        const entries = (result.data ?? []) as HistoryEntry[];
        setHistory((current) => replace ? entries : [...current, ...entries]);
        setHistoryPagination((result.pagination ?? {
            page,
            limit: ITEM_HISTORY_PAGE_LIMIT,
            total: entries.length,
        }) as HistoryPagination);
    };

    const toggleHistory = async () => {
        const shouldOpen = !isHistoryOpen;
        setIsHistoryOpen(shouldOpen);
        if (shouldOpen && history.length === 0) {
            await loadHistory(1, true);
        }
    };

    const formatHistoryDate = (value: string) => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : date.toLocaleString(i18n.language);
    };

    const historyTotal = historyPagination?.total ?? history.length;
    const hasMoreHistory = history.length < historyTotal;

    const handleAssignLocation = async () => {
        const location = availableLocations.find((entry) => entry.id === Number(selectedLocationId));
        if (!location || location.id === item.locationId) return;

        clearLocationCreateError();
        clearItemUpdateError();
        const updatedItem = await updateItem(item.id, { locationId: location.id });
        if (!updatedItem.success) return;

        onLocationChanged?.(item.id, { id: location.id, path: location.path });
    };

    const handleCreateRemoteLocation = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!remoteLocationName.trim()) return;

        clearLocationCreateError();
        clearItemUpdateError();

        const createdLocation = await createLocation({
            name: remoteLocationName.trim(),
            type: 'remote',
            parentId: null,
            description: remoteLocationDescription.trim() || null,
            address: remoteLocationAddress.trim() || null,
        });

        if (!createdLocation.success || !createdLocation.location) return;

        setAvailableLocations((current) => (
            [...current, createdLocation.location]
                .sort((first, second) => first.path.localeCompare(second.path))
        ));
        setSelectedLocationId(String(createdLocation.location.id));

        const updatedItem = await updateItem(item.id, {
            locationId: createdLocation.location.id,
        });

        if (!updatedItem.success) return;

        onLocationChanged?.(item.id, {
            id: createdLocation.location.id,
            path: createdLocation.location.path,
        });
        setIsRemoteLocationDialogOpen(false);
        setRemoteLocationName('');
        setRemoteLocationAddress('');
        setRemoteLocationDescription('');
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
                        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                            <div className="mb-3 flex items-start gap-3">
                                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                                    <MapPin className="size-4" />
                                </div>
                                <div>
                                    <strong className="text-sm text-slate-900 dark:text-white">{t('itemDetailsModal.itemLocationTitle')}</strong>
                                    <p className="text-xs text-slate-500">{t('itemDetailsModal.itemLocationDesc')}</p>
                                </div>
                            </div>
                            {(locationCreateError || itemUpdateError) && !isRemoteLocationDialogOpen && (
                                <Alert variant="destructive" className="mb-3">
                                    <AlertCircle className="size-4" />
                                    <AlertTitle>{t('itemDetailsModal.locationUpdateErrorTitle')}</AlertTitle>
                                    <AlertDescription>{locationCreateError || itemUpdateError}</AlertDescription>
                                </Alert>
                            )}
                            <div className="space-y-3">
                                <Select
                                    value={selectedLocationId}
                                    onValueChange={setSelectedLocationId}
                                    disabled={isLocationLoading || availableLocations.length === 0}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('itemDetailsModal.locationSelectPlaceholder')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableLocations.map((location) => (
                                            <SelectItem key={location.id} value={String(location.id)}>
                                                {location.path}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    className="w-full"
                                    disabled={
                                        isInventoryLoading
                                        || !selectedLocationId
                                        || Number(selectedLocationId) === item.locationId
                                    }
                                    onClick={() => void handleAssignLocation()}
                                >
                                    {isInventoryLoading
                                        ? t('itemDetailsModal.locationSaving')
                                        : t('itemDetailsModal.locationSave')}
                                </Button>
                            </div>
                            <Separator className="my-4" />
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                    clearLocationCreateError();
                                    clearItemUpdateError();
                                    setIsRemoteLocationDialogOpen(true);
                                }}
                            >
                                <MapPin className="size-4" />
                                {t('itemDetailsModal.remoteLocationAction')}
                            </Button>
                        </div>
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

    const remoteLocationError = locationCreateError || itemUpdateError;
    const isRemoteLocationSaving = isLocationLoading || isInventoryLoading;

    return (
        <>
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
                                    [t('itemDetailsModal.category'), item.categoryPath || '-'],                                  
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
                                {hasApiItemId && (
                                    <ItemAttachmentsPanel
                                        attachments={attachments}
                                        isLoading={isAttachmentsLoading}
                                        canUpload={isOwner}
                                        isUploading={isUploadingAttachments}
                                        error={attachmentError}
                                        onUpload={handleUpload}
                                        onDownload={handleDownload}
                                        onDelete={handleDelete}
                                    />
                                )}
                                <Separator />
                                <Button variant="ghost" size="sm" onClick={toggleHistory}>
                                    <History />{t('itemDetailsModal.history')}{isHistoryOpen ? <ChevronUp /> : <ChevronDown />}
                                </Button>
                                {isHistoryOpen && (
                                    <div className="space-y-3">
                                        {historyError && (
                                            <Alert variant="destructive">
                                                <CircleAlert />
                                                <AlertTitle>{t('itemDetailsModal.historyErrorTitle')}</AlertTitle>
                                                <AlertDescription>{historyError}</AlertDescription>
                                            </Alert>
                                        )}
                                        {isInventoryLoading && history.length === 0 ? (
                                            <p className="text-xs text-slate-500">{t('itemDetailsModal.historyLoading')}</p>
                                        ) : history.length > 0 ? (
                                            <div className="max-h-72 space-y-3 overflow-y-auto pr-2">
                                                {history.map((entry) => (
                                                    <div key={entry.id} className="border-l-2 border-emerald-300 pl-4 text-sm">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <p className="text-xs text-slate-400">{formatHistoryDate(entry.updated_at)}</p>
                                                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                                {t(`itemDetailsModal.historyTypes.${entry.change_type}`, { defaultValue: entry.change_type })}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                                                            {t('itemDetailsModal.historyAuthor', { id: entry.updated_by })}
                                                        </p>
                                                        {entry.description && (
                                                            <p className="mt-1 text-slate-600 dark:text-slate-400">{entry.description}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : !historyError && (
                                            <p className="text-xs text-slate-400">{t('itemDetailsModal.historyEmpty')}</p>
                                        )}
                                        {hasMoreHistory && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full"
                                                disabled={isInventoryLoading}
                                                onClick={() => loadHistory((historyPagination?.page ?? 0) + 1)}
                                            >
                                                {isInventoryLoading
                                                    ? t('itemDetailsModal.historyLoading')
                                                    : t('itemDetailsModal.historyShowMore')}
                                            </Button>
                                        )}
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
        <Dialog open={isRemoteLocationDialogOpen} onOpenChange={setIsRemoteLocationDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('itemDetailsModal.remoteLocationTitle')}</DialogTitle>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleCreateRemoteLocation}>
                    {remoteLocationError && (
                        <Alert variant="destructive">
                            <AlertCircle className="size-4" />
                            <AlertTitle>{t('itemDetailsModal.remoteLocationErrorTitle')}</AlertTitle>
                            <AlertDescription>{remoteLocationError}</AlertDescription>
                        </Alert>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="remote-location-name">{t('itemDetailsModal.remoteLocationName')}</Label>
                        <Input
                            id="remote-location-name"
                            value={remoteLocationName}
                            onChange={(event) => setRemoteLocationName(event.target.value)}
                            placeholder={t('itemDetailsModal.remoteLocationNamePlaceholder')}
                            maxLength={255}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="remote-location-address">{t('itemDetailsModal.remoteLocationAddress')}</Label>
                        <Input
                            id="remote-location-address"
                            value={remoteLocationAddress}
                            onChange={(event) => setRemoteLocationAddress(event.target.value)}
                            placeholder={t('itemDetailsModal.remoteLocationAddressPlaceholder')}
                            maxLength={255}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="remote-location-description">{t('itemDetailsModal.remoteLocationDescription')}</Label>
                        <Textarea
                            id="remote-location-description"
                            value={remoteLocationDescription}
                            onChange={(event) => setRemoteLocationDescription(event.target.value)}
                            placeholder={t('itemDetailsModal.remoteLocationDescriptionPlaceholder')}
                            maxLength={500}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsRemoteLocationDialogOpen(false)}
                        >
                            {t('itemDetailsModal.cancel')}
                        </Button>
                        <Button type="submit" disabled={isRemoteLocationSaving || !remoteLocationName.trim()}>
                            {isRemoteLocationSaving
                                ? t('itemDetailsModal.remoteLocationSaving')
                                : t('itemDetailsModal.remoteLocationSubmit')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
        </>
    );
}
