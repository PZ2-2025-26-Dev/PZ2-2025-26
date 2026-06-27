import { useCallback, useEffect, useMemo, useState } from 'react';
<<<<<<< HEAD
=======
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
>>>>>>> origin/main
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/StatusBadge';
<<<<<<< HEAD
import QrScannerDialog from '@/components/QrScannerDialog';
=======
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
>>>>>>> origin/main
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
    const { listItems, isLoading, error, clearError } = useInventory();
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
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    const canViewList = hasPermission(user, PERMISSIONS.ITEM_LIST);

    useEffect(() => {
        localStorage.setItem(DASHBOARD_ACTIVE_SECTION_KEY, activeSection);
    }, [activeSection]);

    useEffect(() => {
        const restrictedSection = activeSection === 'users' || activeSection === 'locations';
        if (restrictedSection && !hasPermission(user, PERMISSIONS.SYSTEM_MANAGE)) {
            setActiveSection('dashboard');
        }
    }, [activeSection, user]);

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

    const getStatusLabel = (status: string) => t(`dashboard.itemStatuses.${status}`, { defaultValue: status });

    const handleQrScan = (decodedText: string) => {
        setIsQrScannerOpen(false);
        setSearchQuery(decodedText);
    };

    const handleUpdateItemStatus = (
        itemId: string | number,
        newStatus: string,
        clearBorrower = false,
        newBorrower: string | null = null,
        newDueDate: string | null = null,
    ) => {
        setItems((current) => current.map((item) => item.id === itemId ? {
            ...item,
            status: newStatus,
            borrower: newBorrower ?? (clearBorrower ? null : item.borrower),
            dueDate: newDueDate ?? (clearBorrower ? null : item.dueDate),
        } : item));
        setIsDetailsModalOpen(false);
    };

