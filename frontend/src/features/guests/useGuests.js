import { useCallback, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';
import { parseApiError } from '../../api/apiUtils';

const normalizeGuest = (guest) => ({
    id: guest.id,
    firstName: guest.first_name ?? '',
    lastName: guest.last_name ?? '',
    email: guest.email ?? '',
    status: guest.status,
});

const normalizeSelectUser = (user) => ({
    id: user.id,
    firstName: user.first_name ?? '',
    lastName: user.last_name ?? '',
    email: '',
    status: null,
});

const toCreatePayload = (guest) => ({
    first_name: guest.firstName,
    last_name: guest.lastName || null,
    email: guest.email || null,
});

const toUpdatePayload = (guest) => {
    const payload = {};
    if (guest.firstName !== undefined) payload.first_name = guest.firstName;
    if (guest.lastName !== undefined) payload.last_name = guest.lastName || null;
    if (guest.email !== undefined) payload.email = guest.email || null;
    return payload;
};

export const useGuests = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const listGuests = useCallback(async (options = {}) => {
        setIsLoading(true);
        setError(null);

        try {
            const params = {};
            if (options.search) params.search = options.search;
            if (options.page) params.page = options.page;
            if (options.limit) params.limit = options.limit;
            if (options.role) params.role = options.role;

            const response = await axiosClient.get(ENDPOINTS.USERS.SELECT, { params });
            const payload = response.data;

            return {
                success: true,
                guests: (payload.users ?? []).map(normalizeSelectUser),
                totalCount: payload.total_count ?? 0,
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, guests: [], totalCount: 0, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getGuest = useCallback(async (guestId) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get(ENDPOINTS.USERS.DETAILS(guestId));
            return { success: true, guest: normalizeGuest(response.data) };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage, statusCode: err.response?.status };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createGuest = useCallback(async (guestData) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.post(ENDPOINTS.USERS.BASE, toCreatePayload(guestData));
            return { success: true, guest: normalizeGuest(response.data) };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage, statusCode: err.response?.status };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateGuest = useCallback(async (guestId, guestData) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.put(
                ENDPOINTS.USERS.DETAILS(guestId),
                toUpdatePayload(guestData)
            );
            return { success: true, guest: normalizeGuest(response.data) };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage, statusCode: err.response?.status };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const deleteGuest = useCallback(async (guestId) => {
        setIsLoading(true);
        setError(null);

        try {
            await axiosClient.delete(ENDPOINTS.USERS.DETAILS(guestId));
            return { success: true };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage, statusCode: err.response?.status };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return { listGuests, getGuest, createGuest, updateGuest, deleteGuest, isLoading, error, clearError };
};
