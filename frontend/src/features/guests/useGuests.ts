import { useCallback, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';
import { parseApiError } from '../../api/apiUtils';

export type Guest = {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: 'guest';
};

export type BasicUser = {
    firstName: string;
    lastName: string;
    email?: string;
    role: string;
};

export type DirectoryEntry = Guest | BasicUser;

const isGuest = (entry: DirectoryEntry): entry is Guest => entry.role === 'guest';

const normalizeGuest = (guest: Record<string, unknown>): Guest => ({
    id: Number(guest.id),
    firstName: String(guest.first_name ?? ''),
    lastName: String(guest.last_name ?? ''),
    email: String(guest.email ?? ''),
    role: 'guest',
});

const normalizeBasicUser = (user: Record<string, unknown>): BasicUser => ({
    firstName: String(user.first_name ?? ''),
    lastName: String(user.last_name ?? ''),
    role: String(user.role ?? ''),
});

const toCreatePayload = (guest: Pick<Guest, 'firstName' | 'lastName' | 'email'>) => ({
    first_name: guest.firstName,
    last_name: guest.lastName || null,
    email: guest.email || null,
});

const toUpdatePayload = (guest: Partial<Guest>) => {
    const payload: Record<string, string | null> = {};
    if (guest.firstName !== undefined) payload.first_name = guest.firstName;
    if (guest.lastName !== undefined) payload.last_name = guest.lastName || null;
    if (guest.email !== undefined) payload.email = guest.email || null;
    return payload;
};

export const getEntryName = (entry: DirectoryEntry) =>
    `${entry.firstName} ${entry.lastName}`.trim() || (isGuest(entry as Guest) ? entry.email : '') || '';

export const useGuests = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const browseUsers = useCallback(async (options: { search?: string; page?: number; limit?: number } = {}) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get(ENDPOINTS.USERS.BROWSE, {
                params: {
                    page: options.page ?? 1,
                    limit: options.limit ?? 100,
                    search: options.search || undefined,
                },
            });
            const payload = response.data;
            const entries = (payload.users ?? []).map((entry: Record<string, unknown>) =>
                entry.role === 'guest' ? normalizeGuest(entry) : normalizeBasicUser(entry),
            );

            return {
                success: true,
                entries,
                totalCount: payload.total_count ?? 0,
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, entries: [], totalCount: 0, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createGuest = useCallback(async (guestData: Pick<Guest, 'firstName' | 'lastName' | 'email'>) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.post(ENDPOINTS.USERS.GUESTS, toCreatePayload(guestData));
            return { success: true, guest: normalizeGuest(response.data) };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateGuest = useCallback(async (guestId: number, guestData: Partial<Guest>) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.put(
                ENDPOINTS.USERS.DETAILS(guestId),
                toUpdatePayload(guestData),
            );
            return { success: true, guest: normalizeGuest(response.data) };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const deleteGuest = useCallback(async (guestId: number) => {
        setIsLoading(true);
        setError(null);

        try {
            await axiosClient.delete(ENDPOINTS.USERS.DETAILS(guestId));
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

    return { browseUsers, createGuest, updateGuest, deleteGuest, isLoading, error, clearError, isGuest };
};
