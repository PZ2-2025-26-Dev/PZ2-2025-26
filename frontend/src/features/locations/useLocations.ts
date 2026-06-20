import { useCallback, useState } from 'react';

import axiosClient from '@/api/axiosClient';
import { parseApiError } from '@/api/apiUtils';
import { ENDPOINTS } from '@/api/endpoints';

export type LocationType = 'building' | 'room' | 'cabinet' | 'shelf' | 'other';

export type Location = {
    id: number;
    name: string;
    type: LocationType;
    parentId: number | null;
    description: string | null;
    isActive: boolean;
    path: string;
};

type LocationApiResponse = {
    id: number;
    name: string;
    type: LocationType;
    parent_id?: number | null;
    parentId?: number | null;
    description?: string | null;
    is_active?: boolean;
    isActive?: boolean;
    path: string;
};

type LocationsPagedResponse = {
    locations?: LocationApiResponse[];
    items?: LocationApiResponse[];
    pagination?: {
        page: number;
        limit: number;
        total: number;
    };
};

export type LocationCreateInput = {
    name: string;
    type: LocationType;
    parentId: number | null;
    description: string | null;
};

export type LocationUpdateInput = LocationCreateInput & {
    isActive: boolean;
};

const normalizeLocation = (location: LocationApiResponse): Location => ({
    id: location.id,
    name: location.name,
    type: location.type,
    parentId: location.parentId ?? location.parent_id ?? null,
    description: location.description ?? null,
    isActive: location.isActive ?? location.is_active ?? true,
    path: location.path,
});

const toCreatePayload = (location: LocationCreateInput) => ({
    name: location.name,
    type: location.type,
    parent_id: location.parentId,
    description: location.description,
});

const toUpdatePayload = (location: LocationUpdateInput) => ({
    name: location.name,
    type: location.type,
    parent_id: location.parentId,
    description: location.description,
    is_active: location.isActive,
});

export const useLocations = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const listLocations = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get<LocationsPagedResponse>(ENDPOINTS.LOCATIONS.BASE, {
                params: { page: 1, limit: 100 },
            });
            const locations = response.data.locations ?? response.data.items ?? [];

            return {
                success: true,
                locations: locations.map(normalizeLocation),
                totalCount: response.data.pagination?.total ?? locations.length,
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, locations: [], totalCount: 0, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createLocation = useCallback(async (location: LocationCreateInput) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.post<LocationApiResponse>(
                ENDPOINTS.LOCATIONS.BASE,
                toCreatePayload(location),
            );

            return {
                success: true,
                location: normalizeLocation(response.data),
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateLocation = useCallback(async (locationId: number, location: LocationUpdateInput) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.put<LocationApiResponse>(
                ENDPOINTS.LOCATIONS.DETAILS(locationId),
                toUpdatePayload(location),
            );

            return {
                success: true,
                location: normalizeLocation(response.data),
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const deleteLocation = useCallback(async (locationId: number) => {
        setIsLoading(true);
        setError(null);

        try {
            await axiosClient.delete(ENDPOINTS.LOCATIONS.DETAILS(locationId));

            return { success: true };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        listLocations,
        createLocation,
        updateLocation,
        deleteLocation,
        isLoading,
        error,
        clearError,
    };
};
