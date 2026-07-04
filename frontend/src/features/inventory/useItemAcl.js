import { useCallback, useState } from 'react';

import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';
import { parseApiError } from '../../api/apiUtils';

export const ITEM_ACL_PERMISSIONS = [
    'auto_approved_loan',
    'edit_location',
    'edit_description',
    'edit_parameters',
    'edit_attachments',
];

const normalizeEntry = (entry) => ({
    id: entry.id,
    userId: entry.user_id ?? entry.userId,
    permission: entry.permission,
    user: {
        id: entry.user?.id,
        name: entry.user?.name ?? '',
    },
});

export const useItemAcl = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const listAcl = useCallback(async (itemId) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get(ENDPOINTS.ITEMS.ACL(itemId));
            const entries = (response.data.entries ?? []).map(normalizeEntry);
            return { success: true, entries };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, entries: [], error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const grantAcl = useCallback(async (itemId, userId, permission) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.post(ENDPOINTS.ITEMS.ACL(itemId), {
                user_id: userId,
                permission,
            });
            return { success: true, entry: normalizeEntry(response.data) };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const revokeAcl = useCallback(async (itemId, aclId) => {
        setIsLoading(true);
        setError(null);

        try {
            await axiosClient.delete(ENDPOINTS.ITEMS.ACL_ENTRY(itemId, aclId));
            return { success: true };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return {
        listAcl,
        grantAcl,
        revokeAcl,
        isLoading,
        error,
        clearError,
    };
};
