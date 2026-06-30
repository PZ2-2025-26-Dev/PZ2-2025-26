import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    Box,
    Download,
    MapPinned,
    LogOut,
    Moon,
    PackageCheck,
    Plus,
    Search,
    Sun,
    Users,
    LayoutDashboard,
    ClipboardList,
    Menu,
    X,
    ChevronDown,
    ChevronRight,
    UserPlus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatCard } from '@/components/StatCard';
import QrScannerDialog from '@/components/QrScannerDialog';
import { StatusBadge } from '@/components/StatusBadge';
import SystemClock from '@/components/SystemClock';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AppUser, InventoryItem } from '@/types';
import RoleGuard from '../auth/RoleGuard';
import { PERMISSIONS, hasPermission } from '../auth/permissions';
import { useCategories } from './useCategories';
import { ITEM_STATUSES, useInventory } from '../inventory/useInventory';
import UserManager from '../users/UserManager';
import UserDirectory from '../guests/UserDirectory';
import LocationManager from '../locations/LocationManager';
import AddAssetModal from './AddAssetModal';
import CategoryManager from './CategoryManager';
import ItemDetailsModal from './ItemDetailsModal';
import RentalCenter from '../rental/RentalCenter';

type CategoryOption = {
    id: number;
    name: string;
    parentId: number | null;
    path: string;
};

type MenuSection = 'dashboard' | 'inventory' | 'loans' | 'locations' | 'directory' | 'users';

const DASHBOARD_ACTIVE_SECTION_KEY = 'dashboard.activeSection';

function isMenuSection(value: string | null): value is MenuSection {
    return value === 'dashboard' || value === 'inventory' || value === 'loans' || value === 'locations' || value === 'directory' || value === 'users';
}

type DashboardPageProps = {
    user: AppUser;
    onLogout: () => void;
    isDarkMode: boolean;
    setIsDarkMode: (enabled: boolean) => void;
};

