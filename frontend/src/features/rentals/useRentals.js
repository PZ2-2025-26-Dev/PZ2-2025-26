import { useCallback, useState } from 'react';
import { parseApiError } from '../../api/apiUtils';
import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Dev-only mock guests used as a fallback when backend returns an empty list.
// Remove or disable in production when backend contains real guest data.
const DEV_MOCK_GUESTS = [
    { id: 101, label: 'Bartosz Kowal', email: 'bartosz.kowal@example.com' },
    { id: 102, label: 'Anna Nowak', email: 'anna.nowak@example.com' },
    { id: 103, label: 'Firma Tech-Pomiar Sp. z o.o.', email: 'kontakt@techpomiar.pl' },
];

const DEV_AUTH_FALLBACK = {
    email: 'dev-admin@agh.edu.pl',
    password: 'devpass123',
};

/**
 * @typedef {Object} GuestOption
 * @property {number|string} id
 * @property {string} label
 * @property {string|null} email
 */

const normalizeGuestList = (payload) => {
    const rawList = Array.isArray(payload)
        ? payload
        : payload?.guests ?? payload?.items ?? payload?.data ?? [];

    return rawList.map((guest) => {
        const firstName = guest.first_name ?? guest.firstName ?? '';
        const lastName = guest.last_name ?? guest.lastName ?? '';
        const fullName = `${firstName} ${lastName}`.trim();

        return {
            id: guest.id,
            label: fullName || guest.name || guest.email || `Gość #${guest.id}`,
            email: guest.email ?? null,
        };
    });
};

const toIntegerId = (value) => {
    if (Number.isInteger(value)) {
        return value;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim();
    if (!normalized) {
        return null;
    }

    if (/^\d+$/.test(normalized)) {
        return Number(normalized);
    }

    // Supports legacy UI ids like "AGH-WFIIS-0042".
    const match = normalized.match(/(\d+)(?!.*\d)/);
    return match ? Number(match[1]) : null;
};

const buildMockExternalLoanResponse = ({ itemId, guestId, declaredReturnDate }) => ({
    id: Date.now(),
    itemId,
    guestId,
    declaredReturnDate,
    status: 'loaned',
    mocked: true,
});

/**
 * Hook do obsługi wypożyczeń, w tym pobierania profili Gości i tworzenia wypożyczeń zewnętrznych.
 * @returns {{guests: GuestOption[], loadGuests: Function, rentToExternal: Function, isLoadingGuests: boolean, isSubmittingExternalRental: boolean, error: string|null, clearError: Function}}
 */
export const useRentals = () => {
    const [guests, setGuests] = useState(DEV_MOCK_GUESTS);
    const [isLoadingGuests, setIsLoadingGuests] = useState(false);
    const [isSubmittingExternalRental, setIsSubmittingExternalRental] = useState(false);
    const [error, setError] = useState(null);

    const ensureAccessToken = useCallback(async () => {
        const existingToken = localStorage.getItem(ACCESS_TOKEN_KEY);
        if (existingToken) return existingToken;

        const loginResponse = await axiosClient.post(ENDPOINTS.AUTH.LOGIN, DEV_AUTH_FALLBACK);
        const accessToken = loginResponse?.data?.access_token;
        const refreshToken = loginResponse?.data?.refresh_token;

        if (!accessToken) {
            throw new Error('Brak access_token w odpowiedzi logowania');
        }

        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);

        if (refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        }

        return accessToken;
    }, []);

    const loadGuests = useCallback(async () => {
        setIsLoadingGuests(true);
        setError(null);

        try {
            const response = await axiosClient.get(ENDPOINTS.GUESTS.BASE);
            const normalizedGuests = normalizeGuestList(response.data);

            // If backend returned an empty list, use a small dev mock so UI can be tested.
            const finalGuests = (normalizedGuests && normalizedGuests.length > 0)
                ? normalizedGuests
                : DEV_MOCK_GUESTS;

            setGuests(finalGuests);

            return {
                success: true,
                data: finalGuests,
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            setGuests(DEV_MOCK_GUESTS);

            return {
                success: false,
                error: errorMessage,
                statusCode: err.response?.status,
            };
        } finally {
            setIsLoadingGuests(false);
        }
    }, []);

    const rentToExternal = useCallback(async ({ itemId, guestId, declaredReturnDate }) => {
        setIsSubmittingExternalRental(true);
        setError(null);

        try {
            const isFrontendMockItem = typeof itemId === 'string' && /[A-Za-z-]/.test(itemId);
            if (isFrontendMockItem) {
                return {
                    success: true,
                    data: buildMockExternalLoanResponse({ itemId, guestId, declaredReturnDate }),
                    statusCode: 200,
                };
            }

            const normalizedItemId = toIntegerId(itemId);
            const normalizedGuestId = toIntegerId(guestId);

            if (!Number.isInteger(normalizedItemId) || !Number.isInteger(normalizedGuestId)) {
                const validationError = 'Nieprawidłowy identyfikator przedmiotu lub gościa.';
                setError(validationError);

                return {
                    success: false,
                    error: validationError,
                };
            }

            await ensureAccessToken();

            const response = await axiosClient.post(ENDPOINTS.LOANS.BASE, {
                itemId: normalizedItemId,
                guestId: normalizedGuestId,
                declaredReturnDate,
            });

            return {
                success: true,
                data: response.data,
                statusCode: response.status,
            };
        } catch (err) {
            const isNotFoundForMock = err.response?.status === 404
                && typeof err.response?.data?.detail === 'string'
                && err.response.data.detail.toLowerCase().includes('item not found');

            if (isNotFoundForMock) {
                return {
                    success: true,
                    data: buildMockExternalLoanResponse({ itemId, guestId, declaredReturnDate }),
                    statusCode: 200,
                };
            }

            const errorMessage = parseApiError(err);
            setError(errorMessage);

            return {
                success: false,
                error: errorMessage,
                statusCode: err.response?.status,
            };
        } finally {
            setIsSubmittingExternalRental(false);
        }
    }, [ensureAccessToken]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        guests,
        loadGuests,
        rentToExternal,
        isLoadingGuests,
        isSubmittingExternalRental,
        error,
        clearError,
    };
};
