import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Folder, FolderTree, Pencil, Plus, RefreshCw } from 'lucide-react';
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
import { useCategories, type Category } from './useCategories';

type CategoryNode = Category & { children: CategoryNode[] };

const ROOT_CATEGORY = 'root';
const CATEGORY_STATUSES = ['active', 'inactive'] as const;

type CategoryFormState = {
    name: string;
    parentId: string;
    description: string;
    status: typeof CATEGORY_STATUSES[number];
};

const buildCategoryTree = (categories: Category[]) => {
    const lookup: Record<number, CategoryNode> = {};
    const roots: CategoryNode[] = [];

    categories.forEach((category) => {
        lookup[category.id] = { ...category, children: [] };
    });

    categories.forEach((category) => {
        const node = lookup[category.id];
        const parent = category.parentId ? lookup[category.parentId] : null;

        if (parent) parent.children.push(node);
        else roots.push(node);
    });

    return roots;
};

const flattenCategories = (categories: Category[]) => [...categories].sort((first, second) => first.path.localeCompare(second.path));

const getParentOptions = (categories: Category[]) => {
    return flattenCategories(categories);
};

const getValidParentId = (currentParentId: string, options: Category[]) => {
    if (currentParentId === ROOT_CATEGORY) return ROOT_CATEGORY;
    if (options.some((category) => String(category.id) === currentParentId)) return currentParentId;
    return ROOT_CATEGORY;
};

const collectDescendantIds = (categoryId: number, categories: Category[]) => {
    const descendants = new Set<number>();
    const collect = (parentId: number) => {
        categories
            .filter((category) => category.parentId === parentId)
            .forEach((category) => {
                descendants.add(category.id);
                collect(category.id);
            });
    };

    collect(categoryId);
    return descendants;
};

