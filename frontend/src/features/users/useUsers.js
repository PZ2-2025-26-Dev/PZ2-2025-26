import { useCallback, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';
import { parseApiError } from '../../api/apiUtils';

const normalizeUser = (user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName ?? user.first_name ?? '',
    lastName: user.lastName ?? user.last_name ?? '',
    role: user.role,
    status: user.status,
});

const toApiPayload = (user) => ({
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    role: user.role,
    status: user.status,
});

const cleanParams = (params) => Object.fromEntries(
    Object.entries(params).filter(([, value]) => value && value !== 'all')
);

export const useUsers = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const listUsers = useCallback(async (filters, options = { browse: false }) => {
        setIsLoading(true);
        setError(null);

        try {
            const url = options.browse ? ENDPOINTS.USERS.BROWSE : ENDPOINTS.USERS.BASE;
            const response = await axiosClient.get(url, {
                params: cleanParams(filters),
            });
            const payload = response.data;
            const users = payload.users ?? payload.items ?? [];

            return {
                success: true,
                users: users.map(normalizeUser),
                totalCount: payload.totalCount ?? payload.total_count ?? users.length,
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, users: [], totalCount: 0, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateUser = useCallback(async (userId, userData) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.put(ENDPOINTS.USERS.DETAILS(userId), toApiPayload(userData));

            return {
                success: true,
                user: normalizeUser(response.data),
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const deleteUser = useCallback(async (userId) => {
        setIsLoading(true);
        setError(null);

        try {
            await axiosClient.delete(ENDPOINTS.USERS.DETAILS(userId));
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
        listUsers,
        updateUser,
        deleteUser,
        isLoading,
        error,
        clearError,
    };
};