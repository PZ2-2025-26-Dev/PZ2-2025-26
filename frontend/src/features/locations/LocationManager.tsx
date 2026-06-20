import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, Building2, FolderTree, Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useLocations, type Location, type LocationType } from './useLocations';

type LocationNode = Location & { children: LocationNode[] };

const ROOT_LOCATION = 'root';
const LOCATION_TYPES: LocationType[] = ['building', 'room', 'cabinet', 'shelf', 'other'];

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

export default function LocationManager() {
    const { t } = useTranslation();
    const { listLocations, createLocation, isLoading, error, clearError } = useLocations();

    const [locations, setLocations] = useState<Location[]>([]);
    const [newLocationName, setNewLocationName] = useState('');
    const [newLocationType, setNewLocationType] = useState<LocationType>('building');
    const [selectedParentId, setSelectedParentId] = useState(ROOT_LOCATION);
    const [newLocationDescription, setNewLocationDescription] = useState('');

    const locationTree = useMemo(() => buildLocationTree(locations), [locations]);
    const parentOptions = useMemo(() => flattenLocations(locations), [locations]);

    const refreshLocations = useCallback(async () => {
        const result = await listLocations();
        if (result.success) setLocations(result.locations);
    }, [listLocations]);

    useEffect(() => {
        void refreshLocations();
    }, [refreshLocations]);

    const handleCreateLocation = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedName = newLocationName.trim();

        if (!trimmedName) return;

        const result = await createLocation({
            name: trimmedName,
            type: newLocationType,
            parentId: selectedParentId === ROOT_LOCATION ? null : Number(selectedParentId),
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

    const renderLocationNode = (node: LocationNode, level = 0) => (
        <div key={node.id}>
            <div
                className="group flex items-center justify-between rounded-lg border border-transparent px-3 py-2 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-900"
                style={{ marginLeft: level * 20 }}
            >
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        {node.children.length > 0 ? <FolderTree className="size-4 text-emerald-500" /> : <Building2 className="size-4 text-slate-400" />}
                        <span className={level === 0 ? 'truncate text-sm font-semibold' : 'truncate text-sm text-slate-600 dark:text-slate-400'}>
                            {node.name}
                        </span>
                    </div>
                    <div className="ml-6 mt-0.5 truncate text-[10px] text-slate-400">{node.path}</div>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {t(`locationManager.types.${node.type}`)}
                </span>
            </div>
            {node.children.map((child) => renderLocationNode(child, level + 1))}
        </div>
    );

    return (
        <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
                <CardHeader className="flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle className="text-sm">{t('locationManager.treeTitle')}</CardTitle>
                        <CardDescription className="text-xs">{t('locationManager.treeDesc')}</CardDescription>
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
                            <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ROOT_LOCATION}>{t('locationManager.rootLevel')}</SelectItem>
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

                        <Button type="submit" className="w-full" disabled={isLoading || !newLocationName.trim()}>
                            <Plus />
                            {isLoading ? t('locationManager.saving') : t('locationManager.addBtn')}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