export default function CategoryManager() {
    const { t } = useTranslation();
    const { listCategories, createCategory, updateCategory, isLoading, error, clearError } = useCategories();

    const [categories, setCategories] = useState<Category[]>([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [selectedParentId, setSelectedParentId] = useState(ROOT_CATEGORY);
    const [newCategoryDescription, setNewCategoryDescription] = useState('');
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [editForm, setEditForm] = useState<CategoryFormState | null>(null);
    const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<number>>(() => new Set());

    const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
    const parentOptions = useMemo(() => getParentOptions(categories), [categories]);
    const editParentOptions = useMemo(() => {
        if (!editingCategory || !editForm) return [];

        const blockedIds = collectDescendantIds(editingCategory.id, categories);
        blockedIds.add(editingCategory.id);

        return getParentOptions(categories).filter((category) => !blockedIds.has(category.id));
    }, [editForm, editingCategory, categories]);

    const refreshCategories = useCallback(async () => {
        const result = await listCategories();
        if (result.success) setCategories(result.categories);
    }, [listCategories]);

    useEffect(() => {
        void refreshCategories();
    }, [refreshCategories]);

    useEffect(() => {
        setExpandedCategoryIds((current) => {
            const categoryIds = new Set(categories.map((category) => category.id));
            return new Set([...current].filter((categoryId) => categoryIds.has(categoryId)));
        });
    }, [categories]);

    useEffect(() => {
        setSelectedParentId((current) => getValidParentId(current, parentOptions));
    }, [parentOptions]);

    useEffect(() => {
        if (editForm) {
            const validParentId = getValidParentId(editForm.parentId, editParentOptions);
            if (validParentId !== editForm.parentId) {
                setEditForm((current) => current ? { ...current, parentId: validParentId } : current);
            }
        }
    }, [editForm, editParentOptions]);

    const handleCreateCategory = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedName = newCategoryName.trim();

        if (!trimmedName) return;

        const result = await createCategory({
            name: trimmedName,
            parentId: selectedParentId === ROOT_CATEGORY ? null : Number(selectedParentId),
            description: newCategoryDescription.trim() || null,
        });

        if (result.success) {
            setNewCategoryName('');
            setSelectedParentId(ROOT_CATEGORY);
            setNewCategoryDescription('');
            await refreshCategories();
        }
    };

    const openEditDialog = (category: Category) => {
        setEditingCategory(category);
        setEditForm({
            name: category.name,
            parentId: category.parentId ? String(category.parentId) : ROOT_CATEGORY,
            description: category.description ?? '',
            status: category.isActive ? 'active' : 'inactive',
        });
        clearError();
    };

    const closeEditDialog = () => {
        setEditingCategory(null);
        setEditForm(null);
    };

    const handleUpdateCategory = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editingCategory || !editForm?.name.trim()) return;

        const result = await updateCategory(editingCategory.id, {
            name: editForm.name.trim(),
            parentId: editForm.parentId === ROOT_CATEGORY ? null : Number(editForm.parentId),
            description: editForm.description.trim() || null,
            isActive: editForm.status === 'active',
        });

        if (result.success) {
            closeEditDialog();
            await refreshCategories();
        }
    };

    const toggleCategory = (categoryId: number) => {
        setExpandedCategoryIds((current) => {
            const next = new Set(current);

            if (next.has(categoryId)) next.delete(categoryId);
            else next.add(categoryId);

            return next;
        });
    };

    const renderCategoryNode = (node: CategoryNode, level = 0) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = expandedCategoryIds.has(node.id);
        const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;
        const CategoryIcon = hasChildren ? FolderTree : Folder;

        return (
            <Collapsible key={node.id} open={isExpanded} onOpenChange={() => toggleCategory(node.id)}>
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
                            <CategoryIcon className={level === 0 ? 'size-4 text-emerald-500' : 'size-4 text-slate-400'} />
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
                        <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100" onClick={() => openEditDialog(node)} aria-label={t('categoryManager.edit')}>
                            <Pencil />
                        </Button>
                    </div>
                </div>
                <CollapsibleContent>
                    {node.children.map((child) => renderCategoryNode(child, level + 1))}
                </CollapsibleContent>
            </Collapsible>
        );
    };

    return (
        <div className="grid gap-6 lg:grid-cols-3">
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">{t('categoryManager.addTitle')}</CardTitle>
                    <CardDescription className="text-xs">{t('categoryManager.addDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle />
                            <AlertTitle>{t('categoryManager.errorTitle')}</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                            <Button variant="ghost" size="icon-sm" className="absolute right-2 top-2" onClick={clearError}>×</Button>
                        </Alert>
                    )}

                    <form onSubmit={(event) => void handleCreateCategory(event)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-category-name">{t('categoryManager.nameLabel')}</Label>
                            <Input
                                id="new-category-name"
                                value={newCategoryName}
                                onChange={(event) => setNewCategoryName(event.target.value)}
                                placeholder={t('categoryManager.namePlaceholder')}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>{t('categoryManager.parentLabel')}</Label>
                            <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ROOT_CATEGORY}>{t('categoryManager.rootLevel')}</SelectItem>
                                    {parentOptions.map((category) => (
                                        <SelectItem key={category.id} value={String(category.id)}>{category.path}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-category-description">{t('categoryManager.descriptionLabel')}</Label>
                            <Textarea
                                id="new-category-description"
                                value={newCategoryDescription}
                                onChange={(event) => setNewCategoryDescription(event.target.value)}
                                placeholder={t('categoryManager.descriptionPlaceholder')}
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={isLoading || !newCategoryName.trim()}>
                            <Plus />
                            {isLoading ? t('categoryManager.saving') : t('categoryManager.addBtn')}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card className="lg:col-span-2">
                <CardHeader className="flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle className="text-sm">{t('categoryManager.treeTitle')}</CardTitle>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void refreshCategories()} disabled={isLoading}>
                        <RefreshCw className={isLoading ? 'animate-spin' : ''} />
                        {t('categoryManager.refresh')}
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                        {categoryTree.length > 0
                            ? categoryTree.map((node) => renderCategoryNode(node))
                            : <p className="py-8 text-center text-sm text-slate-400">{isLoading ? t('categoryManager.loading') : t('categoryManager.emptyTree')}</p>}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={Boolean(editingLocation && editForm)} onOpenChange={(open) => !open && closeEditDialog()}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{t('categoryManager.editTitle')}</DialogTitle>
                    </DialogHeader>
                    {editForm && (
                        <form id="edit-category-form" onSubmit={(event) => void handleUpdateCategory(event)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-category-name">{t('categoryManager.nameLabel')}</Label>
                                <Input
                                    id="edit-category-name"
                                    value={editForm.name}
                                    onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>{t('categoryManager.statusLabel')}</Label>
                                <Select value={editForm.status} onValueChange={(status) => setEditForm({ ...editForm, status: status as CategoryFormState['status'] })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORY_STATUSES.map((status) => (
                                            <SelectItem key={status} value={status}>{t(`categoryManager.statuses.${status}`)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>{t('categoryManager.parentLabel')}</Label>
                                <Select value={editForm.parentId} onValueChange={(parentId) => setEditForm({ ...editForm, parentId })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ROOT_CATEGORY}>{t('categoryManager.rootLevel')}</SelectItem>
                                        {editParentOptions.map((category) => (
                                            <SelectItem key={category.id} value={String(category.id)}>{category.path}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-category-description">{t('categoryManager.descriptionLabel')}</Label>
                                <Textarea
                                    id="edit-category-description"
                                    value={editForm.description}
                                    onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                                />
                            </div>
                        </form>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={closeEditDialog}>{t('categoryManager.cancel')}</Button>
                        <Button type="submit" form="edit-category-form" disabled={isLoading || !editForm?.name.trim()}>
                            {isLoading ? t('categoryManager.saving') : t('categoryManager.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}