import { useCallback, useState } from 'react';

import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';
import { parseApiBlobError, parseApiError } from '../../api/apiUtils';

const cleanParams = (params) => Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'all'),
);

const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

/**
 * @typedef {Object} ExportFilters
 * @property {string} [uuid]
 * @property {string} [name]
 * @property {string} [description]
 * @property {string} [search]
 * @property {number} [categoryId]
 * @property {number} [locationId]
 * @property {number} [ownerId]
 * @property {number} [borrowerId]
 * @property {string} [status]
 * @property {string} [sort]
 * @property {number} [page]
 * @property {number} [limit]
 * @property {string} [custom_params]
 */

export const useExport = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const exportItemsXlsx = useCallback(async (filters = {}) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get(ENDPOINTS.EXPORT.ITEMS_XLSX, {
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
                    sort: filters.sort ?? 'name:asc',
                    page: filters.page ?? 1,
                    limit: filters.limit ?? 20,
                    custom_params: filters.custom_params,
                }),
                responseType: 'blob',
            });

            const contentType = response.headers['content-type'] ?? '';
            if (contentType.includes('application/json')) {
                const text = await response.data.text();
                const payload = JSON.parse(text);
                const message = typeof payload.detail === 'string'
                    ? payload.detail
                    : 'Export failed';
                setError(message);
                return { success: false, error: message };
            }

            const filename = `items-${new Date().toISOString().slice(0, 10)}.xlsx`;
            downloadBlob(
                new Blob(
                    [response.data],
                    { type: contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
                ),
                filename,
            );

            return { success: true };
        } catch (err) {
            const errorMessage = await parseApiBlobError(err, 'Export failed');
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const exportItemReportXlsx = useCallback(async (itemId) => {
        if (!itemId) return { success: false, error: 'Missing item ID' };

        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get(
                ENDPOINTS.EXPORT.ITEM_REPORT(itemId),
                {
                    responseType: 'blob',
                },
            );

            const contentType = response.headers['content-type'] ?? '';
            if (contentType.includes('application/json')) {
                const text = await response.data.text();
                const payload = JSON.parse(text);
                const message = typeof payload.detail === 'string'
                    ? payload.detail
                    : 'Export failed';
                setError(message);
                return { success: false, error: message };
            }

            const filename = `report-item-${itemId}-${new Date().toISOString().slice(0, 10)}.xlsx`;
            downloadBlob(
                new Blob(
                    [response.data],
                    { type: contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
                ),
                filename,
            );

            return { success: true };
        } catch (err) {
            const errorMessage = await parseApiBlobError(err, 'Export item report failed');
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * @param {'xlsx' | 'pdf'} format
     * @param {{ dateFrom?: string, dateTo?: string }} [filters]
     */
    const exportStatistics = useCallback(async (format, filters = {}) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get(ENDPOINTS.EXPORT.STATISTICS_FILE(format), {
                params: cleanParams({
                    date_from: filters.dateFrom,
                    date_to: filters.dateTo,
                }),
                responseType: 'blob',
            });

            const contentType = response.headers['content-type'] ?? '';
            if (contentType.includes('application/json')) {
                const text = await response.data.text();
                const payload = JSON.parse(text);
                const message = typeof payload.detail === 'string'
                    ? payload.detail
                    : 'Export failed';
                setError(message);
                return { success: false, error: message };
            }

            const fallbackType = format === 'pdf'
                ? 'application/pdf'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            const filename = `inventory-statistics-${new Date().toISOString().slice(0, 10)}.${format}`;
            downloadBlob(new Blob([response.data], { type: contentType || fallbackType }), filename);

            return { success: true };
        } catch (err) {
            const errorMessage = await parseApiBlobError(err, 'Export failed');
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
        exportItemsXlsx,
        exportItemReportXlsx,
        exportStatistics,
        isLoading,
        error,
        clearError,
    };
};