<<<<<<< HEAD
    return (
        <div className="flex min-h-screen flex-col bg-slate-50 font-sans transition-colors duration-300 dark:bg-slate-900">
            <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-0 lg:px-8">
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-[10px] font-bold tracking-wider text-white dark:bg-emerald-600 sm:text-xs">AGH</div>
                        <div className="min-w-0">
                            <h1 className="text-[11px] font-bold uppercase leading-tight tracking-tight text-slate-900 dark:text-white sm:text-xs">{t('dashboard.dashboard')}</h1>
                            <p className="mt-0.5 truncate text-[9px] text-slate-500 dark:text-slate-400 sm:text-[10px]">
                                {t('dashboard.welcome')}, <span className="font-semibold text-slate-700 dark:text-slate-200">{user.name}</span>
                                {' '}(<span className="font-mono rounded bg-slate-100 px-1 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">{user.role}</span>)
                            </p>
=======
    const getStatusLabel = (status: string) => t(`dashboard.itemStatuses.${status}`);

    // Menu items with role-based visibility
    const menuItems: Array<{ id: MenuSection; label: string; icon: React.ReactNode; requiresPermission?: string }> = [
        { id: 'dashboard', label: t('dashboard.mainPanel'), icon: <LayoutDashboard className="size-5" /> },
        { id: 'inventory', label: t('dashboard.tabInventory'), icon: <Box className="size-5" /> },
        { id: 'loans', label: t('dashboard.loans'), icon: <ClipboardList className="size-5" /> },
        { id: 'directory', label: t('dashboard.tabDirectory'), icon: <UserPlus className="size-5" />, requiresPermission: PERMISSIONS.ITEM_CREATE },
        { id: 'locations', label: t('dashboard.locationsAndCategories'), icon: <MapPinned className="size-5" />, requiresPermission: PERMISSIONS.SYSTEM_MANAGE },
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
                                                        <button
                                                            onClick={() => setCategoryFilter(`tree:${category.id}`)}
                                                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                                                categoryFilter === `tree:${category.id}`
                                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                                                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                                                            }`}
                                                        >
                                                            <div className="flex flex-1 items-center gap-2">
                                                                {hasChildren ? (
                                                                    <CollapsibleTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon-sm"
                                                                            className="-ml-2"
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
                                                                <span className="truncate pr-2">{category.name}</span>
                                                            </div>
                                                            <Badge variant="outline" className="text-[10px]">{count}</Badge>
                                                        </button>

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
                                            <Button variant="outline" size="sm" onClick={clearError}>✕</Button>
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <Card>
                                    <CardContent className="space-y-4 p-4">
                                        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                                            <div className="relative max-w-md flex-1">
                                                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                                                <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t('dashboard.searchPlaceholder')} className="pl-9" />
                                            </div>
                                            <div className="flex gap-2">
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
                                                <TableRow key={item.id} className="cursor-pointer" onClick={() => { setSelectedItem(item); setIsDetailsModalOpen(true); }}>
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
                                            )) : (
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
                return (
                    <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                        <div className="grid gap-6 lg:grid-cols-2">
                            <div>
                                <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{t('dashboard.tabLocations')}</h3>
                                <LocationManager />
                            </div>
                            <div>
                                <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{t('dashboard.tabCategories')}</h3>
                                <CategoryManager />
                            </div>
                        </div>
                    </RoleGuard>
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
>>>>>>> origin/main
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 sm:gap-2 sm:border-l sm:border-slate-200 sm:pl-3 dark:sm:border-slate-800">
                        <button
                            onClick={() => i18n.changeLanguage(i18n.language === 'PL' ? 'EN' : 'PL')}
                            className="rounded px-1.5 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 sm:px-2 sm:text-xs"
                        >
                            {i18n.language === 'PL' ? 'EN' : 'PL'}
                        </button>
                        <button
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                            aria-label={isDarkMode ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'}
                        >
                            {isDarkMode ? (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.243 17.657l.707.707M7.757 6.364l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
                            ) : (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                            )}
                        </button>
                        <button
                            onClick={onLogout}
                            className="flex items-center justify-center rounded-lg bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/60 sm:px-2.5 sm:py-1.5 sm:text-xs sm:font-medium"
                            aria-label={t('dashboard.logout')}
                        >
                            <svg className="h-3.5 w-3.5 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span className="hidden sm:inline">{t('dashboard.logout')}</span>
                        </button>
                    </div>
                </div>

                {canViewList && (
                    <div className="mx-auto max-w-7xl overflow-x-auto border-t border-slate-100 px-3 dark:border-slate-800/50 sm:px-6 lg:px-8">
                        <div className="flex min-w-max gap-4 sm:gap-6">
                            <button
                                onClick={() => setActiveTab('inventory')}
                                className={`whitespace-nowrap border-b-2 py-3 text-xs font-semibold transition-colors ${activeTab === 'inventory' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                {t('dashboard.tabInventory')}
                            </button>
                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                                <button
                                    onClick={() => setActiveTab('users')}
                                    className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 py-3 text-xs font-semibold transition-colors ${activeTab === 'users' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    {t('dashboard.tabUsers')}
                                    {pendingUserCount > 0 && (
                                        <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{pendingUserCount}</span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('categories')}
                                    className={`whitespace-nowrap border-b-2 py-3 text-xs font-semibold transition-colors ${activeTab === 'categories' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    {t('dashboard.tabCategories')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('locations')}
                                    className={`whitespace-nowrap border-b-2 py-3 text-xs font-semibold transition-colors ${activeTab === 'locations' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    {t('dashboard.tabLocations')}
                                </button>
                            </RoleGuard>
                        </div>
                    </div>
                )}
            </nav>

<<<<<<< HEAD
            <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
                {!canViewList ? (
                    <div className="mx-auto my-auto max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-xl font-bold text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">✕</div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('dashboard.accessDeniedTitle')}</h3>
                        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('dashboard.accessDeniedDesc')}</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {activeTab === 'inventory' && (
                            <>
                                {error && (
                                    <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400">
                                        <span>{error}</span>
                                        <button type="button" onClick={() => clearError()} className="text-rose-500 hover:text-rose-700">✕</button>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                                    {([
                                        { title: t('dashboard.totalAssets'), count: stats.total, color: 'text-slate-900 dark:text-white' },
                                        { title: t('dashboard.borrowedAssets'), count: stats.borrowed, color: 'text-blue-600 dark:text-blue-400' },
                                        { title: t('dashboard.pendingApprovals'), count: stats.pending, color: 'text-amber-600 dark:text-amber-400' },
                                        { title: t('dashboard.damagedAssets'), count: stats.damaged, color: 'text-rose-600 dark:text-rose-400' },
                                    ] as const).map((stat) => (
                                        <div key={stat.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-950">
                                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{stat.title}</div>
                                            <div className={`mt-1 text-xl font-bold ${stat.color}`}>{stat.count}</div>
                                        </div>
                                    ))}
                                </div>

                                <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                                    <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
                                        <div className="relative w-full max-w-md">
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                            </span>
                                            <input
                                                type="text"
                                                placeholder={t('dashboard.searchPlaceholder')}
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-4 text-xs text-slate-800 transition focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                            />
                                        </div>
                                        <div className="flex w-full flex-wrap items-center justify-center gap-2 md:w-auto md:justify-end">
                                            <button
                                                type="button"
                                                onClick={() => setIsQrScannerOpen(true)}
                                                className="flex min-w-[7.5rem] flex-1 items-center justify-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:flex-none sm:py-1.5"
                                            >
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3M16 3h3a2 2 0 012 2v3M21 16v3a2 2 0 01-2 2h-3M8 21H5a2 2 0 01-2-2v-3M7 8h3v3H7V8zm7 0h3v3h-3V8zM7 14h3v3H7v-3zm7 0h1m2 0v3h-3v-1" />
                                                </svg>
                                                <span>{t('qrScanner.button')}</span>
                                            </button>
                                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_EXPORT}>
                                                <button className="flex min-w-[7.5rem] flex-1 items-center justify-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:flex-none sm:py-1.5">
                                                    <span>⬇</span><span>{t('dashboard.exportXlsx')}</span>
                                                </button>
                                            </RoleGuard>
                                            <RoleGuard user={user} requiredPermission={PERMISSIONS.ITEM_CREATE}>
                                                <button
                                                    onClick={() => setIsAddModalOpen(true)}
                                                    className="flex min-w-[7.5rem] flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:flex-none sm:py-1.5"
                                                >
                                                    <span>+</span><span>{t('dashboard.addAsset')}</span>
                                                </button>
                                            </RoleGuard>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-900 sm:flex-row sm:flex-wrap">
                                        <div className="flex w-full items-center gap-2 sm:w-auto">
                                            <span className="shrink-0 font-medium text-slate-400">{t('dashboard.filterStatus')}:</span>
                                            <select
                                                value={statusFilter}
                                                onChange={(e) => setStatusFilter(e.target.value)}
                                                className="min-w-0 flex-1 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:flex-none"
                                            >
                                                <option value="all">{t('dashboard.all')}</option>
                                                {ITEM_STATUSES.map((status) => (
                                                    <option key={status} value={status}>{getStatusLabel(status)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex w-full items-center gap-2 sm:w-auto">
                                            <span className="shrink-0 font-medium text-slate-400">{t('dashboard.filterCategory')}:</span>
                                            <select
                                                value={categoryFilter}
                                                onChange={(e) => setCategoryFilter(e.target.value)}
                                                className="min-w-0 flex-1 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:flex-none"
                                            >
                                                <option value="all">{t('dashboard.all')}</option>
                                                {categories.map((category) => (
                                                    <option key={category.id} value={category.name}>{category.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </section>

                                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-slate-200 bg-slate-50/80 font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-900/40">
                                                    <th className="px-4 py-2.5">{t('dashboard.thId')}</th>
                                                    <th className="px-4 py-2.5">{t('dashboard.thName')}</th>
                                                    <th className="px-4 py-2.5">{t('dashboard.thCategory')}</th>
                                                    <th className="px-4 py-2.5">{t('dashboard.thLocation')}</th>
                                                    <th className="px-4 py-2.5">{t('dashboard.thStatus')}</th>
                                                    <th className="px-4 py-2.5">{t('dashboard.thOwner')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-900/60">
                                                {isLoading && filteredItems.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="py-8 text-center font-medium text-slate-400 dark:text-slate-500">
                                                            {t('userManager.loading')}
                                                        </td>
                                                    </tr>
                                                ) : filteredItems.length > 0 ? filteredItems.map((item) => (
                                                    <tr
                                                        key={item.id}
                                                        onClick={() => { setSelectedItem(item); setIsDetailsModalOpen(true); }}
                                                        className="cursor-pointer transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                                                    >
                                                        <td className="px-4 py-3 font-mono text-slate-400 dark:text-slate-500">{item.inventory_number ?? item.id}</td>
                                                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                                            <div>{item.name}</div>
                                                            {item.description && (
                                                                <div className="line-clamp-1 text-[10px] font-normal text-slate-400">{item.description}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.category}</td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.location}</td>
                                                        <td className="px-4 py-3">
                                                            <StatusBadge status={item.status} label={getStatusLabel(item.status)} />
                                                            {item.borrower && <div className="mt-0.5 text-[9px] text-slate-400 dark:text-slate-500">{item.borrower} ({item.dueDate})</div>}
                                                        </td>
                                                        <td className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">{item.owner}</td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan={6} className="py-8 text-center font-medium text-slate-400 dark:text-slate-500">{t('dashboard.noResults')}</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTab === 'users' && (
                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                                <UserManager onPendingCountChange={setPendingUserCount} />
                            </RoleGuard>
                        )}

                        {activeTab === 'categories' && (
                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                                <CategoryManager />
                            </RoleGuard>
                        )}

                        {activeTab === 'locations' && (
                            <RoleGuard user={user} requiredPermission={PERMISSIONS.SYSTEM_MANAGE}>
                                <LocationManager />
                            </RoleGuard>
                        )}
                    </div>
                )}
            </main>
=======
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <aside
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
                            aria-label="Przełącz menu boczne"
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
                                    }}
                                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
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
>>>>>>> origin/main

            <AddAssetModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={() => refreshItems()}
                user={user}
            />
            <QrScannerDialog
                isOpen={isQrScannerOpen}
                onClose={() => setIsQrScannerOpen(false)}
                onScan={handleQrScan}
            />
            <ItemDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                item={selectedItem}
                user={user}
                onUpdateStatus={handleUpdateItemStatus}
            />
        </div>
    );
}
