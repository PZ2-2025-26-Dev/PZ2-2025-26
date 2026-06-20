import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, Archive, Building2, ChevronDown, ChevronRight, DoorOpen, Layers3, MapPin, Pencil, Plus, RefreshCw, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useLocations, type Location, type LocationType } from './useLocations';

type LocationNode = Location & { children: LocationNode[] };

const ROOT_LOCATION = 'root';
const LOCATION_TYPES: LocationType[] = ['building', 'room', 'cabinet', 'shelf', 'other'];
const LOCATION_STATUSES = ['active', 'inactive'] as const;
const LOCATION_TYPE_ICONS: Record<LocationType, LucideIcon> = {
    building: Building2,
    room: DoorOpen,
    cabinet: Archive,
    shelf: Layers3,
    other: MapPin,
};
const LOCATION_PARENT_TYPES: Record<LocationType, LocationType[]> = {
    building: [],
    room: ['building'],
    cabinet: ['room'],
    shelf: ['cabinet'],
    other: ['building', 'room', 'cabinet', 'shelf', 'other'],
};

type LocationFormState = {
    name: string;
    type: LocationType;
    parentId: string;
    description: string;
    status: typeof LOCATION_STATUSES[number];
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

    return roots;
};

const flattenLocations = (locations: Location[]) => [...locations].sort((first, second) => first.path.localeCompare(second.path));

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

