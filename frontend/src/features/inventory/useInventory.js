import { useState, useCallback } from 'react';
import axiosClient from '../../api/axiosClient';        // 1. Klient HTTP (wstrzykuje tokeny)
import { ENDPOINTS } from '../../api/endpoints';        // 2. Słownik ścieżek
import { parseApiError } from '../../api/apiUtils';     // 3. Parser błędów

export const ITEM_STATUSES = ['available', 'pending_approval', 'reserved', 'loaned', 'broken'];
export const ITEM_HISTORY_PAGE_LIMIT = 10;

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
 * @property {string|null} oldID
 * @property {Object|null} parameters
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
    categoryPath: item.category?.path ?? '',
    categoryId: item.category?.id,
    location: item.location?.path ?? '',
    locationId: item.location?.id,
    owner: item.owner?.name ?? '',
    ownerId: item.owner?.id ?? 0,
    description: item.description ?? null,
    oldID: item.oldID ?? null,
    parameters: item.parameters ?? null,
    status: item.status,
});

const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(new Blob([blob]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

/**
 * Hook do zarządzania operacjami na przedmiotach inwentarza
 * @returns {{createItem: Function, updateItem: Function, getItem: Function, getItemHistory: Function, listItems: Function, lookupItemByQrCode: Function, listAttachments: Function, uploadAttachments: Function, downloadAttachment: Function, deleteAttachment: Function, downloadItemQr: Function, downloadItemLabel: Function, isLoading: boolean, error: string|null, clearError: Function}}
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
     * @param {Object<string, string|number|boolean>} [itemData.parameters] - Parametry (opcjonalne)
     * @returns {Promise<{success: boolean, data?: Object, error?: string, statusCode?: number}>}
     */
    const createItem = useCallback(async (itemData) => {
        setIsLoading(true);
        setError(null);

        try {
            const payload = {
                name: itemData.name,
                category_id: itemData.categoryId,
                location_id: itemData.locationId,
                owner_id: itemData.ownerId,
                description: itemData.description || null,
            };

            if (itemData.parameters && Object.keys(itemData.parameters).length > 0) {
                payload.parameters = itemData.parameters;
            }

            const response = await axiosClient.post(ENDPOINTS.ITEMS.BASE, payload);

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

    const getItem = useCallback(async (itemId) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get(ENDPOINTS.ITEMS.DETAILS(itemId));
            return {
                success: true,
                item: normalizeItem(response.data),
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateItem = useCallback(async (itemId, updates) => {
        setIsLoading(true);
        setError(null);

        const payload = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.locationId !== undefined) payload.location_id = updates.locationId;
        if (updates.categoryId !== undefined) payload.category_id = updates.categoryId;
        if (updates.ownerId !== undefined) payload.owner_id = updates.ownerId;
        if (updates.parameters !== undefined) payload.parameters = updates.parameters;

        try {
            const response = await axiosClient.patch(ENDPOINTS.ITEMS.DETAILS(itemId), payload);
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

    const lookupItemByQrCode = useCallback(async (code) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get(ENDPOINTS.ITEMS.SCAN(code));
            return {
                success: true,
                item: normalizeItem(response.data),
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return {
                success: false,
                error: errorMessage,
            };
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Pobiera historię zmian przedmiotu
     * @param {number|string} itemId - ID przedmiotu
     * @param {number} [page=1] - Numer strony
     * @param {number} [limit=ITEM_HISTORY_PAGE_LIMIT] - Liczba wpisów na stronie
     * @returns {Promise<{success: boolean, data?: Array, pagination?: Object, error?: string, statusCode?: number}>}
     */

    const getItemHistory = useCallback(async (itemId, page = 1, limit = ITEM_HISTORY_PAGE_LIMIT) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get(ENDPOINTS.ITEMS.HISTORY(itemId), {
                params: { page, limit },
            });
            const entries = response.data.entries ?? [];

            return {
                success: true,
                data: entries,
                pagination: response.data.pagination ?? {
                    page,
                    limit,
                    total: entries.length,
                },
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

    const listAttachments = useCallback(async (itemId) => {
        try {
            const response = await axiosClient.get(ENDPOINTS.ITEMS.ATTACHMENTS(itemId));
            return { success: true, data: response.data.attachments };
        } catch (err) {
            const errorMessage = parseApiError(err);
            return { success: false, error: errorMessage };
        }
    }, []);

    const uploadAttachments = useCallback(async (itemId, files) => {
        try {
            const formData = new FormData();
            Array.from(files).forEach((file) => formData.append('files', file));

            const baseURL = axiosClient.defaults.baseURL || 'http://localhost:8000';
            const token = localStorage.getItem('token');
            const headers = {};
            if (token) headers.Authorization = `Bearer ${token}`;

            const response = await fetch(`${baseURL}${ENDPOINTS.ITEMS.ATTACHMENTS(itemId)}`, {
                method: 'POST',
                body: formData,
                headers,
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                return {
                    success: false,
                    error: typeof data.detail === 'string' ? data.detail : parseApiError({ response: { data } }),
                };
            }

            return { success: true, data: data.attachments };
        } catch (err) {
            return { success: false, error: err.message || parseApiError(err) };
        }
    }, []);

    const downloadAttachment = useCallback(async (itemId, attachmentId, filename) => {
        try {
            const response = await axiosClient.get(
                ENDPOINTS.ITEMS.ATTACHMENT_DOWNLOAD(itemId, attachmentId),
                { responseType: 'blob' },
            );
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            return { success: true };
        } catch (err) {
            return { success: false, error: parseApiError(err) };
        }
    }, []);

    const deleteAttachment = useCallback(async (itemId, attachmentId) => {
        try {
            await axiosClient.delete(ENDPOINTS.ITEMS.ATTACHMENT_DELETE(itemId, attachmentId));
            return { success: true };
        } catch (err) {
            return { success: false, error: parseApiError(err) };
        }
    }, []);

    const downloadItemQr = useCallback(async (itemId, format) => {
        try {
            const response = await axiosClient.get(ENDPOINTS.ITEMS.QR(itemId, format), {
                responseType: 'blob',
            });
            downloadBlob(response.data, `item-${itemId}-qr.${format}`);
            return { success: true };
        } catch (err) {
            return { success: false, error: parseApiError(err) };
        }
    }, []);

    const downloadItemLabel = useCallback(async (itemId, format, options = {}) => {
        try {
            const response = await axiosClient.post(ENDPOINTS.ITEMS.LABEL(itemId, format), options, {
                responseType: 'blob',
            });
            downloadBlob(response.data, `item-${itemId}-label.${format}`);
            return { success: true };
        } catch (err) {
            return { success: false, error: parseApiError(err) };
        }
    }, []);

    return {
        createItem,
        updateItem,
        getItem,
        listItems,
        isLoading,
        error,
        clearError,
        getItemHistory,
        lookupItemByQrCode,
        listAttachments,
        uploadAttachments,
        downloadAttachment,
        deleteAttachment,
        downloadItemQr,
        downloadItemLabel,
    };
};
