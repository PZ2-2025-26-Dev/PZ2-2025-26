import { Fragment, useEffect, useMemo, useState } from 'react';
import {
    CalendarDays,
    Check,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    History,
    Lock,
    MapPin,
    Pencil,
    QrCode,
    ShieldCheck,
    X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import type { AppUser, InventoryItem } from '@/types';
import { PERMISSIONS, ROLES, hasPermission } from '../auth/permissions';
import ItemAclPanel from '../inventory/ItemAclPanel';
import ItemAttachmentsPanel from '../inventory/ItemAttachmentsPanel';
import ItemParametersEditor, {
    buildParametersFromRows,
    parametersToRows,
    type ParameterRow,
} from '../inventory/ItemParametersEditor';
import ItemParametersDisplay from '../inventory/ItemParametersDisplay';
import { useItemAcl } from '../inventory/useItemAcl';
import { useItemAttachments } from '../inventory/useItemAttachments';
import { useInventory } from '../inventory/useInventory';
import { useLocations } from '../locations/useLocations';

const SCROLLABLE_SECTION_CLASS = 'max-h-44 overflow-y-auto overflow-x-hidden pr-1';

type HistoryEntry = {
    id: string | number;
    updated_at: string;
    updated_by: string;
    description: string;
};

type LocationOption = {
    id: number;
    path: string;
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
    onItemUpdated?: (item: InventoryItem) => void;
};

export default function ItemDetailsModal({
    isOpen,
    onClose,
    item,
    user,
    onUpdateStatus,
    onItemUpdated,
}: ItemDetailsModalProps) {
    const { t } = useTranslation();
    const { getItemHistory, getItem, updateItem, isLoading: isSavingItem } = useInventory();
    const { listAcl } = useItemAcl();
    const { listLocations } = useLocations();

    const [returnDate, setReturnDate] = useState('');
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editedDescription, setEditedDescription] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [isEditingLocation, setIsEditingLocation] = useState(false);
    const [editedLocationId, setEditedLocationId] = useState('');
    const [locations, setLocations] = useState<LocationOption[]>([]);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [parameters, setParameters] = useState<Record<string, unknown> | null>(null);
    const [isEditingParameters, setIsEditingParameters] = useState(false);
    const [parameterRows, setParameterRows] = useState<ParameterRow[]>([{ id: 'row-0', key: '', value: '' }]);
    const [parametersError, setParametersError] = useState<string | null>(null);
    const [aclPermissions, setAclPermissions] = useState<string[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);

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

    const isAdmin = hasPermission(user, PERMISSIONS.SYSTEM_MANAGE) || user.role === ROLES.ADMIN;
    const isOwner = Boolean(
        item && (item.ownerId === Number(user.id) || user.name === item.owner),
    );
    const isOwnerOrAdmin = isOwner || isAdmin;
    const isObserver = user.role === ROLES.OBSERVER;
    const canDelegate = !isObserver;

    const delegatedPermissions = useMemo(
        () => (canDelegate ? aclPermissions.filter((permission) => permission !== 'auto_approved_loan') : []),
        [aclPermissions, canDelegate],
    );

    const canEditName = !isObserver && isOwnerOrAdmin;
    const canEditLocation = !isObserver && (isOwnerOrAdmin || aclPermissions.includes('edit_location'));
    const canEditDescription = !isObserver && (isOwnerOrAdmin || aclPermissions.includes('edit_description'));
    const canEditParameters = !isObserver && (isOwnerOrAdmin || aclPermissions.includes('edit_parameters'));
    const canManageAttachments = !isObserver && (isOwnerOrAdmin || aclPermissions.includes('edit_attachments'));
    const canManageAcl = !isObserver && isOwnerOrAdmin;

    const hasParameters = Boolean(parameters && Object.keys(parameters).length > 0);

    useEffect(() => {
        if (!isOpen || !item) return;

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setReturnDate(tomorrow.toISOString().split('T')[0]);
        setEditedDescription(item.description ?? '');
        setEditedName(item.name);
        setEditedLocationId(item.locationId ? String(item.locationId) : '');
        setIsEditingDescription(false);
        setIsEditingName(false);
        setIsEditingLocation(false);
        setIsDescriptionOpen(false);
        setIsHistoryOpen(false);
        setSaveError(null);
        setParametersError(null);
        setIsEditingParameters(false);
        setParameters(item.parameters ?? null);
        setParameterRows(parametersToRows(item.parameters ?? null));
    }, [isOpen, item]);

    useEffect(() => {
        if (!isOpen || !itemId) return;

        getItem(itemId).then((result) => {
            if (!result.success) return;
            const nextParameters = result.data.parameters ?? null;
            setParameters(nextParameters);
            setParameterRows(parametersToRows(nextParameters));
        });
    }, [isOpen, itemId, getItem]);

    useEffect(() => {
        if (!isOpen || !itemId || isObserver) return;

        listAcl(itemId).then((result) => {
            if (!result.success) {
                setAclPermissions([]);
                return;
            }

            const userId = Number(user.id);
            const permissions = result.entries
                .filter((entry) => entry.userId === userId)
                .map((entry) => entry.permission);
            setAclPermissions(permissions);
        });
    }, [isOpen, itemId, user.id, isObserver, listAcl]);

    useEffect(() => {
        if (!isOpen || !canEditLocation) return;

        listLocations().then((result) => {
            if (result.success) {
                setLocations(result.locations.map((location) => ({
                    id: location.id,
                    path: location.path,
                })));
            }
        });
    }, [isOpen, canEditLocation, listLocations]);

    if (!item) return null;

    const applyItemUpdate = (patch: Partial<InventoryItem>) => {
        onItemUpdated?.({ ...item, ...patch });
    };

    const handleSaveName = async () => {
        const trimmed = editedName.trim();
        if (!trimmed || trimmed === item.name) {
            setIsEditingName(false);
            setEditedName(item.name);
            return;
        }

        setSaveError(null);
        const result = await updateItem(item.id, { name: trimmed });
        if (!result.success) {
            setSaveError(result.error ?? t('itemDetailsModal.saveFailed'));
            return;
        }

        applyItemUpdate({ name: trimmed });
        setIsEditingName(false);
    };

    const handleSaveDescription = async () => {
        const trimmed = editedDescription.trim();
        const nextDescription = trimmed || null;
        if (nextDescription === (item.description ?? null)) {
            setIsEditingDescription(false);
            return;
        }

        setSaveError(null);
        const result = await updateItem(item.id, { description: nextDescription });
        if (!result.success) {
            setSaveError(result.error ?? t('itemDetailsModal.saveFailed'));
            return;
        }

        applyItemUpdate({ description: nextDescription ?? undefined });
        setIsEditingDescription(false);
        setIsDescriptionOpen(true);
    };

    const handleSaveLocation = async () => {
        const locationId = Number(editedLocationId);
        if (!locationId || locationId === item.locationId) {
            setIsEditingLocation(false);
            return;
        }

        setSaveError(null);
        const result = await updateItem(item.id, { locationId });
        if (!result.success) {
            setSaveError(result.error ?? t('itemDetailsModal.saveFailed'));
            return;
        }

        const location = locations.find((entry) => entry.id === locationId);
        applyItemUpdate({
            locationId,
            location: location?.path ?? item.location,
        });
        setIsEditingLocation(false);
    };

    const handleSaveParameters = async () => {
        setParametersError(null);

        const keys = parameterRows.map((row) => row.key.trim()).filter(Boolean);
        if (new Set(keys).size !== keys.length) {
            setParametersError(t('itemDetailsModal.duplicateParameterKeys'));
            return;
        }

        const built = buildParametersFromRows(parameterRows);
        if (!built.success) {
            setParametersError(t('itemDetailsModal.invalidParameterValue', { key: built.error }));
            return;
        }

        const parsed = built.parameters;

        setSaveError(null);
        const result = await updateItem(item.id, { parameters: parsed });
        if (!result.success) {
            setSaveError(result.error ?? t('itemDetailsModal.saveFailed'));
            return;
        }

        setParameters(parsed);
        setParameterRows(parametersToRows(parsed));
        applyItemUpdate({ parameters: parsed });
        setIsEditingParameters(false);
    };

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
        if (isOwnerOrAdmin) {
            return (
                <div className="space-y-4">
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

                    {canManageAcl && (
                        <ItemAclPanel
                            itemId={item.id}
                            ownerId={item.ownerId}
                            isOpen={isOpen}
                        />
                    )}
                </div>
            );
        }

        const canBorrow = user.role === ROLES.USER || user.role === ROLES.ADMIN || user.role === 'regular';

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

        if (delegatedPermissions.length > 0) {
            return (
                <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-base">{t('itemDetailsModal.delegatedPanel')}</CardTitle>
                        <CardDescription>{t('itemDetailsModal.delegatedDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                            {delegatedPermissions.map((permission) => (
                                <li key={permission}>• {t(`itemAcl.permissions.${permission}`)}</li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            );
        }

        return (
            <Card>
                <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900"><Lock className="size-5 text-slate-400" /></div>
                    <strong className="text-sm text-slate-700 dark:text-slate-300">{t('itemDetailsModal.readOnlyTitle')}</strong>
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
                        {isEditingName ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    value={editedName}
                                    maxLength={128}
                                    onChange={(event) => setEditedName(event.target.value)}
                                    className="text-lg font-semibold"
                                />
                                <Button size="icon-sm" disabled={isSavingItem} onClick={handleSaveName} aria-label={t('itemDetailsModal.save')}>
                                    <Check className="size-4" />
                                </Button>
                                <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={() => { setIsEditingName(false); setEditedName(item.name); }}
                                    aria-label={t('itemDetailsModal.cancel')}
                                >
                                    <X className="size-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-start gap-2">
                                <DialogTitle className="text-xl">{item.name}</DialogTitle>
                                {canEditName && (
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => setIsEditingName(true)}
                                        aria-label={t('itemDetailsModal.editName')}
                                    >
                                        <Pencil className="size-4 text-slate-400" />
                                    </Button>
                                )}
                            </div>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <StatusBadge status={item.status} label={item.status.toUpperCase()} />
                            <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-500 dark:bg-slate-900">ID: {item.id}</span>
                        </div>
                        {saveError && (
                            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{saveError}</p>
                        )}
                    </div>
                </DialogHeader>

                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-5">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm">{t('itemDetailsModal.techSpec')}</CardTitle>
                                {canEditParameters && !isEditingParameters && (
                                    <Button variant="link" size="xs" className="text-xs font-normal" onClick={() => setIsEditingParameters(true)}>
                                        {t('itemDetailsModal.editParameters')}
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between gap-4">
                                    <span className="text-slate-500">{t('itemDetailsModal.category')}</span>
                                    <span className="text-right font-medium">{item.category || '-'}</span>
                                </div>
                                <Separator />
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {t('itemDetailsModal.parameters')}
                                </p>
                                {isEditingParameters ? (
                                    <div className="space-y-3">
                                        <div className={SCROLLABLE_SECTION_CLASS}>
                                            <ItemParametersEditor
                                                rows={parameterRows}
                                                onChange={setParameterRows}
                                                error={parametersError}
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setIsEditingParameters(false);
                                                    setParameterRows(parametersToRows(parameters));
                                                    setParametersError(null);
                                                }}
                                            >
                                                {t('itemDetailsModal.cancel')}
                                            </Button>
                                            <Button size="sm" disabled={isSavingItem} onClick={handleSaveParameters}>
                                                {t('itemDetailsModal.save')}
                                            </Button>
                                        </div>
                                    </div>
                                ) : hasParameters && parameters ? (
                                    <div className={SCROLLABLE_SECTION_CLASS}>
                                        <ItemParametersDisplay parameters={parameters} />
                                    </div>
                                ) : (
                                    <p className="text-slate-500">{t('itemDetailsModal.noParameters')}</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="space-y-4 pt-5">
                                <div className="flex items-center justify-between">
                                    <Button variant="ghost" size="sm" onClick={() => setIsDescriptionOpen((open) => !open)}>
                                        {t('itemDetailsModal.description')}
                                        {isDescriptionOpen ? <ChevronUp /> : <ChevronDown />}
                                    </Button>
                                    {canEditDescription && !isEditingDescription && (
                                        <Button
                                            variant="link"
                                            size="xs"
                                            className="text-xs font-normal"
                                            onClick={() => { setIsDescriptionOpen(true); setIsEditingDescription(true); }}
                                        >
                                            {t('itemDetailsModal.editDescription')}
                                        </Button>
                                    )}
                                </div>
                                {isDescriptionOpen && (isEditingDescription ? (
                                    <div className="space-y-3">
                                        <div className={SCROLLABLE_SECTION_CLASS}>
                                            <Textarea
                                                maxLength={256}
                                                value={editedDescription}
                                                onChange={(event) => setEditedDescription(event.target.value)}
                                                className="min-h-[6rem] resize-none"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-400">{editedDescription.length}/256</span>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" onClick={() => { setIsEditingDescription(false); setEditedDescription(item.description ?? ''); }}>{t('itemDetailsModal.cancel')}</Button>
                                                <Button size="sm" disabled={isSavingItem} onClick={handleSaveDescription}>{t('itemDetailsModal.save')}</Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300 ${SCROLLABLE_SECTION_CLASS}`}>
                                        {renderDescription(item.description || t('itemDetailsModal.noDescription'))}
                                    </div>
                                ))}
                                {hasApiItemId && (
                                    <ItemAttachmentsPanel
                                        attachments={attachments}
                                        isLoading={isAttachmentsLoading}
                                        canUpload={canManageAttachments}
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
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                        <MapPin className="size-4 text-emerald-500" />
                                        {isEditingLocation ? (
                                            <Select modal={false} value={editedLocationId || undefined} onValueChange={setEditedLocationId}>
                                                <SelectTrigger className="h-8 min-w-[12rem]">
                                                    <SelectValue placeholder={t('itemDetailsModal.locationPlaceholder')} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {locations.map((location) => (
                                                        <SelectItem key={location.id} value={String(location.id)}>
                                                            {location.path}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <span>{item.location || '-'}</span>
                                        )}
                                    </div>
                                    {canEditLocation && (
                                        isEditingLocation ? (
                                            <div className="flex gap-1">
                                                <Button size="icon-sm" disabled={isSavingItem} onClick={handleSaveLocation} aria-label={t('itemDetailsModal.save')}>
                                                    <Check className="size-4" />
                                                </Button>
                                                <Button
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setIsEditingLocation(false);
                                                        setEditedLocationId(item.locationId ? String(item.locationId) : '');
                                                    }}
                                                    aria-label={t('itemDetailsModal.cancel')}
                                                >
                                                    <X className="size-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => setIsEditingLocation(true)}
                                                aria-label={t('itemDetailsModal.editLocation')}
                                            >
                                                <Pencil className="size-4 text-slate-400" />
                                            </Button>
                                        )
                                    )}
                                </div>
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
