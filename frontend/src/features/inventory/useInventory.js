import { useState, useCallback } from 'react';
import axiosClient from '../../api/axiosClient';        // 1. Klient HTTP (wstrzykuje tokeny)
import { ENDPOINTS } from '../../api/endpoints';        // 2. Słownik ścieżek
import { parseApiError } from '../../api/apiUtils';     // 3. Parser błędów

/** @param {Object} item - odpowiedź GET /items */
export const mapItemFromApi = (item) => ({
    id: item.id,
    name: item.name,
    category: item.category?.name ?? '',
    location: item.location?.path ?? '',
    owner: item.owner ? { id: item.owner.id, name: item.owner.name } : '',
    ownerId: item.owner?.id,
    description: item.description ?? '',
    status: item.status,
    producer: '',
    model: '',
    serialNumber: '',
});

/**
 * Hook do zarządzania operacjami na przedmiotach inwentarza
 * @returns {{createItem: Function, isLoading: boolean, error: string|null, clearError: Function}}
 */
export const useInventory = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    /**
     * Tworzy nowy przedmiot poprzez POST /items
     * @param {Object} itemData
     * @param {string} itemData.name - Nazwa przedmiotu
     * @param {number} itemData.categoryId - ID kategorii
     * @param {number} itemData.locationId - ID lokalizacji
     * @param {number} itemData.ownerId - ID właściciela/opiekuna
     * @param {string} [itemData.description] - Opis (opcjonalny)
     * @returns {Promise<{success: boolean, data?: Object, error?: string, statusCode?: number}>}
     */
    const createItem = useCallback(async (itemData) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.post(ENDPOINTS.ITEMS.BASE, {
                name: itemData.name,
                category_id: itemData.categoryId,
                location_id: itemData.locationId,
                owner_id: itemData.ownerId,
                description: itemData.description || null,
            });

            // HTTP 201: { id, inventory_number, status }
            return {
                success: true,
                data: response.data,
                statusCode: response.status,
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);

            return {
                success: false,
                error: errorMessage,
                statusCode: err.response?.status,
            };
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Pobiera listę przedmiotów z GET /items
     * @param {Object} [filters]
     * @param {number} [filters.page]
     * @param {number} [filters.limit]
     * @param {string} [filters.status]
     * @returns {Promise<{success: boolean, items?: Array, total?: number, error?: string}>}
     */
    const listItems = useCallback(async (filters = {}) => {
        setIsLoading(true);
        setError(null);

        try {
            const params = {};
            if (filters.page) params.page = filters.page;
            if (filters.limit) params.limit = filters.limit;
            if (filters.status) params.status = filters.status;

            const response = await axiosClient.get(ENDPOINTS.ITEMS.BASE, { params });
            const payload = response.data;

            return {
                success: true,
                items: (payload.items ?? []).map(mapItemFromApi),
                total: payload.pagination?.total ?? 0,
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, items: [], total: 0, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    
    /**
     * Pobiera historię zmian przedmiotu
     * @param {number} itemId - ID przedmiotu
     * @returns {Promise<{success: boolean, data?: Array, error?: string, statusCode?: number}>}
     */

    const getItemHistory = useCallback(async (itemId) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get(ENDPOINTS.ITEMS.HISTORY(itemId));

            return {
                success: true,
                data: response.data,
            };
        } catch (err) {
            const errorMessage = parseApiError(err);

            setError(errorMessage);

            return {
                success: false,
                error: errorMessage,
                statusCode: err.response?.status,
            };
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        createItem,
        listItems,
        isLoading,
        error,
        clearError,
        getItemHistory,
    };
};