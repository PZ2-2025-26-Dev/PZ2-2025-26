import { useCallback, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';
import { parseApiError } from '../../api/apiUtils';

/**
 * @typedef {Object} Guest
 * @property {number} id
 * @property {string} first_name
 * @property {string|null} last_name
 * @property {string|null} email
 * @property {string} status
 */

const normalizeGuest = (guest) => ({
    id: guest.id,
    firstName: guest.first_name ?? '',
    lastName: guest.last_name ?? '',
    email: guest.email ?? '',
    status: guest.status,
});

const toApiPayload = (guest) => ({
    first_name: guest.firstName,
    last_name: guest.lastName || null,
    email: guest.email || null,
});

/**
 * Hook do zarządzania Gośćmi (encje User z rolą GUEST).
 * - Tworzenie: dostępne dla roli `user` oraz `admin`.
 * - Edycja / usuwanie: tylko `admin` (egzekwowane przez backend).
 */
export const useGuests = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const listGuests = useCallback(async (search) => {
        setIsLoading(true);
        setError(null);

        try {
            const params = search ? { search } : {};
            const response = await axiosClient.get(ENDPOINTS.GUESTS.BASE, { params });
            const payload = response.data;

            return {
                success: true,
                guests: (payload.guests ?? []).map(normalizeGuest),
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

    const createGuest = useCallback(async (guestData) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.post(ENDPOINTS.GUESTS.BASE, toApiPayload(guestData));
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
            const response = await axiosClient.put(ENDPOINTS.GUESTS.DETAILS(guestId), toApiPayload(guestData));
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
            await axiosClient.delete(ENDPOINTS.GUESTS.DETAILS(guestId));
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

    return { listGuests, createGuest, updateGuest, deleteGuest, isLoading, error, clearError };
};
