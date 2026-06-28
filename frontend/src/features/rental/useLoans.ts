import { useCallback, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';
import { parseApiError } from '../../api/apiUtils';

export type LoanStatus = 'pending_approval' | 'active' | 'return_pending_confirmation' | 'closed' | 'rejected';
export type LoanScope = 'my' | 'owned' | 'all';
export type ReturnCondition = 'ok' | 'broken' | 'missing';

export type LoanBorrower = {
    id: number;
    name: string;
    role: string;
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
    note: string | null;
    borrowed_at: string | null;
    returned_at: string | null;
    decision_by: number | null;
    decision_at: string | null;
    decision_comment: string | null;
    return_reported_by: number | null;
    return_reported_at: string | null;
    return_condition: ReturnCondition | null;
    return_note: string | null;
    return_confirmed_by: number | null;
    return_confirmed_at: string | null;
    return_confirmation_note: string | null;
};

export type CreateLoanData = {
    item_id: string;
    declared_return_date: string;
    borrower_user_id?: number;
    guest_id?: number;
    note?: string;
};

export type CreateExternalLoanData = {
    item_id: string;
    guest_id: number;
    declared_return_date: string;
    note?: string;
};

export type ListLoansParams = {
    scope?: LoanScope;
    status?: LoanStatus | 'all';
};

const normalizeStatus = (status?: LoanStatus | 'all') => status && status !== 'all' ? status : undefined;

export const useLoans = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const clearError = useCallback(() => setError(null), []);

    const listLoans = useCallback(async (params: ListLoansParams = {}) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axiosClient.get(ENDPOINTS.LOANS.BASE, {
                params: {
                    scope: params.scope ?? 'my',
                    status: normalizeStatus(params.status),
                },
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

    const approveLoan = useCallback(async (loanId: number, note?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axiosClient.post(ENDPOINTS.LOANS.APPROVE(loanId), { approved: true, note: note ?? null });
            return { success: true, loan: response.data as Loan };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const rejectLoan = useCallback(async (loanId: number, note?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axiosClient.post(ENDPOINTS.LOANS.APPROVE(loanId), { approved: false, note: note ?? null });
            return { success: true, loan: response.data as Loan };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const returnLoan = useCallback(async (loanId: number, condition: ReturnCondition, note?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axiosClient.post(ENDPOINTS.LOANS.RETURN(loanId), { condition, note: note ?? null });
            return { success: true, loan: response.data as Loan };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const confirmReturn = useCallback(async (loanId: number, approved: boolean, condition?: ReturnCondition, note?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axiosClient.post(ENDPOINTS.LOANS.CONFIRM_RETURN(loanId), {
                approved,
                condition: condition ?? null,
                note: note ?? null,
            });
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
        denyLoan: rejectLoan,
        rejectLoan,
        returnLoan,
        confirmReturn,
    };
};