export default function DashboardPage({ user, onLogout, isDarkMode, setIsDarkMode }: DashboardPageProps) {
    const { t, i18n } = useTranslation();
    const { listItems, isLoading, getItem, lookupItemByQrCode, error, clearError } = useInventory();
    const { listCategories } = useCategories();

    const [items, setItems] = useState<InventoryItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
    const [activeSection, setActiveSection] = useState<MenuSection>(() => {
        const storedSection = localStorage.getItem(DASHBOARD_ACTIVE_SECTION_KEY);
        return isMenuSection(storedSection) ? storedSection : 'dashboard';
    });
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [pendingUserCount, setPendingUserCount] = useState(0);
    const [isSidebarOpen, setIsSidebarOpen] = useState(
        () => !(typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches),
    );
    const sidebarRef = useRef<HTMLElement>(null);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    // Keep the off-canvas sidebar out of the keyboard tab order on small screens.
    useEffect(() => {
        const aside = sidebarRef.current;
        if (!aside) return undefined;

        const mediaQuery = window.matchMedia('(max-width: 1023px)');
        const syncInertState = () => {
            const isOffCanvas = mediaQuery.matches && !isSidebarOpen;
            if (isOffCanvas) {
                aside.setAttribute('inert', '');
                aside.setAttribute('aria-hidden', 'true');
            } else {
                aside.removeAttribute('inert');
                aside.removeAttribute('aria-hidden');
            }
        };

        syncInertState();
        mediaQuery.addEventListener('change', syncInertState);

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && mediaQuery.matches && isSidebarOpen) {
                setIsSidebarOpen(false);
            }
        };
        document.addEventListener('keydown', handleEscape);

        return () => {
            mediaQuery.removeEventListener('change', syncInertState);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isSidebarOpen]);

    const canViewList = hasPermission(user, PERMISSIONS.ITEM_LIST);
    const canManageSystem = hasPermission(user, PERMISSIONS.SYSTEM_MANAGE);

    useEffect(() => {
        localStorage.setItem(DASHBOARD_ACTIVE_SECTION_KEY, activeSection);
    }, [activeSection]);

    useEffect(() => {
        if (activeSection === 'users' && !canManageSystem) {
            setActiveSection('dashboard');
        }
    }, [activeSection, canManageSystem]);

    const refreshItems = useCallback(async () => {
        const result = await listItems({ limit: 50 });
        if (result.success) {
            setItems(result.items);
            setTotalCount(result.total);
        }
    }, [listItems]);

    const refreshCategories = useCallback(async () => {
        const result = await listCategories();
        if (result.success) {
            setCategories(result.categories.map((category) => ({
                id: category.id,
                name: category.name,
                parentId: category.parentId,
                path: category.path,
            })));
        }
    }, [listCategories]);

    useEffect(() => {
        if (!canViewList) return;
        refreshItems();
        refreshCategories();
    }, [canViewList, refreshItems, refreshCategories]);

    const categoryTree = useMemo(() => {
        const emptyResult = {
            rows: [] as Array<{ id: number; name: string; depth: number; count: number }>,
            totalCount: 0,
            descendantCategoryNamesById: new Map<number, Set<string>>(),
            childrenByParent: new Map<number | null, CategoryOption[]>(),
        };

        if (!canViewList) return emptyResult;

        const query = searchQuery.toLowerCase();
        const baseFilteredItems = items.filter((item) => {
            const matchesSearch = !query || [
                item.name,
                String(item.id),
                item.inventory_number,
                item.description,
                item.category,
                item.location,
                item.owner,
            ].some((value) => value?.toLowerCase().includes(query));

            const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
            return matchesSearch && matchesStatus;
        });

        const categoryById = new Map(categories.map((category) => [category.id, category]));
        const childrenByParent = new Map<number | null, CategoryOption[]>();

        categories.forEach((category) => {
            const parentKey = category.parentId !== null && categoryById.has(category.parentId)
                ? category.parentId
                : null;
            const siblings = childrenByParent.get(parentKey) ?? [];
            siblings.push(category);
            childrenByParent.set(parentKey, siblings);
        });

        childrenByParent.forEach((siblings) => {
            siblings.sort((left, right) => left.name.localeCompare(right.name));
        });

        const categoryIdsByName = new Map<string, number[]>();
        categories.forEach((category) => {
            const ids = categoryIdsByName.get(category.name) ?? [];
            ids.push(category.id);
            categoryIdsByName.set(category.name, ids);
        });

        const directCountById = new Map<number, number>();
        baseFilteredItems.forEach((item) => {
            const matchingIds = categoryIdsByName.get(item.category) ?? [];
            matchingIds.forEach((categoryId) => {
                directCountById.set(categoryId, (directCountById.get(categoryId) ?? 0) + 1);
            });
        });

        const subtreeCountById = new Map<number, number>();
        const descendantCategoryNamesById = new Map<number, Set<string>>();

        const computeSubtree = (category: CategoryOption): number => {
            const children = childrenByParent.get(category.id) ?? [];
            const descendantNames = new Set<string>([category.name]);
            let total = directCountById.get(category.id) ?? 0;

            children.forEach((child) => {
                total += computeSubtree(child);
                const childNames = descendantCategoryNamesById.get(child.id) ?? new Set<string>();
                childNames.forEach((name) => descendantNames.add(name));
            });

            subtreeCountById.set(category.id, total);
            descendantCategoryNamesById.set(category.id, descendantNames);
            return total;
        };

        const roots = categories
            .filter((category) => category.parentId === null || !categoryById.has(category.parentId))
            .sort((left, right) => left.name.localeCompare(right.name));

        roots.forEach((root) => {
            computeSubtree(root);
        });

        const rows: Array<{ id: number; name: string; depth: number; count: number }> = [];

        const appendRows = (category: CategoryOption, depth: number) => {
            const count = subtreeCountById.get(category.id) ?? 0;
            if (count <= 0) return;

            rows.push({ id: category.id, name: category.name, depth, count });
            (childrenByParent.get(category.id) ?? []).forEach((child) => appendRows(child, depth + 1));
        };

        roots.forEach((root) => appendRows(root, 0));

        return {
            rows,
            totalCount: baseFilteredItems.length,
            descendantCategoryNamesById,
            childrenByParent,
        };
    }, [canViewList, categories, items, searchQuery, statusFilter]);

    const selectedTreeCategoryId = useMemo(() => {
        if (!categoryFilter.startsWith('tree:')) return null;
        const parsedId = Number(categoryFilter.slice(5));
        return Number.isFinite(parsedId) ? parsedId : null;
    }, [categoryFilter]);

    const filteredItems = useMemo(() => {
        if (!canViewList) return [];

        return items.filter((item) => {
            const query = searchQuery.toLowerCase();
            const matchesSearch = !query || [
                item.name,
                String(item.id),
                item.inventory_number,
                item.description,
                item.category,
                item.location,
                item.owner,
            ].some((value) => value?.toLowerCase().includes(query));

            const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

            let matchesCategory = true;
            if (categoryFilter !== 'all') {
                if (selectedTreeCategoryId === null) {
                    matchesCategory = item.category === categoryFilter;
                } else {
                    const allowedCategoryNames = categoryTree.descendantCategoryNamesById.get(selectedTreeCategoryId);
                    matchesCategory = allowedCategoryNames?.has(item.category) ?? false;
                }
            }

            return matchesSearch && matchesStatus && matchesCategory;
        });
    }, [canViewList, items, searchQuery, statusFilter, categoryFilter, selectedTreeCategoryId, categoryTree.descendantCategoryNamesById]);

    const stats = useMemo(() => ({
        total: totalCount,
        borrowed: items.filter((item) => item.status === 'loaned').length,
        pending: items.filter((item) => item.status === 'pending_approval').length,
        damaged: items.filter((item) => item.status === 'broken').length,
    }), [items, totalCount]);

    const handleUpdateItemStatus = () => {
        refreshItems();
    };

    const handleQrScan = async (decodedText: string) => {
        setIsQrScannerOpen(false);
        const result = await lookupItemByQrCode(decodedText);
        if (result.success && result.item) {
            setSelectedItem(result.item);
            setIsDetailsModalOpen(true);
            return;
        }

        setSearchQuery(decodedText);
    };

    const openItemDetails = async (item: InventoryItem) => {
        const result = await getItem(item.id);
        setSelectedItem(result.success && result.item ? result.item : item);
        setIsDetailsModalOpen(true);
    };

    const handleItemUpdated = (updatedItem: InventoryItem) => {
        setItems((current) => current.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
        setSelectedItem(updatedItem);
    };

    const handleItemLocationChanged = (itemId: string | number, location: { id: number; path: string }) => {
        setItems((current) => current.map((item) => item.id === itemId ? {
            ...item,
            location: location.path,
            locationId: location.id,
        } : item));
        setSelectedItem((current) => current?.id === itemId ? {
            ...current,
            location: location.path,
            locationId: location.id,
        } : current);
        void refreshItems();
    };

    const getStatusLabel = (status: string) => t(`dashboard.itemStatuses.${status}`);

    const openItemDetails = (item: InventoryItem) => {
        setSelectedItem(item);
        setIsDetailsModalOpen(true);
    };

    // Menu items with role-based visibility
    const menuItems: Array<{ id: MenuSection; label: string; icon: React.ReactNode; requiresPermission?: string }> = [
        { id: 'dashboard', label: t('dashboard.mainPanel'), icon: <LayoutDashboard className="size-5" /> },
        { id: 'inventory', label: t('dashboard.tabInventory'), icon: <Box className="size-5" /> },
        { id: 'loans', label: t('dashboard.loans'), icon: <ClipboardList className="size-5" /> },
        { id: 'locations', label: canManageSystem ? t('dashboard.locationsAndCategories') : t('dashboard.tabLocations'), icon: <MapPinned className="size-5" /> },
        { id: 'directory', label: t('dashboard.tabDirectory'), icon: <UserPlus className="size-5" />, requiresPermission: PERMISSIONS.ITEM_CREATE },
        { id: 'users', label: t('dashboard.tabUsers'), icon: <Users className="size-5" />, requiresPermission: PERMISSIONS.SYSTEM_MANAGE },
    ];

    const renderContent = () => {
        switch (activeSection) {
            case 'dashboard':
                return (
                    <div className="space-y-5">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.mainPanel')}</h2>
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                            <StatCard title={t('dashboard.totalAssets')} value={stats.total} icon={Box} />
                            <StatCard title={t('dashboard.borrowedAssets')} value={stats.borrowed} icon={PackageCheck} className="text-blue-600 dark:text-blue-400" />
                            <StatCard title={t('dashboard.pendingApprovals')} value={stats.pending} icon={Users} className="text-amber-600 dark:text-amber-400" />
                            <StatCard title={t('dashboard.damagedAssets')} value={stats.damaged} icon={AlertTriangle} className="text-rose-600 dark:text-rose-400" />
                        </div>
                    </div>
                );
            
            case 'inventory':
                return (
                    <div className="space-y-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.tabInventory')}</h2>
                            <RoleGuard user={user} requiredPermission={PERMISSIONS.ITEM_CREATE}>
                                <Button size="sm" onClick={() => setIsAddModalOpen(true)}><Plus className="size-4" />{t('dashboard.addAsset')}</Button>
                            </RoleGuard>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                            <Card className="h-fit">
                                <CardContent className="space-y-2 p-4">
                                    <div className="pb-1 text-sm font-semibold text-slate-900 dark:text-white">{t('dashboard.filterCategory')}</div>
                                    <button
                                        onClick={() => setCategoryFilter('all')}
                                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                            categoryFilter === 'all'
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                                        }`}
                                    >
                                        <span>{t('dashboard.all')}</span>
                                        <Badge variant="secondary" className="text-[10px]">{categoryTree.totalCount}</Badge>
                                    </button>

                                    {(() => {
                                        const getCategoryCount = (categoryId: number) => 
                                            categoryTree.rows.find((c) => c.id === categoryId)?.count ?? 0;
                                        
                                        const renderCategoryNode = (categoryId: number | null, depth = 0): React.ReactNode => {
                                            const children = categoryTree.childrenByParent?.get(categoryId) ?? [];
                                            
                                            return children.map((category) => {
                                                const isExpanded = expandedCategories.has(category.id);
                                                const hasChildren = (categoryTree.childrenByParent?.get(category.id) ?? []).length > 0;
                                                const count = getCategoryCount(category.id);
                                                
                                                return (
                                                    <Collapsible
                                                        key={category.id}
                                                        open={isExpanded}
                                                        onOpenChange={() => {
                                                            setExpandedCategories((current) => {
                                                                const next = new Set(current);
                                                                if (next.has(category.id)) {
                                                                    next.delete(category.id);
                                                                } else {
                                                                    next.add(category.id);
                                                                }
                                                                return next;
                                                            });
                                                        }}
                                                        style={{ marginLeft: depth * 12 }}
                                                    >
                                                        <div
                                                            className={`flex w-full items-center gap-1 rounded-lg pr-3 transition-colors ${
                                                                categoryFilter === `tree:${category.id}`
                                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                                                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                                                            }`}
                                                        >
                                                            {hasChildren ? (
                                                                <CollapsibleTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon-sm"
                                                                        className="ml-1 shrink-0"
                                                                        aria-label={t(isExpanded ? 'a11y.collapseCategory' : 'a11y.expandCategory', { name: category.name })}
                                                                    >
                                                                        {isExpanded ? (
                                                                            <ChevronDown className="size-4" />
                                                                        ) : (
                                                                            <ChevronRight className="size-4" />
                                                                        )}
                                                                    </Button>
                                                                </CollapsibleTrigger>
                                                            ) : (
                                                                <span className="block size-7 shrink-0" />
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => setCategoryFilter(`tree:${category.id}`)}
                                                                aria-pressed={categoryFilter === `tree:${category.id}`}
                                                                aria-label={t('a11y.filterByCategory', { name: category.name })}
                                                                className="flex flex-1 items-center justify-between gap-2 rounded-lg py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
                                                            >
                                                                <span className="truncate pr-2">{category.name}</span>
                                                                <Badge variant="outline" className="text-[10px]">{count}</Badge>
                                                            </button>
                                                        </div>

                                                        {hasChildren && (
                                                            <CollapsibleContent className="space-y-0">
                                                                {renderCategoryNode(category.id, depth + 1)}
                                                            </CollapsibleContent>
                                                        )}
                                                    </Collapsible>
                                                );
                                            });
                                        };
                                        
                                        return renderCategoryNode(null);
                                    })()}

                                    {categoryTree.rows.length === 0 && (
                                        <div className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-400 dark:border-slate-800">
                                            {t('dashboard.noResults')}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <div className="space-y-4">
                                {error && (
                                    <Alert variant="destructive">
                                        <AlertTriangle />
                                        <AlertTitle>{t('auth.loginErrorTitle')}</AlertTitle>
                                        <AlertDescription className="flex items-center justify-between gap-3">
                                            <span>{error}</span>
                                            <Button variant="outline" size="sm" onClick={clearError} aria-label={t('a11y.dismiss')}><span aria-hidden="true">✕</span></Button>
                                            <Button variant="outline" size="sm" onClick={() => clearError()}>✕</Button>
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <Card>
                                    <CardContent className="space-y-4 p-4">
                                        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                                            <div className="relative max-w-md flex-1">
                                                <Label htmlFor="inventory-search" className="sr-only">{t('dashboard.searchPlaceholder')}</Label>
                                                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                                <Input id="inventory-search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t('dashboard.searchPlaceholder')} className="pl-9" />
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="secondary" size="sm" onClick={() => setIsQrScannerOpen(true)} aria-label={t('qrScanner.button')}>
                                                    <Search />
                                                    {t('qrScanner.button')}
                                                </Button>
                                                <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_EXPORT}>
                                                    <Button variant="secondary" size="sm"><Download />{t('dashboard.exportXlsx')}</Button>
                                                </RoleGuard>
                                            </div>
                                        </div>
                                        <div className="grid gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="status-filter">{t('dashboard.filterStatus')}</Label>
                                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                                    <SelectTrigger id="status-filter"><SelectValue placeholder={t('dashboard.all')} /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">{t('dashboard.all')}</SelectItem>
                                                        {ITEM_STATUSES.map((status) => (
                                                            <SelectItem key={status} value={status}>{getStatusLabel(status)}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50/80 dark:bg-slate-900/50">
                                                <TableHead>{t('dashboard.thId')}</TableHead>
                                                <TableHead>{t('dashboard.thName')}</TableHead>
                                                <TableHead>{t('dashboard.thCategory')}</TableHead>
                                                <TableHead>{t('dashboard.thLocation')}</TableHead>
                                                <TableHead>{t('dashboard.thStatus')}</TableHead>
                                                <TableHead>{t('dashboard.thOwner')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoading && filteredItems.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="py-10 text-center text-slate-400">
                                                        {t('userManager.loading')}
                                                    </TableCell>
                                                </TableRow>
                                            ) : filteredItems.length > 0 ? filteredItems.map((item) => (
                                                <TableRow
                                                    key={item.id}
                                                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/70"
                                                    tabIndex={0}
                                                    role="button"
                                                    aria-label={t('dashboard.openItemDetails', { name: item.name })}
                                                    onClick={() => openItemDetails(item)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter' || event.key === ' ') {
                                                            event.preventDefault();
                                                            openItemDetails(item);
                                            ) : filteredItems.length > 0 ? filteredItems.map((item) => {
                                                const openDetails = () => { setSelectedItem(item); setIsDetailsModalOpen(true); };
                                                return (
                                                <TableRow
                                                    key={item.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-label={t('a11y.openItemDetails', { name: item.name })}
                                                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
                                                    onClick={openDetails}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter' || event.key === ' ') {
                                                            event.preventDefault();
                                                            openDetails();
                                                        }
                                                    }}
                                                >

                                                <TableRow key={item.id} className="cursor-pointer" onClick={() => void openItemDetails(item) }>

                                                    <TableCell className="font-mono text-xs text-slate-400">{item.inventory_number ?? item.id}</TableCell>
                                                    <TableCell>
                                                        <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                                                        {item.description && (
                                                            <div className="line-clamp-1 text-[10px] text-slate-400">{item.description}</div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-slate-600 dark:text-slate-400">{item.category}</TableCell>
                                                    <TableCell className="max-w-[220px] whitespace-normal text-slate-600 dark:text-slate-400">{item.location}</TableCell>
                                                    <TableCell>
                                                        <StatusBadge status={item.status} label={getStatusLabel(item.status)} />
                                                        {item.borrower && <div className="mt-1 text-[9px] text-slate-400">{item.borrower} ({item.dueDate})</div>}
                                                    </TableCell>
                                                    <TableCell className="text-slate-600 dark:text-slate-400">{item.owner}</TableCell>
                                                </TableRow>
                                                );
                                            }) : (
                                                <TableRow><TableCell colSpan={6} className="py-10 text-center text-slate-400">{t('dashboard.noResults')}</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </Card>
                            </div>
                        </div>
                    </div>
                );
            
            case 'loans':
                return <RentalCenter user={user} />;
            
            case 'locations':
                return canManageSystem ? (
                        <div className="grid gap-6 lg:grid-cols-2">
                            <div>
                                <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{t('dashboard.tabLocations')}</h3>
                                <LocationManager canManage />
                            </div>
                            <div>
                                <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{t('dashboard.tabCategories')}</h3>
                                <CategoryManager />
                            </div>
                        </div>
                ) : (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t('dashboard.tabLocations')}</h3>
                        <LocationManager
                            canManage={false}
                            canCreateRemote={user.role === 'user'}
                        />
                    </div>
                );
            
            case 'directory':
                return (
                    <RoleGuard user={user} requiredPermission={PERMISSIONS.ITEM_CREATE}>
                        <UserDirectory user={user} />
                    </RoleGuard>
                );

            case 'users':
                return (
                    <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                        <UserManager onPendingCountChange={setPendingUserCount} />
                    </RoleGuard>
                );
            
            default:
                return null;
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-slate-50 font-sans dark:bg-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
                <div className="mx-auto flex h-16 max-w-full items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="lg:hidden"
                            aria-label={t('a11y.toggleSidebar')}
                            aria-expanded={isSidebarOpen}
                        >
                            {isSidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                        </Button>
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-xs font-bold tracking-wider text-white dark:bg-emerald-600">AGH</div>
                        <div className="min-w-0">
                            <h1 className="truncate text-xs font-bold uppercase tracking-tight text-slate-900 dark:text-white">{t('dashboard.dashboard')}</h1>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                <span className="truncate">{t('dashboard.welcome')}, {user.name}</span>
                                <Badge variant="secondary" className="hidden text-[9px] sm:inline-flex">{t(`userManager.roles.${user.role}`)}</Badge>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2">
                        <SystemClock lang={i18n.language} />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => i18n.changeLanguage(i18n.language === 'PL' ? 'EN' : 'PL')}
                            aria-label={t('a11y.switchLanguage', { lang: i18n.language === 'PL' ? 'EN' : 'PL' })}
                        >
                            {i18n.language === 'PL' ? 'EN' : 'PL'}
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setIsDarkMode(!isDarkMode)} aria-label={isDarkMode ? t('a11y.lightMode') : t('a11y.darkMode')}>
                            {isDarkMode ? <Sun /> : <Moon />}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={onLogout}>
                            <LogOut />
                            <span className="hidden sm:inline">{t('dashboard.logout')}</span>
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {isSidebarOpen && (
                    <button
                        type="button"
                        className="fixed inset-0 top-16 z-20 bg-slate-950/40 lg:hidden"
                        aria-label={t('a11y.closeSidebar')}
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}
                {/* Sidebar */}
                <aside
                    ref={sidebarRef}
                    className={`fixed left-0 top-16 z-30 h-[calc(100vh-64px)] border-r border-slate-200 bg-white/95 backdrop-blur transition-all duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-950/95 lg:relative lg:top-0 lg:z-0 lg:translate-x-0 ${
                        isSidebarOpen ? 'w-64 translate-x-0' : 'w-16 -translate-x-full lg:translate-x-0'
                    }`}
                >
                    <nav className="flex flex-col gap-1 overflow-y-auto px-2 py-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="w-full"
                            aria-label={t('a11y.toggleSidebar')}
                            aria-expanded={isSidebarOpen}
                        >
                            <Menu className="size-5" />
                        </Button>
                        {menuItems.map((item) => {
                            const requiresPermission = item.requiresPermission ? hasPermission(user, item.requiresPermission) : true;
                            
                            if (!requiresPermission) return null;

                            const isActive = activeSection === item.id;
                            const pendingBadge = item.id === 'users' && pendingUserCount > 0;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setActiveSection(item.id);
                                        if (window.matchMedia('(max-width: 1023px)').matches) {
                                            setIsSidebarOpen(false);
                                        }
                                    }}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 ${
                                        isActive
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                                    } ${!isSidebarOpen && 'lg:justify-center'}`}
                                    title={!isSidebarOpen ? item.label : undefined}
                                >
                                    <span className="shrink-0">{item.icon}</span>
                                    {isSidebarOpen && (
                                        <>
                                            <span className="flex-1 text-left">{item.label}</span>
                                            {pendingBadge && (
                                                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                                                    {pendingUserCount}
                                                </Badge>
                                            )}
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Main content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                        {(activeSection === 'inventory' || activeSection === 'dashboard') && !canViewList ? (
                            <Alert variant="destructive" className="m-auto max-w-md">
                                <AlertTriangle />
                                <AlertTitle>{t('dashboard.accessDeniedTitle')}</AlertTitle>
                                <AlertDescription>{t('dashboard.accessDeniedDesc')}</AlertDescription>
                            </Alert>
                        ) : (
                            renderContent()
                        )}
                    </div>
                </main>
            </div>

            <AddAssetModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={() => refreshItems()}
                user={user}
            />
            <ItemDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                item={selectedItem}
                user={user}
                onUpdateStatus={handleUpdateItemStatus}
                onItemUpdated={handleItemUpdated}
                onLocationChanged={handleItemLocationChanged}
            />
            <QrScannerDialog
                isOpen={isQrScannerOpen}
                onClose={() => setIsQrScannerOpen(false)}
                onScan={handleQrScan}
            />
        </div>
    );
}
