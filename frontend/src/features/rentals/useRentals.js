import { useCallback, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';
import { parseApiError } from '../../api/apiUtils';

/**
 * @typedef {Object} Loan
 * @property {number} id
 * @property {number} item_id
 * @property {number} borrower_id - ID Gościa (User z rolą GUEST)
 * @property {number} registered_by - ID osoby rejestrującej wypożyczenie
 * @property {string} created_at
 * @property {string} declared_return_date
 * @property {string|null} loan_purpose
 * @property {string|null} returned_at
 * @property {('active'|'returned')} status
 */

/**
 * Hook do obsługi wypożyczeń obiektów podmiotom zewnętrznym (Gościom).
 * Cała komunikacja sieciowa domeny "rentals" jest tutaj scentralizowana.
 *
 * @returns {{
 *   registerLoan: Function,
 *   listLoans: Function,
 *   returnLoan: Function,
 *   isLoading: boolean,
 *   error: string|null,
 *   clearError: Function
 * }}
 */
export const useRentals = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    /**
     * Rejestruje wypożyczenie obiektu Gościowi (POST /loans).
     * @param {Object} loanData
     * @param {number} loanData.itemId - ID obiektu z rejestru
     * @param {number} loanData.borrowerId - ID profilu Gościa
     * @param {string} loanData.declaredReturnDate - Deklarowany termin zwrotu (ISO / YYYY-MM-DD)
     * @param {string} [loanData.loanPurpose] - Cel wypożyczenia (opcjonalny)
     */
    const registerLoan = useCallback(async (loanData) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.post(ENDPOINTS.LOANS.BASE, {
                item_id: loanData.itemId,
                borrower_id: loanData.borrowerId,
                declared_return_date: loanData.declaredReturnDate,
                loan_purpose: loanData.loanPurpose || null,
            });

            return { success: true, data: response.data, statusCode: response.status };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage, statusCode: err.response?.status };
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Pobiera listę wypożyczeń (historia), z opcjonalnym filtrowaniem.
     * @param {Object} [filters]
     * @param {number} [filters.itemId]
     * @param {number} [filters.borrowerId]
     * @param {('active'|'returned')} [filters.loanStatus]
     */
    const listLoans = useCallback(async (filters = {}) => {
        setIsLoading(true);
        setError(null);

        try {
            const params = {};
            if (filters.itemId) params.item_id = filters.itemId;
            if (filters.borrowerId) params.borrower_id = filters.borrowerId;
            if (filters.loanStatus) params.loan_status = filters.loanStatus;

            const response = await axiosClient.get(ENDPOINTS.LOANS.BASE, { params });
            const payload = response.data;

            return {
                success: true,
                loans: payload.loans ?? [],
                totalCount: payload.total_count ?? 0,
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, loans: [], totalCount: 0, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Rejestruje zwrot wypożyczenia (POST /loans/{id}/return).
     * @param {number} loanId
     */
    const returnLoan = useCallback(async (loanId) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.post(ENDPOINTS.LOANS.RETURN(loanId));
            return { success: true, data: response.data };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage, statusCode: err.response?.status };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return { registerLoan, listLoans, returnLoan, isLoading, error, clearError };
};
