import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Plus, Trash2, Loader2, FolderTree, Search, Eye, EyeOff } from 'lucide-react';

// Importy komponentów shadcn/ui
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';

// Konfiguracja API
const API_BASE_URL = ''; 

const ENDPOINTS = {
    CATEGORIES_BASE: `${API_BASE_URL}/categories`,
};

// Definicje typów dla TypeScript
type Category = {
    id: string | number;
    name: string;
    parent_id: number | null;
};

type TreeCategory = Category & { children: TreeCategory[] };

export default function CategoryManager() {
    const { t, i18n } = useTranslation();
    const { toast } = useToast();

    // Stan z surową płaską listą z bazy
    const [categories, setCategories] = useState<Category[]>([]);
    
    // Stany formularza i filtrów
    const [newCategoryName, setNewCategoryName] = useState('');
    const [selectedParentId, setSelectedParentId] = useState<string>('root');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Globalny stan kontrolek drzewa (wymuszenie otwarcia/zamknięcia)
    const [globalExpandTrigger, setGlobalExpandTrigger] = useState<boolean | null>(null);
    
    // Stany ładowania i błędów
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pobieranie danych z backendu
    const fetchCategories = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(ENDPOINTS.CATEGORIES_BASE);
            if (!response.ok) {
                throw new Error(t('categoryManager.errors.fetch', 'Błąd podczas pobierania kategorii z serwera'));
            }
            const data: Category[] = await response.json();
            setCategories(data);
        } catch (err: any) {
            setError(err.message);
            toast({
                variant: "destructive",
                title: t('categoryManager.toast.errorTitle', 'Błąd'),
                description: err.message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    // Aktualny skrót językowy (np. 'pl', 'en') do poprawnego sortowania alfabetycznego
    const currentLanguage = i18n.language || 'pl';

    // 1. Sortowanie i budowanie pełnego drzewa alfabetycznego
    const fullCategoryTree = useMemo<TreeCategory[]>(() => {
        const tree: TreeCategory[] = [];
        const lookup: Record<string | number, TreeCategory> = {};

        const sorted = [...categories].sort((a, b) => 
            a.name.localeCompare(b.name, currentLanguage, { sensitivity: 'base' })
        );

        sorted.forEach(cat => {
            lookup[cat.id] = { ...cat, children: [] };
        });

        sorted.forEach(cat => {
            const parentId = cat.parent_id; 
            if (parentId && lookup[parentId]) {
                lookup[parentId].children.push(lookup[cat.id]);
            } else {
                tree.push(lookup[cat.id]);
            }
        });

        return tree;
    }, [categories, currentLanguage]);

    // 2. Filtrowanie drzewa na podstawie frazy z wyszukiwarki (rekurencyjne)
    const filteredCategoryTree = useMemo<TreeCategory[]>(() => {
        if (!searchQuery.trim()) return fullCategoryTree;

        const query = searchQuery.toLowerCase().trim();

        const filterNodes = (nodes: TreeCategory[]): TreeCategory[] => {
            return nodes
                .map(node => ({ ...node, children: filterNodes(node.children) }))
                .filter(node => node.name.toLowerCase().includes(query) || node.children.length > 0);
        };

        return filterNodes(fullCategoryTree);
    }, [fullCategoryTree, searchQuery]);

    // Posortowana lista do formularza Select
    const sortedCategoriesForSelect = useMemo(() => {
        return [...categories].sort((a, b) => 
            a.name.localeCompare(b.name, currentLanguage, { sensitivity: 'base' })
        );
    }, [categories, currentLanguage]);

    // Dodawanie nowej kategorii do bazy
    const handleAddCategory = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!newCategoryName.trim()) return;

        setIsSubmitting(true);
        try {
            const response = await fetch(ENDPOINTS.CATEGORIES_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newCategoryName.trim(),
                    parent_id: selectedParentId !== 'root' ? parseInt(selectedParentId, 10) : null
                }),
            });

            if (!response.ok) {
                throw new Error(t('categoryManager.errors.save', 'Nie udało się zapisać nowej kategorii'));
            }

            setNewCategoryName('');
            setSelectedParentId('root');
            await fetchCategories();
            
            toast({
                title: t('categoryManager.toast.successTitle', 'Sukces'),
                description: t('categoryManager.toast.successAdd', 'Kategoria została poprawnie dodana.'),
            });
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: t('categoryManager.toast.errorTitle', 'Błąd'),
                description: err.message,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Usuwanie kategorii z bazy
    const handleDelete = async (id: number | string) => {
        if (!window.confirm(t('categoryManager.confirmDelete', 'Czy na pewno chcesz usunąć tę kategorię?'))) {
            return;
        }

        try {
            const response = await fetch(`${ENDPOINTS.CATEGORIES_BASE}/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(t('categoryManager.errors.delete', 'Serwer odrzucił żądanie usunięcia'));
            }

            await fetchCategories();
            toast({
                title: t('categoryManager.toast.successTitle', 'Sukces'),
                description: t('categoryManager.toast.successDelete', 'Kategoria została pomyślnie usunięta.'),
            });
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: t('categoryManager.toast.errorTitle', 'Błąd'),
                description: err.message,
            });
        }
    };

    // Obsługa przycisków globalnego rozwijania/zwijania
    const handleGlobalExpand = (expand: boolean) => {
        setGlobalExpandTrigger(expand);
        setTimeout(() => setGlobalExpandTrigger(null), 100);
    };

    // Rekurencyjny komponent pojedynczego węzła drzewa (shadcn Collapsible)
    const CategoryNode = ({ node, level = 0 }: { node: TreeCategory; level?: number }) => {
        const [isOpen, setIsOpen] = useState(true);
        const hasChildren = node.children && node.children.length > 0;

        useEffect(() => {
            if (globalExpandTrigger !== null) {
                setIsOpen(globalExpandTrigger);
            }
        }, [globalExpandTrigger]);

        useEffect(() => {
            if (searchQuery.trim()) {
                setIsOpen(true);
            }
        }, [searchQuery]);

        return (
            <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
                <div className={`flex items-center justify-between py-1.5 px-3 hover:bg-muted/50 rounded-lg group transition border border-transparent ${level > 0 ? 'ml-6 border-l border-border/60' : ''}`}>
                    <div className="flex items-center space-x-2">
                        <CollapsibleTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={!hasChildren}
                                className={`h-7 w-7 text-muted-foreground p-0 transition-transform duration-200 ${isOpen && hasChildren ? 'transform rotate-90' : ''} ${!hasChildren ? 'opacity-20 cursor-default hover:bg-transparent' : ''}`}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </CollapsibleTrigger>
                        
                        <span className={`text-sm ${level === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                            {node.name}
                        </span>
                    </div>
                    
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(node.id)}
                        className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition h-7 px-2"
                    >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        {t('categoryManager.delete')}
                    </Button>
                </div>

                {hasChildren && (
                    <CollapsibleContent>
                        <div className="mt-0.5 space-y-0.5">
                            {node.children.map(child => (
                                <CategoryNode key={child.id} node={child} level={level + 1} />
                            ))}
                        </div>
                    </CollapsibleContent>
                )}
            </Collapsible>
        );
    };

    if (isLoading && categories.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-2 text-sm text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span>{t('categoryManager.loading', 'Pobieranie danych bazy...')}</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12 text-sm text-destructive font-medium">
                {t('categoryManager.criticalError', 'Błąd połączenia z backendem')}: {error}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {/* Formularz Zarządzania */}
            <div className="lg:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">{t('categoryManager.addTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddCategory} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="new-category-name">
                                    {t('categoryManager.nameLabel')}
                                </Label>
                                <Input
                                    id="new-category-name"
                                    type="text"
                                    required
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder={t('categoryManager.namePlaceholder', 'np. Zasilacze laboratoryjne')}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label>
                                    {t('categoryManager.parentLabel')}
                                </Label>
                                <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder={t('categoryManager.rootLevel')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="root">{t('categoryManager.rootLevel')}</SelectItem>
                                        {sortedCategoriesForSelect.map(cat => (
                                            <SelectItem key={cat.id} value={cat.id.toString()}>
                                                {cat.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t('categoryManager.adding')}
                                    </>
                                ) : (
                                    <>
                                        <Plus className="mr-2 h-4 w-4" />
                                        {t('categoryManager.addBtn')}
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* Drzewo Kategorii */}
            <div className="lg:col-span-2">
                <Card className="flex flex-col h-full">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <FolderTree className="h-4 w-4 text-muted-foreground" />
                                    {t('categoryManager.treeTitle')}
                                </CardTitle>
                                <CardDescription>{t('categoryManager.desc')}</CardDescription>
                            </div>
                            
                            <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 text-xs px-2.5"
                                    onClick={() => handleGlobalExpand(true)}
                                >
                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                    {t('categoryManager.controls.expandAll', 'Rozwiń')}
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 text-xs px-2.5"
                                    onClick={() => handleGlobalExpand(false)}
                                >
                                    <EyeOff className="h-3.5 w-3.5 mr-1" />
                                    {t('categoryManager.controls.collapseAll', 'Zwiń')}
                                </Button>
                            </div>
                        </div>

                        <div className="relative mt-3">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder={t('categoryManager.searchPlaceholder', 'Filtruj drzewo kategorii...')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-9"
                            />
                        </div>
                    </CardHeader>
                    
                    <CardContent className="flex-1">
                        <div className="bg-muted/30 rounded-lg border p-4 min-h-[250px] h-full">
                            {filteredCategoryTree.length > 0 ? (
                                <div className="space-y-0.5">
                                    {filteredCategoryTree.map(rootNode => (
                                        <CategoryNode key={rootNode.id} node={rootNode} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-sm text-muted-foreground">
                                    {searchQuery 
                                        ? t('categoryManager.noMatches', 'Brak kategorii pasujących do filtra') 
                                        : t('categoryManager.emptyTree')}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}