import { useCallback, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';
import { parseApiError } from '../../api/apiUtils';

/**
 * @typedef {Object} Loan
 * @property {number} id
 * @property {number} item_id
 * @property {number} borrower_id
 * @property {number} registered_by
 * @property {string} created_at
 * @property {string} declared_return_date
 * @property {string|null} loan_purpose
 * @property {string|null} returned_at
 * @property {('active'|'returned')} status
 */

export const useRentals = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

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

    const listLoans = useCallback(async (filters = {}) => {
        setIsLoading(true);
        setError(null);

        try {
            const params = {};
            if (filters.itemId) params.item_id = filters.itemId;
            if (filters.borrowerId) params.borrower_id = filters.borrowerId;
            if (filters.loanStatus) params.loan_status = filters.loanStatus;
            if (filters.page) params.page = filters.page;
            if (filters.limit) params.limit = filters.limit;

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

    const getLoan = useCallback(async (loanId) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get(ENDPOINTS.LOANS.DETAILS(loanId));
            return { success: true, data: response.data };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage, statusCode: err.response?.status };
        } finally {
            setIsLoading(false);
        }
    }, []);

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

    return { registerLoan, listLoans, getLoan, returnLoan, isLoading, error, clearError };
};
