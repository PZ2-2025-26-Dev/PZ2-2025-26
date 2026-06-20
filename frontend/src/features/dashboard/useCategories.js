import { useCallback, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';
import { parseApiError } from '../../api/apiUtils';

const normalizeCategory = (category) => ({
    id: category.id,
    name: category.name,
    parentId: category.parentId ?? category.parent_id ?? null,
    path: category.path,
});

const cleanParams = (params) => Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'all')
);

export const useCategories = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const listCategories = useCallback(async (filters = {}) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get(ENDPOINTS.CATEGORIES.BASE, {
                params: cleanParams({
                    page: filters.page ?? 1,
                    limit: filters.limit ?? 100,
                }),
            });
            const payload = response.data;
            const categories = (payload.categories ?? []).map(normalizeCategory);

            return {
                success: true,
                categories,
                total: payload.pagination?.total ?? categories.length,
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, categories: [], total: 0, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        listCategories,
        isLoading,
        error,
        clearError,
    };
};
