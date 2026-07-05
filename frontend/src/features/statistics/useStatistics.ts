import { useCallback, useState } from 'react';

import axiosClient from '@/api/axiosClient';
import { parseApiError } from '@/api/apiUtils';
import { ENDPOINTS } from '@/api/endpoints';

export type ItemLoanStats = {
    itemUuid: string;
    itemName: string;
    loanCount: number;
    overdueCount: number;
    brokenCount: number;
    missingCount: number;
};

export type InventoryStats = {
    summary: {
        totalLoans: number;
        totalOverdue: number;
        totalBroken: number;
        totalMissing: number;
    };
    items: ItemLoanStats[];
};

export type StatisticsFilters = {
    dateFrom?: string;
    dateTo?: string;
};

type ItemLoanStatsApiResponse = {
    item_uuid: string;
    item_name: string;
    loan_count: number;
    overdue_count: number;
    broken_count: number;
    missing_count: number;
};

type InventoryStatsApiResponse = {
    summary: {
        total_loans: number;
        total_overdue: number;
        total_broken: number;
        total_missing: number;
    };
    items: ItemLoanStatsApiResponse[];
};

const normalizeStats = (payload: InventoryStatsApiResponse): InventoryStats => ({
    summary: {
        totalLoans: payload.summary?.total_loans ?? 0,
        totalOverdue: payload.summary?.total_overdue ?? 0,
        totalBroken: payload.summary?.total_broken ?? 0,
        totalMissing: payload.summary?.total_missing ?? 0,
    },
    items: (payload.items ?? []).map((item) => ({
        itemUuid: item.item_uuid,
        itemName: item.item_name,
        loanCount: item.loan_count ?? 0,
        overdueCount: item.overdue_count ?? 0,
        brokenCount: item.broken_count ?? 0,
        missingCount: item.missing_count ?? 0,
    })),
});

export const useStatistics = () => {
    const [stats, setStats] = useState<InventoryStats | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async (filters: StatisticsFilters = {}) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get<InventoryStatsApiResponse>(ENDPOINTS.EXPORT.STATISTICS, {
                params: {
                    ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
                    ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
                },
            });
            setStats(normalizeStats(response.data));
        } catch (err) {
            setError(parseApiError(err, 'Failed to load statistics'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { stats, isLoading, error, fetchStats };
};
