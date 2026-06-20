import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, Plus } from 'lucide-react';
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

type Category = { id: number; name: string; parentId: number | null };
type ApiUser = { id: number; firstName: string; lastName: string };
type LocationOption = { id: number; path: string };

const getUserName = (user: Pick<ApiUser, 'firstName' | 'lastName'>) =>
    `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();

const INITIAL_CATEGORIES: Category[] = [
    { id: 1, name: 'Aparatura pomiarowa', parentId: null },
    { id: 2, name: 'Oscyloskopy', parentId: 1 },
    { id: 3, name: 'Generatory funkcyjne', parentId: 1 },
    { id: 4, name: 'Aparatura zasilająca', parentId: null },
    { id: 5, name: 'Zasilacze laboratoryjne', parentId: 4 },
    { id: 6, name: 'Sprzęt IT', parentId: null },
    { id: 7, name: 'Laptopy', parentId: 6 },
    { id: 8, name: 'Akcesoria i optyka', parentId: null },
];

type AddAssetModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: (asset: InventoryItem) => void;
    user: AppUser;
};

export default function AddAssetModal({ isOpen, onClose, onSave, user }: AddAssetModalProps) {
    const { t } = useTranslation();
    const { createItem, isLoading, error, clearError } = useInventory();
    const { listUsers } = useUsers();
    const { listLocations } = useLocations();

    const isAdmin = user.role === ROLES.ADMIN;

    const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
    const [users, setUsers] = useState<ApiUser[]>([]);
    const [locations, setLocations] = useState<LocationOption[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [locationsLoading, setLocationsLoading] = useState(false);
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryParentId, setNewCategoryParentId] = useState('root');
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        categoryId: String(INITIAL_CATEGORIES[0].id),
        locationId: '',
        ownerId: '',
    });

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
        if (!isOpen) return;

        clearError();
        setIsCategoryDialogOpen(false);

        const defaultOwnerId = isAdmin ? '' : String(user.id ?? '');
        setFormData({
            name: '',
            description: '',
            categoryId: String(categories[0]?.id ?? ''),
            locationId: '',
            ownerId: defaultOwnerId,
        });

        setLocationsLoading(true);
        listLocations({ limit: 100 })
            .then((result) => {
                if (!result.success) {
                    setLocations([]);
                    return;
                }

                setLocations(result.locations);
                if (result.locations.length > 0) {
                    setFormData((current) => ({
                        ...current,
                        locationId: String(result.locations[0].id),
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
    }, [isOpen, categories, clearError, isAdmin, user.id, listUsers, listLocations]);

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

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!formData.name.trim()) return;

        const ownerId = isAdmin ? Number(formData.ownerId) : Number(user.id);
        const locationId = Number(formData.locationId);
        if (!ownerId || !locationId) return;

        const result = await createItem({
            name: formData.name,
            categoryId: Number(formData.categoryId),
            locationId,
            ownerId,
            description: formData.description || null,
        });

        if (result.success && result.statusCode === 201) {
            const ownerName = isAdmin
                ? getUserName(users.find((entry) => entry.id === ownerId) ?? { firstName: '', lastName: '' })
                : user.name;

            onSave({
                id: result.data.id,
                inventory_number: result.data.inventory_number,
                status: result.data.status,
                name: formData.name,
                category: categories.find((category) => category.id === Number(formData.categoryId))?.name ?? '',
                location: locations.find((location) => location.id === locationId)?.path ?? '',
                owner: ownerName,
                description: formData.description,
            });
            onClose();
        }
    };

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
                                <Label>{t('addAssetModal.category')} *</Label>
                                <div className={isAdmin ? 'flex gap-2' : ''}>
                                    <Select value={formData.categoryId} onValueChange={(categoryId) => setFormData((current) => ({ ...current, categoryId }))}>
                                        <SelectTrigger className={isAdmin ? undefined : 'w-full'}><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {indentedCategories.map((category) => (
                                                <SelectItem key={category.id} value={String(category.id)}>
                                                    {'— '.repeat(category.depth)}{category.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {isAdmin && (
                                        <Button type="button" variant="outline" size="icon" onClick={() => setIsCategoryDialogOpen(true)} aria-label={t('addAssetModal.addNewCategory')}>
                                            <Plus />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('addAssetModal.owner')} *</Label>
                                {isAdmin ? (
                                    <Select
                                        value={formData.ownerId}
                                        onValueChange={(ownerId) => setFormData((current) => ({ ...current, ownerId }))}
                                        disabled={usersLoading}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
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

                        <div className="space-y-2">
                            <Label>{t('addAssetModal.building')} *</Label>
                            <Select
                                value={formData.locationId}
                                onValueChange={(locationId) => setFormData((current) => ({ ...current, locationId }))}
                                disabled={locationsLoading || locations.length === 0}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {locations.map((location) => (
                                        <SelectItem key={location.id} value={String(location.id)}>
                                            {location.path}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </form>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>{t('addAssetModal.cancel')}</Button>
                        <Button type="submit" form="add-asset-form" disabled={isLoading || locationsLoading || locations.length === 0 || (isAdmin && usersLoading)}>
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
                            <Label>{t('addAssetModal.categoryParentLabel')}</Label>
                            <Select value={newCategoryParentId} onValueChange={setNewCategoryParentId}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
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
