import type { InventoryItem } from '@/types';

export function flattenParameterFields(
    parameters: Record<string, unknown> | null | undefined,
    prefix = '',
): string[] {
    if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) return [];

    return Object.entries(parameters).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return flattenParameterFields(value as Record<string, unknown>, path);
        }

        return [`parameters.${path}`];
    });
}

export function getCommonParameterFields(items: InventoryItem[]): string[] {
    if (items.length === 0) return [];

    const [firstItem, ...remainingItems] = items;
    const commonFields = new Set(flattenParameterFields(firstItem.parameters));

    for (const item of remainingItems) {
        const itemFields = new Set(flattenParameterFields(item.parameters));
        for (const field of commonFields) {
            if (!itemFields.has(field)) commonFields.delete(field);
        }
    }

    return [...commonFields].sort((first, second) => first.localeCompare(second));
}
