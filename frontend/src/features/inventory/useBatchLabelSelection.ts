import { useCallback, useEffect, useMemo, useState } from 'react';

import type { InventoryItem } from '@/types';
import { BATCH_LABEL_LIMIT } from './batchLabels.config';
import type { UseBatchLabelSelectionOptions } from './batchLabels.types';

export function useBatchLabelSelection({
    items,
    filters,
    userId,
    canManageSystem,
    limitErrorMessage,
}: UseBatchLabelSelectionOptions) {
    const [selectedItems, setSelectedItems] = useState<Map<string, InventoryItem>>(() => new Map());
    const [selectionError, setSelectionError] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const selectedItemsList = useMemo(
        () => [...selectedItems.values()],
        [selectedItems],
    );
    const selectionScope = useMemo(() => JSON.stringify({
        ...filters,
        page: undefined,
    }), [filters]);
    const canSelectItem = useCallback((item: InventoryItem) => (
        canManageSystem || item.ownerId === Number(userId)
    ), [canManageSystem, userId]);
    const selectablePageItems = useMemo(
        () => items.filter(canSelectItem),
        [canSelectItem, items],
    );
    const allSelectablePageItemsAreSelected = (
        selectablePageItems.length > 0
        && selectablePageItems.every((item) => selectedItems.has(item.id))
    );

    const clearSelection = useCallback(() => {
        setSelectedItems(new Map());
        setSelectionError(null);
    }, []);

    useEffect(() => {
        clearSelection();
    }, [clearSelection, selectionScope]);

    const toggleItem = useCallback((item: InventoryItem) => {
        if (!canSelectItem(item)) return;

        const next = new Map(selectedItems);
        if (next.has(item.id)) {
            next.delete(item.id);
            setSelectionError(null);
            setSelectedItems(next);
            return;
        }

        if (next.size >= BATCH_LABEL_LIMIT) {
            setSelectionError(limitErrorMessage);
            return;
        }

        next.set(item.id, item);
        setSelectionError(null);
        setSelectedItems(next);
    }, [canSelectItem, limitErrorMessage, selectedItems]);

    const togglePage = useCallback(() => {
        const next = new Map(selectedItems);

        if (allSelectablePageItemsAreSelected) {
            selectablePageItems.forEach((item) => next.delete(item.id));
            setSelectionError(null);
            setSelectedItems(next);
            return;
        }

        for (const item of selectablePageItems) {
            if (next.has(item.id)) continue;
            if (next.size >= BATCH_LABEL_LIMIT) {
                setSelectionError(limitErrorMessage);
                setSelectedItems(next);
                return;
            }
            next.set(item.id, item);
        }

        setSelectionError(null);
        setSelectedItems(next);
    }, [
        allSelectablePageItemsAreSelected,
        limitErrorMessage,
        selectablePageItems,
        selectedItems,
    ]);

    const updateSelectedItem = useCallback((item: InventoryItem) => {
        setSelectedItems((current) => {
            if (!current.has(item.id)) return current;
            const next = new Map(current);
            next.set(item.id, item);
            return next;
        });
    }, []);

    return {
        selectedItems,
        selectedItemsList,
        selectedCount: selectedItems.size,
        selectionError,
        isDialogOpen,
        setIsDialogOpen,
        canSelectItem,
        selectablePageItems,
        allSelectablePageItemsAreSelected,
        toggleItem,
        togglePage,
        clearSelection,
        updateSelectedItem,
    };
}
