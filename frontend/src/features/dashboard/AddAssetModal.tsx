import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, MapPin, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import type { InventoryItem, AppUser } from '@/types';
import { ROLES } from '../auth/permissions';
import { useInventory } from '../inventory/useInventory';
import { useLocations } from '../locations/useLocations';
import { useUsers } from '../users/useUsers';
import { useCategories, type Category as CategoryType } from './useCategories';

type Category = { id: number; name: string; parentId: number | null };
type ApiUser = { id: number; firstName: string; lastName: string };
type LocationOption = { id: number; path: string; type: string; isActive: boolean; ownerId: number | null };
type ParameterField = { id: string; key: string; value: string };

const createParameterField = (): ParameterField => ({
    id: crypto.randomUUID(),
    key: '',
    value: '',
});

const buildParametersObject = (fields: ParameterField[]): Record<string, string> | null => {
    const parameters = fields.reduce<Record<string, string>>((accumulator, field) => {
        const key = field.key.trim();
        if (!key) return accumulator;
        accumulator[key] = field.value.trim();
        return accumulator;
    }, {});

    return Object.keys(parameters).length > 0 ? parameters : null;
};

const getUserName = (user: Pick<ApiUser, 'firstName' | 'lastName'>) =>
    `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();


type AddAssetModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: (asset: InventoryItem) => void;
    user: AppUser | null | undefined;
};

export default function AddAssetModal({ isOpen, onClose, onSave, user }: AddAssetModalProps) {
    const { t } = useTranslation();
    const { createItem, isLoading, error, clearError } = useInventory();
    const { listUsers } = useUsers();
    const {
        listLocations,
        createLocation,
        isLoading: isLocationSaving,
        error: locationError,
        clearError: clearLocationError,
    } = useLocations();
    const { listCategories } = useCategories();

    const isAdmin = user?.role === ROLES.ADMIN;

    const [categories, setCategories] = useState<Category[]>([]);
    const [users, setUsers] = useState<ApiUser[]>([]);
    const [locations, setLocations] = useState<LocationOption[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [locationsLoading, setLocationsLoading] = useState(false);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
    const [isRemoteLocationFormOpen, setIsRemoteLocationFormOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryParentId, setNewCategoryParentId] = useState('root');
    const [remoteLocationName, setRemoteLocationName] = useState('');
    const [remoteLocationAddress, setRemoteLocationAddress] = useState('');
    const [remoteLocationDescription, setRemoteLocationDescription] = useState('');
    const [pendingLocationId, setPendingLocationId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        categoryId: '',
        locationId: '',
        ownerId: '',
    });
    const [parameterFields, setParameterFields] = useState<ParameterField[]>([]);

    const indentedCategories = useMemo(() => {
        const result: Array<Category & { depth: number }> = [];
        const append = (parentId: number | null, depth = 0) => {
            categories.filter((category) => category.parentId === parentId).forEach((category) => {
                result.push({ ...category, depth });
                append(category.id, depth + 1);
            });
        };
        append(null);
        return result;
    }, [categories]);

    useEffect(() => {
        if (!isOpen || !user) return;

        clearError();
        clearLocationError();
        setIsCategoryDialogOpen(false);
        setParameterFields([]);
        setIsRemoteLocationFormOpen(false);
        setRemoteLocationName('');
        setRemoteLocationAddress('');
        setRemoteLocationDescription('');
        setPendingLocationId(null);

        const defaultOwnerId = isAdmin ? '' : String(user.id ?? '');

        setCategoriesLoading(true);
        listCategories()
            .then((result) => {
                if (!result.success) {
                    setCategories([]);
                    setFormData({
                        name: '',
                        description: '',
                        categoryId: '',
                        locationId: '',
                        ownerId: defaultOwnerId,
                    });
                    return;
                }

                const categories = result.categories.map((cat) => ({
                    id: cat.id,
                    name: cat.name,
                    parentId: cat.parentId,
                }));
                setCategories(categories);
                setFormData({
                    name: '',
                    description: '',
                    categoryId: String(categories[0]?.id ?? ''),
                    locationId: '',
                    ownerId: defaultOwnerId,
                });
            })
            .finally(() => setCategoriesLoading(false));

        setLocationsLoading(true);
        listLocations()
            .then((result) => {
                if (!result.success) {
                    setLocations([]);
                    return;
                }

                const availableLocations = result.locations
                    .filter((location) => location.isActive);

                setLocations(availableLocations);
                if (availableLocations.length > 0) {
                    setFormData((current) => ({
                        ...current,
                        locationId: String(availableLocations[0].id),
                    }));
                }
            })
            .finally(() => setLocationsLoading(false));

        if (!isAdmin) {
            setUsers([]);
            return;
        }

        setUsersLoading(true);
        listUsers({ status: 'active', limit: 100 })
            .then((result) => {
                if (!result.success) return;

                setUsers(result.users);
                if (result.users.length > 0) {
                    setFormData((current) => ({
                        ...current,
                        ownerId: current.ownerId || String(result.users[0].id),
                    }));
                }
            })
            .finally(() => setUsersLoading(false));
    }, [isOpen, clearError, isAdmin, user?.id, listUsers, listLocations, listCategories]);

    useEffect(() => {
        if (!pendingLocationId || !locations.some((location) => String(location.id) === pendingLocationId)) return;

        setFormData((current) => ({ ...current, locationId: pendingLocationId }));
        setPendingLocationId(null);
    }, [locations, pendingLocationId]);

    const handleAddCategory = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!isAdmin || !newCategoryName.trim()) return;

        const newCategory: Category = {
            id: Math.max(...categories.map((category) => category.id), 0) + 1,
            name: newCategoryName.trim(),
            parentId: newCategoryParentId === 'root' ? null : Number(newCategoryParentId),
        };
        setCategories((current) => [...current, newCategory]);
        setFormData((current) => ({ ...current, categoryId: String(newCategory.id) }));
        setNewCategoryName('');
        setNewCategoryParentId('root');
        setIsCategoryDialogOpen(false);
    };

    const handleAddParameter = () => {
        setParameterFields((current) => [...current, createParameterField()]);
    };

    const handleRemoveParameter = (fieldId: string) => {
        setParameterFields((current) => current.filter((field) => field.id !== fieldId));
    };

    const handleParameterChange = (fieldId: string, fieldName: 'key' | 'value', nextValue: string) => {
        setParameterFields((current) =>
            current.map((field) => (field.id === fieldId ? { ...field, [fieldName]: nextValue } : field)),
        );
    };

    const handleAddRemoteLocation = async () => {
        const trimmedName = remoteLocationName.trim();
        if (!trimmedName) return;

        clearLocationError();

        const result = await createLocation({
            name: trimmedName,
            type: 'remote',
            parentId: null,
            description: remoteLocationDescription.trim() || null,
            address: remoteLocationAddress.trim() || null,
        });

        if (!result.success || !result.location) return;

        const newLocation = result.location;
        setLocations((current) => [...current, newLocation]);
        setPendingLocationId(String(newLocation.id));
        setRemoteLocationName('');
        setRemoteLocationAddress('');
        setRemoteLocationDescription('');
        setIsRemoteLocationFormOpen(false);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!formData.name.trim()) return;

        const ownerId = isAdmin ? Number(formData.ownerId) : Number(user?.id);
        const locationId = Number(formData.locationId);
        if (!user || !ownerId || !locationId) return;

        const parameters = buildParametersObject(parameterFields);

        const result = await createItem({
            name: formData.name,
            categoryId: Number(formData.categoryId),
            locationId,
            ownerId,
            description: formData.description || null,
            parameters,
        });

        if (result.success && result.statusCode === 201) {
            const ownerName = isAdmin
                ? getUserName(users.find((entry) => entry.id === ownerId) ?? { firstName: '', lastName: '' })
                : (user?.name ?? '');

            onSave({
                id: result.data.id,
                inventory_number: result.data.inventory_number,
                status: result.data.status,
                name: formData.name,
                category: categories.find((category) => category.id === Number(formData.categoryId))?.name ?? '',
                location: locations.find((location) => location.id === locationId)?.path ?? '',
                owner: ownerName,
                ownerId,
                description: formData.description,
            });
            onClose();
        }
    };

    if (!user) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{t('addAssetModal.modalTitle')}</DialogTitle>
                        <DialogDescription>{t('addAssetModal.description')}</DialogDescription>
                    </DialogHeader>

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle />
                            <AlertTitle>{t('auth.loginErrorTitle')}</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <form id="add-asset-form" onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="asset-name">{t('addAssetModal.name')} *</Label>
                            <Input
                                id="asset-name"
                                value={formData.name}
                                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                                disabled={isLoading}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="asset-description">{t('addAssetModal.description')}</Label>
                                <span className="text-xs text-slate-400">{formData.description.length}/256</span>
                            </div>
                            <Textarea
                                id="asset-description"
                                maxLength={256}
                                value={formData.description}
                                onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                                disabled={isLoading}
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                                 <Label htmlFor="asset-category">{t('addAssetModal.category')} *</Label>
                                 <div className={isAdmin ? 'flex gap-2' : ''}>
                                     <Select value={formData.categoryId} onValueChange={(categoryId) => setFormData((current) => ({ ...current, categoryId }))} disabled={categoriesLoading}>
                                         <SelectTrigger id="asset-category" className={isAdmin ? undefined : 'w-full'}><SelectValue /></SelectTrigger>
                                         <SelectContent>
                                             {indentedCategories.map((category) => (
                                                 <SelectItem key={category.id} value={String(category.id)}>
                                                     {'— '.repeat(category.depth)}{category.name}
                                                 </SelectItem>
                                             ))}
                                         </SelectContent>
                                     </Select>
                                     {isAdmin && (
                                         <Button type="button" variant="outline" size="icon" onClick={() => setIsCategoryDialogOpen(true)} aria-label={t('addAssetModal.addNewCategory')} disabled={categoriesLoading}>
                                             <Plus />
                                         </Button>
                                     )}
                                 </div>
                             </div>
                            <div className="space-y-2">
                                <Label htmlFor="asset-owner">{t('addAssetModal.owner')} *</Label>
                                {isAdmin ? (
                                    <Select
                                        value={formData.ownerId}
                                        onValueChange={(ownerId) => setFormData((current) => ({ ...current, ownerId }))}
                                        disabled={usersLoading}
                                    >
                                        <SelectTrigger id="asset-owner"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {users.map((owner) => (
                                                <SelectItem key={owner.id} value={String(owner.id)}>
                                                    {getUserName(owner)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <>
                                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                                            {user.name}
                                        </div>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                            {t('addAssetModal.ownerSelfHint')}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <Label>{t('addAssetModal.parametersTitle')}</Label>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('addAssetModal.parametersHint')}</p>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={handleAddParameter} disabled={isLoading}>
                                    <Plus className="mr-1 h-4 w-4" />
                                    {t('addAssetModal.addParameter')}
                                </Button>
                            </div>

                            {parameterFields.length > 0 && (
                                <div className="space-y-2">
                                    {parameterFields.map((field) => (
                                        <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                            <Input
                                                value={field.key}
                                                onChange={(event) => handleParameterChange(field.id, 'key', event.target.value)}
                                                placeholder={t('addAssetModal.parameterKey')}
                                                disabled={isLoading}
                                            />
                                            <Input
                                                value={field.value}
                                                onChange={(event) => handleParameterChange(field.id, 'value', event.target.value)}
                                                placeholder={t('addAssetModal.parameterValue')}
                                                disabled={isLoading}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handleRemoveParameter(field.id)}
                                                aria-label={t('addAssetModal.removeParameter')}
                                                disabled={isLoading}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Separator />

                        <div className="space-y-3">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <Label htmlFor="asset-location">
                                        {isAdmin ? t('addAssetModal.building') : t('addAssetModal.locationTitle')} *
                                    </Label>
                                    {!isAdmin && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setIsRemoteLocationFormOpen((open) => !open)}
                                        >
                                            <MapPin className="size-4" />
                                            {t('addAssetModal.addRemoteLocation')}
                                        </Button>
                                    )}
                                </div>
                                <Select
                                    value={formData.locationId}
                                    onValueChange={(locationId) => setFormData((current) => ({ ...current, locationId }))}
                                    disabled={locationsLoading || locations.length === 0}
                                >
                                    <SelectTrigger id="asset-location"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {locations.map((location) => (
                                            <SelectItem key={location.id} value={String(location.id)}>
                                                {location.path}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {isAdmin && !locationsLoading && locations.length === 0 && (
                                    <p className="text-xs text-rose-600 dark:text-rose-400">{t('addAssetModal.noLocations')}</p>
                                )}
                                {!isAdmin && locations.length === 0 && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {t('addAssetModal.noRemoteLocations')}
                                    </p>
                                )}
                            </div>

                            {!isAdmin && isRemoteLocationFormOpen && (
                                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                                    {locationError && (
                                        <Alert variant="destructive">
                                            <AlertCircle />
                                            <AlertTitle>{t('addAssetModal.remoteLocationErrorTitle')}</AlertTitle>
                                            <AlertDescription>{locationError}</AlertDescription>
                                        </Alert>
                                    )}
                                    <div className="space-y-2">
                                        <Label htmlFor="remote-location-name">{t('addAssetModal.remoteLocationName')} *</Label>
                                        <Input
                                            id="remote-location-name"
                                            value={remoteLocationName}
                                            onChange={(event) => setRemoteLocationName(event.target.value)}
                                            placeholder={t('addAssetModal.remoteLocationNamePlaceholder')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="remote-location-address">{t('addAssetModal.remoteLocationAddress')}</Label>
                                        <Input
                                            id="remote-location-address"
                                            value={remoteLocationAddress}
                                            onChange={(event) => setRemoteLocationAddress(event.target.value)}
                                            placeholder={t('addAssetModal.remoteLocationAddressPlaceholder')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="remote-location-description">{t('addAssetModal.remoteLocationDescription')}</Label>
                                        <Textarea
                                            id="remote-location-description"
                                            value={remoteLocationDescription}
                                            onChange={(event) => setRemoteLocationDescription(event.target.value)}
                                            placeholder={t('addAssetModal.remoteLocationDescriptionPlaceholder')}
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <Button type="button" variant="outline" onClick={() => setIsRemoteLocationFormOpen(false)}>
                                            {t('addAssetModal.cancelRemoteLocation')}
                                        </Button>
                                        <Button type="button" onClick={() => void handleAddRemoteLocation()} disabled={isLocationSaving || !remoteLocationName.trim()}>
                                            {isLocationSaving ? t('addAssetModal.savingRemoteLocation') : t('addAssetModal.saveRemoteLocation')}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </form>

                    <DialogFooter>
                         <Button type="button" variant="outline" onClick={onClose} disabled={isLoading || isLocationSaving || categoriesLoading}>{t('addAssetModal.cancel')}</Button>
                         <Button type="submit" form="add-asset-form" disabled={isLoading || isLocationSaving || locationsLoading || locations.length === 0 || (isAdmin && usersLoading) || categoriesLoading || categories.length === 0 || !formData.categoryId}>
                             {isLoading ? t('addAssetModal.saving') : t('addAssetModal.save')}
                         </Button>
                     </DialogFooter>
                </DialogContent>
            </Dialog>

            {isAdmin && (
            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{t('addAssetModal.addNewCategory')}</DialogTitle>
                    </DialogHeader>
                    <form id="add-category-form" onSubmit={handleAddCategory} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="category-name">{t('addAssetModal.categoryName')}</Label>
                            <Input id="category-name" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder={t('addAssetModal.categoryPlaceholder')} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="asset-new-category-parent">{t('addAssetModal.categoryParentLabel')}</Label>
                            <Select value={newCategoryParentId} onValueChange={setNewCategoryParentId}>
                                <SelectTrigger id="asset-new-category-parent"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="root">{t('addAssetModal.noParent')}</SelectItem>
                                    {categories.filter((category) => !category.parentId).map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </form>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>{t('addAssetModal.cancelCategory')}</Button>
                        <Button type="submit" form="add-category-form">{t('addAssetModal.saveCategory')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            )}
        </>
    );
}