export default function LocationManager() {
    const { t } = useTranslation();
    const { listLocations, createLocation, updateLocation, isLoading, error, clearError } = useLocations();

    const [locations, setLocations] = useState<Location[]>([]);
    const [newLocationName, setNewLocationName] = useState('');
    const [newLocationType, setNewLocationType] = useState<LocationType>('building');
    const [selectedParentId, setSelectedParentId] = useState(ROOT_LOCATION);
    const [newLocationDescription, setNewLocationDescription] = useState('');
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);
    const [editForm, setEditForm] = useState<LocationFormState | null>(null);
    const [expandedLocationIds, setExpandedLocationIds] = useState<Set<number>>(() => new Set());

    const locationTree = useMemo(() => buildLocationTree(locations), [locations]);
    const parentOptions = useMemo(() => getParentOptions(locations, newLocationType), [locations, newLocationType]);
    const editParentOptions = useMemo(() => {
        if (!editingLocation || !editForm) return [];

        const blockedIds = collectDescendantIds(editingLocation.id, locations);
        blockedIds.add(editingLocation.id);

        return getParentOptions(locations, editForm.type).filter((location) => !blockedIds.has(location.id));
    }, [editForm, editingLocation, locations]);
    const isBuildingType = newLocationType === 'building';
    const isEditingBuildingType = editForm?.type === 'building';
    const isParentRequired = !isBuildingType;
    const isEditParentRequired = Boolean(editForm && !isEditingBuildingType);

    const refreshLocations = useCallback(async () => {
        const result = await listLocations();
        if (result.success) setLocations(result.locations);
    }, [listLocations]);

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
        if (isBuildingType) setSelectedParentId(ROOT_LOCATION);
        else setSelectedParentId((current) => getValidParentId(current, parentOptions));
    }, [isBuildingType, parentOptions, selectedParentId]);

    useEffect(() => {
        if (isEditingBuildingType && editForm?.parentId !== ROOT_LOCATION) {
            setEditForm((current) => current ? { ...current, parentId: ROOT_LOCATION } : current);
        } else if (editForm && !isEditingBuildingType) {
            const validParentId = getValidParentId(editForm.parentId, editParentOptions);
            if (validParentId !== editForm.parentId) {
                setEditForm((current) => current ? { ...current, parentId: validParentId } : current);
            }
        }
    }, [editForm, editParentOptions, isEditingBuildingType]);

    const handleCreateLocation = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedName = newLocationName.trim();

        if (!trimmedName || (isParentRequired && selectedParentId === ROOT_LOCATION)) return;

        const result = await createLocation({
            name: trimmedName,
            type: newLocationType,
            parentId: isBuildingType || selectedParentId === ROOT_LOCATION ? null : Number(selectedParentId),
            description: newLocationDescription.trim() || null,
        });

        if (result.success) {
            setNewLocationName('');
            setNewLocationType('building');
            setSelectedParentId(ROOT_LOCATION);
            setNewLocationDescription('');
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
            status: location.isActive ? 'active' : 'inactive',
        });
        clearError();
    };

    const closeEditDialog = () => {
        setEditingLocation(null);
        setEditForm(null);
    };

    const handleUpdateLocation = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editingLocation || !editForm?.name.trim() || (isEditParentRequired && editForm.parentId === ROOT_LOCATION)) return;

        const result = await updateLocation(editingLocation.id, {
            name: editForm.name.trim(),
            type: editForm.type,
            parentId: editForm.type === 'building' || editForm.parentId === ROOT_LOCATION ? null : Number(editForm.parentId),
            description: editForm.description.trim() || null,
            isActive: editForm.status === 'active',
        });

        if (result.success) {
            closeEditDialog();
            await refreshLocations();
        }
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
                    className="group flex items-center justify-between rounded-lg border border-transparent px-3 py-2 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-900"
                    style={{ marginLeft: level * 20 }}
                >
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            {hasChildren ? (
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="icon-sm" className="-ml-1" aria-label={node.name}>
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
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100" onClick={() => openEditDialog(node)} aria-label={t('locationManager.edit')}>
                            <Pencil />
                        </Button>
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
        <div className="grid gap-6 lg:grid-cols-3">
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">{t('locationManager.addTitle')}</CardTitle>
                    <CardDescription className="text-xs">{t('locationManager.addDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle />
                            <AlertTitle>{t('locationManager.errorTitle')}</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                            <Button variant="ghost" size="icon-sm" className="absolute right-2 top-2" onClick={clearError}>×</Button>
                        </Alert>
                    )}

                    <form onSubmit={(event) => void handleCreateLocation(event)} className="space-y-4">
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

                        <div className="space-y-2">
                            <Label>{t('locationManager.typeLabel')}</Label>
                            <Select value={newLocationType} onValueChange={(type) => setNewLocationType(type as LocationType)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {LOCATION_TYPES.map((type) => (
                                        <SelectItem key={type} value={type}>{t(`locationManager.types.${type}`)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>{t('locationManager.parentLabel')}</Label>
                            <Select value={selectedParentId} onValueChange={setSelectedParentId} disabled={isBuildingType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {isBuildingType && <SelectItem value={ROOT_LOCATION}>{t('locationManager.rootLevel')}</SelectItem>}
                                    {parentOptions.map((location) => (
                                        <SelectItem key={location.id} value={String(location.id)}>{location.path}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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

                        <Button type="submit" className="w-full" disabled={isLoading || !newLocationName.trim() || (isParentRequired && selectedParentId === ROOT_LOCATION)}>
                            <Plus />
                            {isLoading ? t('locationManager.saving') : t('locationManager.addBtn')}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card className="lg:col-span-2">
                <CardHeader className="flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle className="text-sm">{t('locationManager.treeTitle')}</CardTitle>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void refreshLocations()} disabled={isLoading}>
                        <RefreshCw className={isLoading ? 'animate-spin' : ''} />
                        {t('locationManager.refresh')}
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                        {locationTree.length > 0
                            ? locationTree.map((node) => renderLocationNode(node))
                            : <p className="py-8 text-center text-sm text-slate-400">{isLoading ? t('locationManager.loading') : t('locationManager.emptyTree')}</p>}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={Boolean(editingLocation && editForm)} onOpenChange={(open) => !open && closeEditDialog()}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{t('locationManager.editTitle')}</DialogTitle>
                    </DialogHeader>
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
                                    <Select value={editForm.type} onValueChange={(type) => setEditForm({ ...editForm, type: type as LocationType })}>
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
                                    <Select value={editForm.status} onValueChange={(status) => setEditForm({ ...editForm, status: status as LocationFormState['status'] })}>
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
                                <Select value={editForm.parentId} onValueChange={(parentId) => setEditForm({ ...editForm, parentId })} disabled={isEditingBuildingType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {isEditingBuildingType && <SelectItem value={ROOT_LOCATION}>{t('locationManager.rootLevel')}</SelectItem>}
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
                        </form>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={closeEditDialog}>{t('locationManager.cancel')}</Button>
                        <Button type="submit" form="edit-location-form" disabled={isLoading || !editForm?.name.trim() || (isEditParentRequired && editForm?.parentId === ROOT_LOCATION)}>
                            {isLoading ? t('locationManager.saving') : t('locationManager.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
