import { useState, useCallback } from 'react';
import axiosClient from '../../api/axiosClient';        // 1. Klient HTTP (wstrzykuje tokeny)
import { ENDPOINTS } from '../../api/endpoints';        // 2. Słownik ścieżek
import { parseApiError } from '../../api/apiUtils';     // 3. Parser błędów

export const ITEM_STATUSES = ['available', 'pending_approval', 'reserved', 'loaned', 'broken'];

const cleanParams = (params) => Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'all')
);

/**
 * @typedef {Object} InventoryItem
 * @property {number} id
 * @property {string} name
 * @property {string} category
 * @property {number} categoryId
 * @property {string} location
 * @property {number} locationId
 * @property {string} owner
 * @property {number} ownerId
 * @property {string|null} description
 * @property {string} status
 */

/**
 * @param {Object} item
 * @returns {InventoryItem}
 */
export const normalizeItem = (item) => ({
    id: item.id,
    name: item.name,
    category: item.category?.name ?? '',
    categoryId: item.category?.id,
    location: item.location?.path ?? '',
    locationId: item.location?.id,
    owner: item.owner?.name ?? '',
    ownerId: item.owner?.id,
    description: item.description ?? null,
    status: item.status,
});

/**
 * Hook do zarządzania operacjami na przedmiotach inwentarza
 * @returns {{createItem: Function, getItemHistory: Function, listItems: Function, isLoading: boolean, error: string|null, clearError: Function}}
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
     * @param {string} [filters.name]
     * @param {string} [filters.status]
     * @param {number} [filters.categoryId]
     * @param {number} [filters.locationId]
     * @param {number} [filters.ownerId]
     * @param {number} [filters.page]
     * @param {number} [filters.limit]
     * @returns {Promise<{success: boolean, items?: InventoryItem[], total?: number, page?: number, limit?: number, error?: string}>}
     */
    const listItems = useCallback(async (filters = {}) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get(ENDPOINTS.ITEMS.BASE, {
                params: cleanParams({
                    name: filters.name,
                    status: filters.status,
                    category_id: filters.categoryId,
                    location_id: filters.locationId,
                    owner_id: filters.ownerId,
                    page: filters.page ?? 1,
                    limit: filters.limit ?? 50,
                }),
            });

            const payload = response.data;
            const items = (payload.items ?? []).map(normalizeItem);
            const pagination = payload.pagination ?? {};

            return {
                success: true,
                items,
                total: pagination.total ?? items.length,
                page: pagination.page ?? 1,
                limit: pagination.limit ?? items.length,
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);

            return {
                success: false,
                items: [],
                total: 0,
                error: errorMessage,
            };
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
            // TODO: replace with GET /items/{itemId}/history
            console.log(`Zmockowane pobieranie historii dla przedmiotu ID: ${itemId}`);

            return {
                success: true,
                data: [
                    {
                        id: 1,
                        updated_at: '2026-06-14T10:15:00',
                        updated_by: 'Jan Kowalski',
                        change_type: 'CREATED',
                        description: 'Utworzenie przedmiotu',
                    },
                    {
                        id: 2,
                        updated_at: '2026-06-15T12:30:00',
                        updated_by: 'Anna Nowak',
                        change_type: 'LOCATION_CHANGED',
                        description: 'Zmiana lokalizacji',
                    },
                    {
                        id: 3,
                        updated_at: '2026-06-20T09:05:00',
                        updated_by: 'Piotr Wiśniewski',
                        change_type: 'OWNER_CHANGED',
                        description: 'Zmiana właściciela',
                    },
                ],
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
