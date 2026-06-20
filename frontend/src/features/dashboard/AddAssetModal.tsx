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
import type { InventoryItem } from '@/types';
import { useInventory } from '../inventory/useInventory';

type Category = { id: number; name: string; parentId: number | null };

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

const USERS = [
    { id: 1, name: 'Adam Nowak' },
    { id: 2, name: 'dr inż. Jan Kowalski' },
    { id: 3, name: 'prof. dr hab. Andrzej Nowak' },
    { id: 4, name: 'Jakub Wiśniewski' },
    { id: 5, name: 'Anna Malik' },
];

const LOCATIONS = [
    { id: 1, path: 'Budynek D10' },
    { id: 2, path: 'Budynek D11' },
    { id: 3, path: 'Budynek C3' },
];

type AddAssetModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: (asset: InventoryItem) => void;
};

export default function AddAssetModal({ isOpen, onClose, onSave }: AddAssetModalProps) {
    const { t } = useTranslation();
    const { createItem, isLoading, error, clearError } = useInventory();
    const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryParentId, setNewCategoryParentId] = useState('root');
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        categoryId: String(INITIAL_CATEGORIES[0].id),
        locationId: String(LOCATIONS[0].id),
        ownerId: String(USERS[0].id),
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
        setFormData({
            name: '',
            description: '',
            categoryId: String(categories[0]?.id ?? ''),
            locationId: String(LOCATIONS[0].id),
            ownerId: String(USERS[0].id),
        });
        clearError();
    }, [isOpen, categories, clearError]);

    const handleAddCategory = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!newCategoryName.trim()) return;

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

        const result = await createItem({
            name: formData.name,
            categoryId: Number(formData.categoryId),
            locationId: Number(formData.locationId),
            ownerId: Number(formData.ownerId),
            description: formData.description || null,
        });

        if (result.success && result.statusCode === 201) {
            onSave({
                id: result.data.id,
                inventory_number: result.data.inventory_number,
                status: result.data.status,
                name: formData.name,
                category: categories.find((category) => category.id === Number(formData.categoryId))?.name ?? '',
                location: LOCATIONS.find((location) => location.id === Number(formData.locationId))?.path ?? '',
                owner: USERS.find((owner) => owner.id === Number(formData.ownerId))?.name ?? '',
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
                                <div className="flex gap-2">
                                    <Select value={formData.categoryId} onValueChange={(categoryId) => setFormData((current) => ({ ...current, categoryId }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {indentedCategories.map((category) => (
                                                <SelectItem key={category.id} value={String(category.id)}>
                                                    {'— '.repeat(category.depth)}{category.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button type="button" variant="outline" size="icon" onClick={() => setIsCategoryDialogOpen(true)} aria-label={t('addAssetModal.addNewCategory')}>
                                        <Plus />
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('addAssetModal.owner')} *</Label>
                                <Select value={formData.ownerId} onValueChange={(ownerId) => setFormData((current) => ({ ...current, ownerId }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{USERS.map((owner) => <SelectItem key={owner.id} value={String(owner.id)}>{owner.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <Label>{t('addAssetModal.building')} *</Label>
                            <Select value={formData.locationId} onValueChange={(locationId) => setFormData((current) => ({ ...current, locationId }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{LOCATIONS.map((location) => <SelectItem key={location.id} value={String(location.id)}>{location.path}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </form>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>{t('addAssetModal.cancel')}</Button>
                        <Button type="submit" form="add-asset-form" disabled={isLoading}>
                            {isLoading ? t('addAssetModal.saving') : t('addAssetModal.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
        </>
    );
}
