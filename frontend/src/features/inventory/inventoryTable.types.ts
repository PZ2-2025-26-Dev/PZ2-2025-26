import type { MouseEvent, ReactNode } from 'react';

import type { InventoryItem } from '@/types';

export type SortField = 'id' | 'name' | 'category' | 'location' | 'status' | 'owner';

export type SortCriteria = {
    field: SortField;
    order: 'asc' | 'desc';
};

export type InventoryColumn = {
    label: ReactNode;
    field: SortField;
};

export type InventoryTableProps = {
    items: InventoryItem[];
    isLoading: boolean;
    sortCriteria: SortCriteria[];
    selectedItems: ReadonlyMap<string, InventoryItem>;
    selectableItemCount: number;
    allSelectablePageItemsAreSelected: boolean;
    canSelectItem: (item: InventoryItem) => boolean;
    onSort: (field: SortField, event: MouseEvent) => void;
    onOpenItem: (item: InventoryItem) => void;
    onToggleItem: (item: InventoryItem) => void;
    onTogglePage: () => void;
};
