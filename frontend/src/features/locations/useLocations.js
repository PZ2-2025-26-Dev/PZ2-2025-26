import { useCallback, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';
import { parseApiError } from '../../api/apiUtils';

const normalizeLocation = (location) => ({
    id: location.id,
    name: location.name,
    path: location.path,
    type: location.type,
    parentId: location.parentId ?? location.parent_id ?? null,
    isActive: location.isActive ?? location.is_active ?? true,
});

const cleanParams = (params) => Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'all')
);

export const useLocations = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const listLocations = useCallback(async (filters = {}) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get(ENDPOINTS.LOCATIONS.BASE, {
                params: cleanParams({
                    parent_id: filters.parentId,
                    page: filters.page ?? 1,
                    limit: filters.limit ?? 100,
                }),
            });
            const payload = response.data;
            const locations = (payload.locations ?? []).map(normalizeLocation);

            return {
                success: true,
                locations: locations.filter((location) => location.isActive),
                total: payload.pagination?.total ?? locations.length,
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, locations: [], total: 0, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        listLocations,
        isLoading,
        error,
        clearError,
    };
};
