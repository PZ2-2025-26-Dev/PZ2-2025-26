import { useCallback, useEffect, useMemo, useState } from 'react';
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

    const handleQrScan = (decodedText: string) => {
        setSearchQuery(decodedText);
        setIsQrScannerOpen(false);
    };

    const handleItemUpdated = (updatedItem: InventoryItem) => {
        setItems((current) => current.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
        setSelectedItem(updatedItem);
    };

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
                                            <Button variant="outline" size="sm" onClick={() => clearError()}>✕</Button>
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
                        </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2">
                        <SystemClock lang={i18n.language} />
                        <Button variant="ghost" size="sm" onClick={() => i18n.changeLanguage(i18n.language === 'PL' ? 'EN' : 'PL')}>
                            {i18n.language === 'PL' ? 'EN' : 'PL'}
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setIsDarkMode(!isDarkMode)} aria-label={isDarkMode ? 'Tryb jasny' : 'Tryb ciemny'}>
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

            <AddAssetModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={() => refreshItems()}
                user={user}
            />
            <ItemDetailsModal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} item={selectedItem} user={user} onUpdateStatus={handleUpdateItemStatus} />
            <QrScannerDialog
                isOpen={isQrScannerOpen}
                onClose={() => setIsQrScannerOpen(false)}
                onScan={handleQrScan}
            />
        </div>
    );
}
