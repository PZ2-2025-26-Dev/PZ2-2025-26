import { useCallback, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';
import { parseApiError } from '../../api/apiUtils';

export type LoanStatus = 'pending' | 'approved' | 'denied' | 'loaned' | 'returned';

export type LoanBorrower = {
    id: number;
    name: string;
};

export type LoanItemOwner = {
    id: number;
    name: string;
};

export type LoanItem = {
    id: string;
    name: string;
    owner: LoanItemOwner;
};

export type Loan = {
    id: number;
    item: LoanItem;
    borrower: LoanBorrower | null;
    status: LoanStatus;
    is_external: boolean;
    created_at: string;
    declared_return_date: string;
    loan_purpose: string;
    borrowed_at: string | null;
    returned_at: string | null;
    decision_by: number | null;
    decision_at: string | null;
    decision_comment: string | null;
};

export type CreateLoanData = {
    item_id: string;
    declared_return_date: string;
    loan_purpose: string;
};

export type CreateExternalLoanData = {
    item_id: string;
    guest_id: number;
    declared_return_date: string;
    loan_purpose: string;
};

export const useLoans = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const clearError = useCallback(() => setError(null), []);

    const listLoans = useCallback(async (status?: LoanStatus) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axiosClient.get(ENDPOINTS.LOANS.BASE, {
                params: status ? { status } : {},
            });
            return { success: true, loans: response.data.loans as Loan[] };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, loans: [], error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createLoan = useCallback(async (data: CreateLoanData) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axiosClient.post(ENDPOINTS.LOANS.BASE, data);
            return { success: true, loan: response.data as Loan };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createExternalLoan = useCallback(async (data: CreateExternalLoanData) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axiosClient.post(ENDPOINTS.LOANS.EXTERNAL, data);
            return { success: true, loan: response.data as Loan };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const approveLoan = useCallback(async (loanId: number, comment?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axiosClient.post(ENDPOINTS.LOANS.APPROVE(loanId), { comment: comment ?? null });
            return { success: true, loan: response.data as Loan };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const denyLoan = useCallback(async (loanId: number, comment?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axiosClient.post(ENDPOINTS.LOANS.DENY(loanId), { comment: comment ?? null });
            return { success: true, loan: response.data as Loan };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const activateLoan = useCallback(async (loanId: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axiosClient.post(ENDPOINTS.LOANS.ACTIVATE(loanId));
            return { success: true, loan: response.data as Loan };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const returnLoan = useCallback(async (loanId: number, comment?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axiosClient.post(ENDPOINTS.LOANS.RETURN(loanId), { comment: comment ?? null });
            return { success: true, loan: response.data as Loan };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        isLoading,
        error,
        clearError,
        listLoans,
        createLoan,
        createExternalLoan,
        approveLoan,
        denyLoan,
        activateLoan,
        returnLoan,
    };
};
