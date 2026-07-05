import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/StatusBadge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type {
    InventoryColumn,
    InventoryTableProps,
    SortField,
} from './inventoryTable.types';
import { BATCH_LABEL_LIMIT } from './batchLabels.config';

export default function InventoryTable({
    items,
    isLoading,
    sortCriteria,
    selectedItems,
    selectableItemCount,
    allSelectablePageItemsAreSelected,
    canSelectItem,
    onSort,
    onOpenItem,
    onToggleItem,
    onTogglePage,
}: InventoryTableProps) {
    const { t } = useTranslation();
    const columns: InventoryColumn[] = [
        { label: 'ID', field: 'id' },
        { label: t('dashboard.thName'), field: 'name' },
        { label: t('dashboard.tabCategories'), field: 'category' },
        { label: t('dashboard.tabLocations'), field: 'location' },
        { label: t('dashboard.thStatus'), field: 'status' },
        { label: t('addAssetModal.owner'), field: 'owner' },
    ];

    const renderSortIcon = (field: SortField) => {
        const index = sortCriteria.findIndex((criteria) => criteria.field === field);
        if (index === -1) {
            return <ArrowUpDown className="ml-2 inline h-4 w-4 opacity-40" />;
        }

        const icon = sortCriteria[index].order === 'asc'
            ? <ArrowUp className="ml-2 inline h-4 w-4 text-primary" />
            : <ArrowDown className="ml-2 inline h-4 w-4 text-primary" />;

        return (
            <div className="inline-flex items-center">
                {icon}
                {sortCriteria.length > 1 && (
                    <span className="ml-0.5 rounded bg-slate-200 px-1 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {index + 1}
                    </span>
                )}
            </div>
        );
    };

    return (
        <Table className="min-w-full">
            <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/40">
                    <TableHead className="w-12 px-4 py-3">
                        <input
                            type="checkbox"
                            checked={allSelectablePageItemsAreSelected}
                            onChange={onTogglePage}
                            disabled={selectableItemCount === 0}
                            aria-label={t('batchLabels.selectPage')}
                            title={t('batchLabels.selectPage')}
                            className="size-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
                        />
                    </TableHead>
                    {columns.map((column) => (
                        <TableHead
                            key={column.field}
                            className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                            onClick={(event) => onSort(column.field, event)}
                        >
                            <div className="flex items-center gap-1">
                                {column.label}
                                {renderSortIcon(column.field)}
                            </div>
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading && items.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-slate-400">
                            {t('userManager.loading')}
                        </TableCell>
                    </TableRow>
                ) : items.length > 0 ? items.map((item) => (
                    <TableRow
                        key={item.id}
                        className="group cursor-pointer border-b border-slate-100 transition-colors duration-150 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-900/40"
                        onClick={() => onOpenItem(item)}
                    >
                        <TableCell
                            className="w-12 px-4 py-3"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <input
                                type="checkbox"
                                checked={selectedItems.has(item.id)}
                                onChange={() => onToggleItem(item)}
                                disabled={
                                    !canSelectItem(item)
                                    || (selectedItems.size >= BATCH_LABEL_LIMIT && !selectedItems.has(item.id))
                                }
                                aria-label={t('batchLabels.selectItem', { name: item.name })}
                                title={
                                    canSelectItem(item)
                                        ? t('batchLabels.selectItem', { name: item.name })
                                        : t('batchLabels.notAllowed')
                                }
                                className="size-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
                            />
                        </TableCell>
                        <TableCell className="w-[120px] max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                            {item.oldID ?? item.id}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                            <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                            {item.description && (
                                <div className="line-clamp-1 text-[10px] text-slate-400">{item.description}</div>
                            )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-slate-600 dark:text-slate-400">
                            {item.category}
                        </TableCell>
                        <TableCell className="max-w-[220px] whitespace-normal px-4 py-3 text-slate-600 dark:text-slate-400">
                            {item.location}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                            <StatusBadge
                                status={item.status}
                                label={t(`dashboard.itemStatuses.${item.status}`, { defaultValue: item.status })}
                            />
                            {item.borrower && (
                                <div className="mt-1 text-[9px] text-slate-400">
                                    {item.borrower} ({item.dueDate})
                                </div>
                            )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-slate-600 dark:text-slate-400">
                            {item.owner}
                        </TableCell>
                    </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-slate-400">
                            {t('dashboard.noResults')}
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}
