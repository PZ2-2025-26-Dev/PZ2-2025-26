import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, Archive, Building2, ChevronDown, ChevronRight, DoorOpen, Layers3, MapPin, Pencil, Plus, RefreshCw, Trash2, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/StatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { InventoryItem } from '@/types';
import { useInventory } from '../inventory/useInventory';
import { useLocations, type Location, type LocationType } from './useLocations';

type LocationNode = Location & { children: LocationNode[] };

const ROOT_LOCATION = 'root';
const LOCATION_TYPES: LocationType[] = ['building', 'room', 'cabinet', 'shelf', 'remote', 'other'];
const LOCATION_STATUSES = ['active', 'inactive'] as const;
const LOCATION_TYPE_ICONS: Record<LocationType, LucideIcon> = {
    building: Building2,
    room: DoorOpen,
    cabinet: Archive,
    shelf: Layers3,
    remote: MapPin,
    other: MapPin,
};
const LOCATION_PARENT_TYPES: Record<LocationType, LocationType[]> = {
    building: [],
    room: ['building'],
    cabinet: ['room'],
    shelf: ['cabinet'],
    remote: [],
    other: ['building', 'room', 'cabinet', 'shelf', 'other'],
};

type LocationFormState = {
    name: string;
    type: LocationType;
    parentId: string;
    description: string;
    address: string;
    status: typeof LOCATION_STATUSES[number];
};

type DeleteErrorState = {
    locationName: string;
};

type HideErrorState = {
    locationName: string;
};

type LocationManagerProps = {
    canManage?: boolean;
    canCreateRemote?: boolean;
    showOnlyOwnRemote?: boolean;
    currentUserId?: string | number | null;
};

const compareLocations = (first: Location, second: Location) => {
    if (first.type === 'remote' && second.type !== 'remote') return 1;
    if (first.type !== 'remote' && second.type === 'remote') return -1;
    return first.path.localeCompare(second.path, 'pl', { sensitivity: 'base' });
};

const buildLocationTree = (locations: Location[]) => {
    const lookup: Record<number, LocationNode> = {};
    const roots: LocationNode[] = [];

    locations.forEach((location) => {
        lookup[location.id] = { ...location, children: [] };
    });

    locations.forEach((location) => {
        const node = lookup[location.id];
        const parent = location.parentId ? lookup[location.parentId] : null;

        if (parent) parent.children.push(node);
        else roots.push(node);
    });

    const sortNodes = (nodes: LocationNode[]) => {
        nodes.sort(compareLocations);
        nodes.forEach((node) => sortNodes(node.children));
    };
    sortNodes(roots);

    return roots;
};

const flattenLocations = (locations: Location[]) => [...locations].sort(compareLocations);

const getParentOptions = (locations: Location[], type: LocationType) => {
    const allowedParentTypes = LOCATION_PARENT_TYPES[type];
    return flattenLocations(locations).filter((location) => allowedParentTypes.includes(location.type));
};

const getValidParentId = (currentParentId: string, options: Location[]) => {
    if (options.some((location) => String(location.id) === currentParentId)) return currentParentId;
    return options[0] ? String(options[0].id) : ROOT_LOCATION;
};

const collectDescendantIds = (locationId: number, locations: Location[]) => {
    const descendants = new Set<number>();
    const collect = (parentId: number) => {
        locations
            .filter((location) => location.parentId === parentId)
            .forEach((location) => {
                descendants.add(location.id);
                collect(location.id);
            });
    };

    collect(locationId);
    return descendants;
};

