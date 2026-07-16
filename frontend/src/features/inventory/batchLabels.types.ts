import type { InventoryItem } from '@/types';
import type { InventoryFiltersState } from './InventoryFilters';

export type BatchLabelFormat = 'pdf' | 'zip';

export type BatchLabelOptions = {
    fields: string[];
    width_mm: number;
    height_mm: number;
};

export type BatchLabelExportResult = {
    success: boolean;
    error?: string;
};

export type BatchLabelFieldOption = {
    key: string;
    label: string;
};

export type BatchLabelExportDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: InventoryItem[];
    onExport: (
        itemIds: string[],
        format: BatchLabelFormat,
        options: BatchLabelOptions,
    ) => Promise<BatchLabelExportResult>;
    onCompleted: () => void;
};

export type UseBatchLabelSelectionOptions = {
    items: InventoryItem[];
    filters: InventoryFiltersState;
    userId: string | number | null;
    canManageSystem: boolean;
    limitErrorMessage: string;
};
