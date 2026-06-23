import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Pencil, Plus, RefreshCw, Tag, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCategories, type Category } from './useCategories';

type CategoryNode = Category & { children: CategoryNode[] };

const ROOT_CATEGORY = 'root';

type CategoryFormState = {
    name: string;
    parentId: string;
};

const compareCategories = (first: Category, second: Category) =>
    first.path.localeCompare(second.path, 'pl', { sensitivity: 'base' });

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

    const sortNodes = (nodes: CategoryNode[]) => {
        nodes.sort(compareCategories);
        nodes.forEach((node) => sortNodes(node.children));
    };
    sortNodes(roots);

    return roots;
};

const flattenCategories = (categories: Category[]) => [...categories].sort(compareCategories);

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
    const { listCategories, createCategory, updateCategory, deleteCategory, isLoading, error, clearError } = useCategories();

    const [categories, setCategories] = useState<Category[]>([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [selectedParentId, setSelectedParentId] = useState(ROOT_CATEGORY);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [editForm, setEditForm] = useState<CategoryFormState | null>(null);
    const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
    const [replacementCategoryId, setReplacementCategoryId] = useState('');
    const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<number>>(() => new Set());
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
    const parentOptions = useMemo(() => getParentOptions(categories), [categories]);
    const editParentOptions = useMemo(() => {
        if (!editingCategory || !editForm) return [];

        const blockedIds = collectDescendantIds(editingCategory.id, categories);
        blockedIds.add(editingCategory.id);

        return getParentOptions(categories).filter((category) => !blockedIds.has(category.id));
    }, [editForm, editingCategory, categories]);
    const deleteReplacementOptions = useMemo(() => {
        if (!deletingCategory) return [];

        const blockedIds = collectDescendantIds(deletingCategory.id, categories);
        blockedIds.add(deletingCategory.id);

        return getParentOptions(categories).filter((category) => !blockedIds.has(category.id));
    }, [deletingCategory, categories]);
    const hasDeleteReplacementOptions = deleteReplacementOptions.length > 0;

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

    useEffect(() => {
        if (deletingCategory) {
            setReplacementCategoryId(deleteReplacementOptions[0] ? String(deleteReplacementOptions[0].id) : '');
        }
    }, [deleteReplacementOptions, deletingCategory]);

    const handleCreateCategory = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedName = newCategoryName.trim();

        if (!trimmedName) return;

        const result = await createCategory({
            name: trimmedName,
            parentId: selectedParentId === ROOT_CATEGORY ? null : Number(selectedParentId),
        });

        if (result.success) {
            setNewCategoryName('');
            setSelectedParentId(ROOT_CATEGORY);
            await refreshCategories();
        }
    };

    const openEditDialog = (category: Category) => {
        setEditingCategory(category);
        setEditForm({
            name: category.name,
            parentId: category.parentId ? String(category.parentId) : ROOT_CATEGORY,
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
        });

        if (result.success) {
            closeEditDialog();
            await refreshCategories();
        }
    };

    const openDeleteDialog = (category: Category) => {
        setDeletingCategory(category);
        clearError();
    };

    const handleDeleteCategory = async () => {
        if (!deletingCategory || !replacementCategoryId) return;

        const result = await deleteCategory(deletingCategory.id, Number(replacementCategoryId));

        if (result.success) {
            setDeletingCategory(null);
            setReplacementCategoryId('');
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
                            <Tag className={level === 0 ? 'size-4 text-emerald-500' : 'size-4 text-slate-400'} />
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
                        <Button variant="ghost" size="icon-sm" className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100" onClick={() => { setSelectedParentId(String(node.id)); setNewCategoryName(''); setIsAddDialogOpen(true); }} aria-label={t('categoryManager.addTitle')}>
                            <Plus />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100" onClick={() => openEditDialog(node)} aria-label={t('categoryManager.edit')}>
                            <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="text-rose-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 dark:text-rose-300" onClick={() => openDeleteDialog(node)} aria-label={t('categoryManager.delete')}>
                            <Trash2 />
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
        <div className="">
            <Card>
                <CardHeader className="flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle className="text-sm">Kategorie</CardTitle>
                        <CardDescription className="text-xs">Hierarchia kategorii sprzętu</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon-sm" onClick={() => void refreshCategories()} disabled={isLoading} aria-label={t('categoryManager.refresh')}>
                            <RefreshCw className={isLoading ? 'animate-spin' : ''} />
                        </Button>
                        <Button size="sm" onClick={() => { setIsAddDialogOpen(true); setSelectedParentId(ROOT_CATEGORY); setNewCategoryName(''); }}>
                            <Plus className="mr-2" /> Dodaj kategorię
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle />
                            <AlertTitle>{t('categoryManager.errorTitle')}</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                            <Button variant="ghost" size="icon-sm" className="absolute right-2 top-2" onClick={clearError}>×</Button>
                        </Alert>
                    )}

                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                        {categoryTree.length > 0
                            ? categoryTree.map((node) => renderCategoryNode(node))
                            : <p className="py-8 text-center text-sm text-slate-400">{isLoading ? t('categoryManager.loading') : t('categoryManager.emptyTree')}</p>}
                    </div>
                </CardContent>
            </Card>

            {/* Add Category dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={(open: boolean) => !open && setIsAddDialogOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('categoryManager.addTitle')}</DialogTitle>
                    </DialogHeader>
                    <form id="add-category-form" onSubmit={(event) => { void handleCreateCategory(event); setIsAddDialogOpen(false); }} className="space-y-4">
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
                                <Select value={selectedParentId} onValueChange={(v: string) => setSelectedParentId(v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ROOT_CATEGORY}>{t('categoryManager.rootLevel')}</SelectItem>
                                    {parentOptions.map((category) => (
                                        <SelectItem key={category.id} value={String(category.id)}>{category.path}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </form>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>{t('categoryManager.cancel')}</Button>
                        <Button type="submit" form="add-category-form" disabled={isLoading || !newCategoryName.trim()}>
                            {isLoading ? t('categoryManager.saving') : t('categoryManager.addBtn')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(editingCategory && editForm)} onOpenChange={(open: boolean) => !open && closeEditDialog()}>
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
                                <Label>{t('categoryManager.parentLabel')}</Label>
                                <Select value={editForm.parentId} onValueChange={(parentId: string) => setEditForm({ ...editForm, parentId })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ROOT_CATEGORY}>{t('categoryManager.rootLevel')}</SelectItem>
                                        {editParentOptions.map((category) => (
                                            <SelectItem key={category.id} value={String(category.id)}>{category.path}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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

            <Dialog open={Boolean(deletingCategory)} onOpenChange={(open: boolean) => !open && setDeletingCategory(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('categoryManager.deleteTitle')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            {t('categoryManager.deleteDesc', { name: deletingCategory?.name })}
                        </p>
                        {hasDeleteReplacementOptions ? (
                            <div className="space-y-2">
                                <Label>{t('categoryManager.replacementLabel')}</Label>
                                <Select value={replacementCategoryId} onValueChange={setReplacementCategoryId}>
                                    <SelectTrigger><SelectValue placeholder={t('categoryManager.replacementPlaceholder')} /></SelectTrigger>
                                    <SelectContent>
                                        {deleteReplacementOptions.map((category) => (
                                            <SelectItem key={category.id} value={String(category.id)}>{category.path}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <Alert variant="destructive">
                                <AlertCircle />
                                <AlertTitle>{t('categoryManager.noReplacementTitle')}</AlertTitle>
                                <AlertDescription>{t('categoryManager.noReplacementDesc')}</AlertDescription>
                            </Alert>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingCategory(null)}>{t('categoryManager.cancel')}</Button>
                        <Button variant="destructive" onClick={() => void handleDeleteCategory()} disabled={isLoading || !replacementCategoryId}>
                            {isLoading ? t('categoryManager.deleting') : t('categoryManager.confirmDelete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