export default function LocationManager({
    canManage = true,
    canCreateRemote = false,
    showOnlyOwnRemote = false,
    currentUserId = null,
}: LocationManagerProps) {
    const { t } = useTranslation();
    const { listLocations, createLocation, updateLocation, deleteLocation, isLoading, error, clearError } = useLocations();
    const {
        listItems,
        isLoading: areItemsLoading,
        error: itemsError,
        clearError: clearItemsError,
    } = useInventory();

    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const [locationItems, setLocationItems] = useState<InventoryItem[]>([]);
    const [locationItemsTotal, setLocationItemsTotal] = useState(0);
    const [newLocationName, setNewLocationName] = useState('');
    const [newLocationType, setNewLocationType] = useState<LocationType>('building');
    const [selectedParentId, setSelectedParentId] = useState(ROOT_LOCATION);
    const [newLocationDescription, setNewLocationDescription] = useState('');
    const [newLocationAddress, setNewLocationAddress] = useState('');
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);
    const [editForm, setEditForm] = useState<LocationFormState | null>(null);
    const [deletingLocation, setDeletingLocation] = useState<Location | null>(null);
    const [deleteError, setDeleteError] = useState<DeleteErrorState | null>(null);
    const [hideError, setHideError] = useState<HideErrorState | null>(null);
    const [expandedLocationIds, setExpandedLocationIds] = useState<Set<number>>(() => new Set());
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    const canAddLocation = canManage || canCreateRemote;
    const defaultNewLocationType: LocationType = canManage ? 'building' : 'remote';
    const newLocationTypes = canManage ? LOCATION_TYPES : (['remote'] as LocationType[]);
    const locationTree = useMemo(() => buildLocationTree(locations), [locations]);
    const parentOptions = useMemo(() => getParentOptions(locations, newLocationType), [locations, newLocationType]);
    const editParentOptions = useMemo(() => {
        if (!editingLocation || !editForm) return [];

        const blockedIds = collectDescendantIds(editingLocation.id, locations);
        blockedIds.add(editingLocation.id);

        return getParentOptions(locations, editForm.type).filter((location) => !blockedIds.has(location.id));
    }, [editForm, editingLocation, locations]);
    const isRootLocationType = newLocationType === 'building' || newLocationType === 'remote';
    const isEditingRootLocationType = editForm?.type === 'building' || editForm?.type === 'remote';
    const isParentRequired = !isRootLocationType;
    const isEditParentRequired = Boolean(editForm && !isEditingRootLocationType);

    const refreshLocations = useCallback(async () => {
        const result = await listLocations();
        if (result.success) {
            const visibleLocations = showOnlyOwnRemote
                ? result.locations.filter((location) => (
                    location.type === 'remote' && location.ownerId === Number(currentUserId)
                ))
                : result.locations;

            setLocations(visibleLocations);
        }
    }, [currentUserId, listLocations, showOnlyOwnRemote]);

    useEffect(() => {
        void refreshLocations();
    }, [refreshLocations]);

    useEffect(() => {
        setExpandedLocationIds((current) => {
            const locationIds = new Set(locations.map((location) => location.id));
            return new Set([...current].filter((locationId) => locationIds.has(locationId)));
        });
    }, [locations]);

    useEffect(() => {
        if (isRootLocationType) setSelectedParentId(ROOT_LOCATION);
        else setSelectedParentId((current) => getValidParentId(current, parentOptions));
    }, [isRootLocationType, parentOptions, selectedParentId]);

    useEffect(() => {
        if (isEditingRootLocationType && editForm?.parentId !== ROOT_LOCATION) {
            setEditForm((current) => current ? { ...current, parentId: ROOT_LOCATION } : current);
        } else if (editForm && !isEditingRootLocationType) {
            const validParentId = getValidParentId(editForm.parentId, editParentOptions);
            if (validParentId !== editForm.parentId) {
                setEditForm((current) => current ? { ...current, parentId: validParentId } : current);
            }
        }
    }, [editForm, editParentOptions, isEditingRootLocationType]);

    const handleCreateLocation = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedName = newLocationName.trim();

        if (!trimmedName || (isParentRequired && selectedParentId === ROOT_LOCATION)) return;

        const result = await createLocation({
            name: trimmedName,
            type: newLocationType,
            parentId: isRootLocationType || selectedParentId === ROOT_LOCATION ? null : Number(selectedParentId),
            description: newLocationDescription.trim() || null,
            address: newLocationType === 'remote' ? newLocationAddress.trim() || null : null,
        });

        if (result.success) {
            setNewLocationName('');
            setNewLocationType(defaultNewLocationType);
            setSelectedParentId(ROOT_LOCATION);
            setNewLocationDescription('');
            setNewLocationAddress('');
            await refreshLocations();
        }
    };

    const openEditDialog = (location: Location) => {
        setEditingLocation(location);
        setEditForm({
            name: location.name,
            type: location.type,
            parentId: location.parentId ? String(location.parentId) : ROOT_LOCATION,
            description: location.description ?? '',
            address: location.address ?? '',
            status: location.isActive ? 'active' : 'inactive',
        });
        clearError();
        setHideError(null);
    };

    const closeEditDialog = () => {
        setEditingLocation(null);
        setEditForm(null);
        setHideError(null);
    };

    const handleUpdateLocation = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editingLocation || !editForm?.name.trim() || (isEditParentRequired && editForm.parentId === ROOT_LOCATION)) return;

        const result = await updateLocation(editingLocation.id, {
            name: editForm.name.trim(),
            type: editForm.type,
            parentId: editForm.type === 'building' || editForm.type === 'remote' || editForm.parentId === ROOT_LOCATION ? null : Number(editForm.parentId),
            description: editForm.description.trim() || null,
            address: editForm.type === 'remote' ? editForm.address.trim() || null : null,
            isActive: editForm.status === 'active',
        });

        if (result.success) {
            closeEditDialog();
            await refreshLocations();
        } else if (editForm.status === 'inactive') {
            setHideError({ locationName: editingLocation.name });
            clearError();
        }
    };

    const handleDeleteLocation = async () => {
        if (!deletingLocation) return;

        const locationName = deletingLocation.name;
        const result = await deleteLocation(deletingLocation.id);

        if (result.success) {
            setDeletingLocation(null);
            await refreshLocations();
        } else {
            setDeletingLocation(null);
            setDeleteError({
                locationName,
            });
            clearError();
        }
    };

    const handleSelectLocation = async (location: Location) => {
        setSelectedLocation(location);
        setLocationItems([]);
        setLocationItemsTotal(0);
        clearItemsError();

        const result = await listItems({ locationId: location.id, limit: 100 });
        if (result.success) {
            setLocationItems(result.items);
            setLocationItemsTotal(result.total);
        }
    };

    const refreshSelectedLocationItems = async () => {
        if (!selectedLocation) return;
        await handleSelectLocation(selectedLocation);
    };

    const toggleLocation = (locationId: number) => {
        setExpandedLocationIds((current) => {
            const next = new Set(current);

            if (next.has(locationId)) next.delete(locationId);
            else next.add(locationId);

            return next;
        });
    };

    const renderLocationNode = (node: LocationNode, level = 0) => {
        const LocationIcon = LOCATION_TYPE_ICONS[node.type] ?? MapPin;
        const hasChildren = node.children.length > 0;
        const isExpanded = expandedLocationIds.has(node.id);
        const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

        return (
            <Collapsible key={node.id} open={isExpanded} onOpenChange={() => toggleLocation(node.id)}>
                <div
                    className={`group flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-900 ${
                        selectedLocation?.id === node.id
                            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                            : 'border-transparent'
                    }`}
                    onClick={() => void handleSelectLocation(node)}
                    style={{ marginLeft: level * 20 }}
                >
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            {hasChildren ? (
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="icon-sm" className="-ml-1" onClick={(event) => event.stopPropagation()} aria-label={node.name}>
                                        <ChevronIcon />
                                    </Button>
                                </CollapsibleTrigger>
                            ) : (
                                <span className="block size-7 shrink-0" />
                            )}
                            <LocationIcon className={level === 0 ? 'size-4 text-emerald-500' : 'size-4 text-slate-400'} />
                            <span className={level === 0 ? 'truncate text-sm font-semibold' : 'truncate text-sm text-slate-600 dark:text-slate-400'}>
                                {node.name}
                            </span>
                        </div>
                        <div className="ml-12 mt-0.5 truncate text-[10px] text-slate-400">{node.path}</div>
                        {node.description && (
                            <div className="ml-12 mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{node.description}</div>
                        )}
                        {node.address && (
                            <div className="ml-12 mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                                {t('locationManager.addressInline', { address: node.address })}
                            </div>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {canManage && (
                            <>
                                <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100" onClick={(event) => {
                                    event.stopPropagation();
                                    const allowedChildTypes = LOCATION_TYPES.filter((type) => LOCATION_PARENT_TYPES[type].includes(node.type));
                                    const defaultType = (allowedChildTypes[0] ?? 'room') as LocationType;
                                    setNewLocationType(defaultType);
                                    setSelectedParentId(String(node.id));
                                    setNewLocationName('');
                                    setNewLocationDescription('');
                                    setNewLocationAddress('');
                                    setIsAddDialogOpen(true);
                                }} aria-label={t('locationManager.addTitle')}>
                                    <Plus />
                                </Button>
                                <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100" onClick={(event) => {
                                    event.stopPropagation();
                                    openEditDialog(node);
                                }} aria-label={t('locationManager.edit')}>
                                    <Pencil />
                                </Button>
                                <Button variant="ghost" size="icon-sm" className="text-rose-600 opacity-0 group-hover:opacity-100 dark:text-rose-300" onClick={(event) => {
                                    event.stopPropagation();
                                    setDeletingLocation(node);
                                }} aria-label={t('locationManager.delete')}>
                                    <Trash2 />
                                </Button>
                            </>
                        )}
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {t(`locationManager.types.${node.type}`)}
                        </span>
                    </div>
                </div>
                <CollapsibleContent>
                    {node.children.map((child) => renderLocationNode(child, level + 1))}
                </CollapsibleContent>
            </Collapsible>
        );
    };

    return (
        <div className="">
            <Card>
                <CardHeader className="flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle className="text-sm">Lokalizacje</CardTitle>
                        <CardDescription className="text-xs">Hierarchia lokalizacji</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon-sm" onClick={() => void refreshLocations()} disabled={isLoading} aria-label={t('locationManager.refresh')}>
                            <RefreshCw className={isLoading ? 'animate-spin' : ''} />
                        </Button>
                        {canAddLocation && (
                            <Button size="sm" onClick={() => { setIsAddDialogOpen(true); setSelectedParentId(ROOT_LOCATION); setNewLocationType(defaultNewLocationType); }}>
                                <Plus className="mr-2" />
                                {canManage ? t('locationManager.addButton') : t('locationManager.addRemoteButton')}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle />
                            <AlertTitle>{t('locationManager.errorTitle')}</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                            <Button variant="ghost" size="icon-sm" className="absolute right-2 top-2" onClick={clearError}>×</Button>
                        </Alert>
                    )}

                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                        {locationTree.length > 0
                            ? locationTree.map((node) => renderLocationNode(node))
                            : <p className="py-8 text-center text-sm text-slate-400">{isLoading ? t('locationManager.loading') : t('locationManager.emptyTree')}</p>}
                    </div>
                </CardContent>
            </Card>

            {selectedLocation && (
                <Card className="mt-4 overflow-hidden">
                    <CardHeader className="flex-row items-start justify-between gap-4">
                        <div className="min-w-0">
                            <CardTitle className="truncate text-sm">
                                {t('locationManager.itemsTitle', { name: selectedLocation.name })}
                            </CardTitle>
                            <CardDescription className="truncate text-xs">
                                {selectedLocation.path}
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="icon-sm" onClick={() => void refreshSelectedLocationItems()} disabled={areItemsLoading} aria-label={t('locationManager.refreshItems')}>
                            <RefreshCw className={areItemsLoading ? 'animate-spin' : ''} />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {itemsError && (
                            <Alert variant="destructive" className="mb-4">
                                <AlertCircle />
                                <AlertTitle>{t('locationManager.itemsErrorTitle')}</AlertTitle>
                                <AlertDescription>{itemsError}</AlertDescription>
                            </Alert>
                        )}

                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/80 dark:bg-slate-900/50">
                                    <TableHead>{t('dashboard.thName')}</TableHead>
                                    <TableHead>{t('dashboard.thCategory')}</TableHead>
                                    <TableHead>{t('dashboard.thStatus')}</TableHead>
                                    <TableHead>{t('dashboard.thOwner')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {areItemsLoading && locationItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="py-10 text-center text-slate-400">
                                            {t('locationManager.itemsLoading')}
                                        </TableCell>
                                    </TableRow>
                                ) : locationItems.length > 0 ? locationItems.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                                            {item.description && (
                                                <div className="line-clamp-1 text-[10px] text-slate-400">{item.description}</div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-slate-600 dark:text-slate-400">{item.category}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={item.status} label={t(`dashboard.itemStatuses.${item.status}`)} />
                                        </TableCell>
                                        <TableCell className="text-slate-600 dark:text-slate-400">{item.owner}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="py-10 text-center text-slate-400">
                                            {t('locationManager.itemsEmpty')}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>

                        {locationItemsTotal > locationItems.length && (
                            <p className="mt-3 text-xs text-slate-400">
                                {t('locationManager.itemsLimited', { shown: locationItems.length, total: locationItemsTotal })}
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {canAddLocation && <Dialog open={isAddDialogOpen} onOpenChange={(open: boolean) => !open && setIsAddDialogOpen(false)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{canManage ? t('locationManager.addTitle') : t('locationManager.addRemoteTitle')}</DialogTitle>
                    </DialogHeader>
                    <form id="add-location-form" onSubmit={(event) => { void handleCreateLocation(event); setIsAddDialogOpen(false); }} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-location-name">{t('locationManager.nameLabel')}</Label>
                            <Input
                                id="new-location-name"
                                value={newLocationName}
                                onChange={(event) => setNewLocationName(event.target.value)}
                                placeholder={t('locationManager.namePlaceholder')}
                                required
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>{t('locationManager.typeLabel')}</Label>
                                <Select value={newLocationType} onValueChange={(type: string) => setNewLocationType(type as LocationType)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {newLocationTypes.map((type) => (
                                            <SelectItem key={type} value={type}>{t(`locationManager.types.${type}`)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>{t('locationManager.parentLabel')}</Label>
                                <Select value={selectedParentId} onValueChange={setSelectedParentId} disabled={isRootLocationType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {isRootLocationType && <SelectItem value={ROOT_LOCATION}>{t('locationManager.rootLevel')}</SelectItem>}
                                        {parentOptions.map((location) => (
                                            <SelectItem key={location.id} value={String(location.id)}>{location.path}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-location-description">{t('locationManager.descriptionLabel')}</Label>
                            <Textarea
                                id="new-location-description"
                                value={newLocationDescription}
                                onChange={(event) => setNewLocationDescription(event.target.value)}
                                placeholder={t('locationManager.descriptionPlaceholder')}
                            />
                        </div>

                        {newLocationType === 'remote' && (
                            <div className="space-y-2">
                                <Label htmlFor="new-location-address">{t('locationManager.addressLabel')}</Label>
                                <Input
                                    id="new-location-address"
                                    value={newLocationAddress}
                                    onChange={(event) => setNewLocationAddress(event.target.value)}
                                    placeholder={t('locationManager.addressPlaceholder')}
                                />
                            </div>
                        )}
                    </form>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>{t('locationManager.cancel')}</Button>
                        <Button type="submit" form="add-location-form" disabled={isLoading || !newLocationName.trim() || (isParentRequired && selectedParentId === ROOT_LOCATION)}>
                            {isLoading ? t('locationManager.saving') : t('locationManager.addBtn')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>}

            {canManage && <Dialog open={Boolean(editingLocation && editForm)} onOpenChange={(open: boolean) => !open && closeEditDialog()}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{t('locationManager.editTitle')}</DialogTitle>
                    </DialogHeader>
                    {hideError && (
                        <Alert variant="destructive">
                            <AlertCircle />
                            <AlertTitle>{t('locationManager.hideErrorTitle')}</AlertTitle>
                            <AlertDescription>
                                {t('locationManager.hideErrorDesc', { name: hideError.locationName })}
                            </AlertDescription>
                        </Alert>
                    )}
                    {editForm && (
                        <form id="edit-location-form" onSubmit={(event) => void handleUpdateLocation(event)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-location-name">{t('locationManager.nameLabel')}</Label>
                                <Input
                                    id="edit-location-name"
                                    value={editForm.name}
                                    onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>{t('locationManager.typeLabel')}</Label>
                                    <Select value={editForm.type} onValueChange={(type: string) => setEditForm({ ...editForm, type: type as LocationType })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {LOCATION_TYPES.map((type) => (
                                                <SelectItem key={type} value={type}>{t(`locationManager.types.${type}`)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>{t('locationManager.statusLabel')}</Label>
                                    <Select value={editForm.status} onValueChange={(status: string) => setEditForm({ ...editForm, status: status as LocationFormState['status'] })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {LOCATION_STATUSES.map((status) => (
                                                <SelectItem key={status} value={status}>{t(`locationManager.statuses.${status}`)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>{t('locationManager.parentLabel')}</Label>
                                <Select value={editForm.parentId} onValueChange={(parentId: string) => setEditForm({ ...editForm, parentId })} disabled={isEditingRootLocationType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {isEditingRootLocationType && <SelectItem value={ROOT_LOCATION}>{t('locationManager.rootLevel')}</SelectItem>}
                                        {editParentOptions.map((location) => (
                                            <SelectItem key={location.id} value={String(location.id)}>{location.path}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-location-description">{t('locationManager.descriptionLabel')}</Label>
                                <Textarea
                                    id="edit-location-description"
                                    value={editForm.description}
                                    onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                                />
                            </div>

                            {editForm.type === 'remote' && (
                                <div className="space-y-2">
                                    <Label htmlFor="edit-location-address">{t('locationManager.addressLabel')}</Label>
                                    <Input
                                        id="edit-location-address"
                                        value={editForm.address}
                                        onChange={(event) => setEditForm({ ...editForm, address: event.target.value })}
                                        placeholder={t('locationManager.addressPlaceholder')}
                                    />
                                </div>
                            )}
                        </form>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={closeEditDialog}>{t('locationManager.cancel')}</Button>
                        <Button type="submit" form="edit-location-form" disabled={isLoading || !editForm?.name.trim() || (isEditParentRequired && editForm?.parentId === ROOT_LOCATION)}>
                            {isLoading ? t('locationManager.saving') : t('locationManager.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>}

            {canManage && <Dialog open={Boolean(deletingLocation)} onOpenChange={(open: boolean) => !open && setDeletingLocation(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('locationManager.deleteTitle')}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {t('locationManager.deleteDesc', { name: deletingLocation?.name })}
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingLocation(null)}>{t('locationManager.cancel')}</Button>
                        <Button variant="destructive" onClick={() => void handleDeleteLocation()} disabled={isLoading}>
                            {isLoading ? t('locationManager.deleting') : t('locationManager.confirmDelete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>}

            {canManage && <Dialog open={Boolean(deleteError)} onOpenChange={(open: boolean) => !open && setDeleteError(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-rose-700 dark:text-rose-300">{t('locationManager.deleteErrorTitle')}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {t('locationManager.deleteErrorDesc', { name: deleteError?.locationName })}
                    </p>
                    <DialogFooter>
                        <Button onClick={() => setDeleteError(null)}>{t('locationManager.close')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>}
        </div>
    );
}
