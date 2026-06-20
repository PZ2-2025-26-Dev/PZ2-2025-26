import { useMemo, useState, type FormEvent } from 'react';
import { ChevronRight, FolderTree, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Category = {
    id: string;
    name: string;
    parentId: string | null;
};

type CategoryNode = Category & { children: CategoryNode[] };

const INITIAL_CATEGORIES: Category[] = [
    { id: 'cat-1', name: 'Aparatura pomiarowa', parentId: null },
    { id: 'cat-2', name: 'Oscyloskopy', parentId: 'cat-1' },
    { id: 'cat-3', name: 'Generatory funkcyjne', parentId: 'cat-1' },
    { id: 'cat-4', name: 'Aparatura zasilająca', parentId: null },
    { id: 'cat-5', name: 'Zasilacze laboratoryjne', parentId: 'cat-4' },
    { id: 'cat-6', name: 'Sprzęt IT', parentId: null },
    { id: 'cat-7', name: 'Laptopy', parentId: 'cat-6' },
    { id: 'cat-8', name: 'Akcesoria i optyka', parentId: null },
];

export default function CategoryManager() {
    const { t } = useTranslation();
    const [categories, setCategories] = useState(INITIAL_CATEGORIES);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [selectedParentId, setSelectedParentId] = useState('root');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const categoryTree = useMemo(() => {
        const lookup: Record<string, CategoryNode> = {};
        const roots: CategoryNode[] = [];
        categories.forEach((category) => { lookup[category.id] = { ...category, children: [] }; });
        categories.forEach((category) => {
            if (category.parentId && lookup[category.parentId]) lookup[category.parentId].children.push(lookup[category.id]);
            else roots.push(lookup[category.id]);
        });
        return roots;
    }, [categories]);

    const handleAddCategory = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!newCategoryName.trim()) return;
        setIsSubmitting(true);
        window.setTimeout(() => {
            setCategories((current) => [...current, {
                id: `cat-${Date.now()}`,
                name: newCategoryName.trim(),
                parentId: selectedParentId === 'root' ? null : selectedParentId,
            }]);
            setNewCategoryName('');
            setSelectedParentId('root');
            setIsSubmitting(false);
        }, 400);
    };

    const deleteCategory = (id: string) => {
        setCategories((current) => current.filter((category) => category.id !== id && category.parentId !== id));
    };

    const renderNode = (node: CategoryNode, level = 0) => (
        <div key={node.id}>
            <div
                className="group flex items-center justify-between rounded-lg border border-transparent px-3 py-2 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-900"
                style={{ marginLeft: level * 20 }}
            >
                <div className="flex items-center gap-2">
                    {node.children.length > 0 ? <FolderTree className="size-4 text-emerald-500" /> : <ChevronRight className="size-4 text-slate-400" />}
                    <span className={level === 0 ? 'text-sm font-semibold' : 'text-sm text-slate-600 dark:text-slate-400'}>{node.name}</span>
                </div>
                <Button variant="destructive" size="icon-sm" className="opacity-0 group-hover:opacity-100" onClick={() => deleteCategory(node.id)}>
                    <Trash2 />
                </Button>
            </div>
            {node.children.map((child) => renderNode(child, level + 1))}
        </div>
    );

    return (
        <div className="grid gap-6 lg:grid-cols-3">
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">{t('categoryManager.addTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAddCategory} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-category-name">{t('categoryManager.nameLabel')}</Label>
                            <Input id="new-category-name" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('categoryManager.parentLabel')}</Label>
                            <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="root">{t('categoryManager.rootLevel')}</SelectItem>
                                    {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            <Plus />
                            {isSubmitting ? t('categoryManager.adding') : t('categoryManager.addBtn')}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle className="text-sm">{t('categoryManager.treeTitle')}</CardTitle>
                    <CardDescription className="text-xs">{t('categoryManager.desc')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                        {categoryTree.length > 0
                            ? categoryTree.map((node) => renderNode(node))
                            : <p className="py-8 text-center text-sm text-slate-400">{t('categoryManager.emptyTree')}</p>}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
