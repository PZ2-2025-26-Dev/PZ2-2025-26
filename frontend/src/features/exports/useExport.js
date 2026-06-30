import { useState, useCallback } from 'react';
import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';

const cleanParams = (params) =>
    Object.fromEntries(
        Object.entries(params).filter(
            ([, value]) =>
                value !== undefined &&
                value !== null &&
                value !== '' &&
                value !== 'all'
        )
    );

export const useExport = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const exportItemsXlsx = useCallback(async (filters = {}) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get(
                ENDPOINTS.EXPORT.ITEMS_XLSX,
                {
                    params: cleanParams({
                        uuid: filters.uuid,
                    name: filters.name,
                    description: filters.description,
                    search: filters.search,
                    status: filters.status,
                    category_id: filters.categoryId,
                    location_id: filters.locationId,
                    owner_id: filters.ownerId,
                    borrower_id: filters.borrowerId,
                    sort_by: filters.sort_by ?? "name",
                    sort_order: filters.sort_order ?? "asc",
                    page: filters.page ?? 1,
                    limit: filters.limit ?? 20,
                    custom_params: filters.custom_params
                    }),
                    responseType: 'blob', 
                }
            );

            const blob = new Blob([response.data], {
                type:
                    response.headers['content-type'] ||
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });

            const url = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;

            link.download = `items-${new Date()
                .toISOString()
                .slice(0, 10)}.xlsx`;

            document.body.appendChild(link);
            link.click();

            link.remove();
            window.URL.revokeObjectURL(url);

            return { success: true };
        } catch (err) {
            console.error('Export XLSX error:', err);
            setError('Export failed');

            return { success: false, error: 'Export failed' };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return {
        exportItemsXlsx,
        isLoading,
        error,
        clearError,
    };
};