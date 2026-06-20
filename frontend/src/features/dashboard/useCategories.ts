import { useCallback, useState } from 'react';

import axiosClient from '@/api/axiosClient';
import { parseApiError } from '@/api/apiUtils';
import { ENDPOINTS } from '@/api/endpoints';

export type Category = {
    id: number;
    name: string;
    parentId: number | null;
    description: string | null;
    isActive: boolean;
    path: string;
};

type CategoryApiResponse = {
    id: number;
    name: string;
    parent_id?: number | null;
    parentId?: number | null;
    description?: string | null;
    is_active?: boolean;
    isActive?: boolean;
    path: string;
};

type CategoriesPagedResponse = {
    categories?: CategoryApiResponse[];
    items?: CategoryApiResponse[];
    pagination?: {
        page: number;
        limit: number;
        total: number;
    };
};

export type CategoryCreateInput = {
    name: string;
    parentId: number | null;
};

export type CategoryUpdateInput = CategoryCreateInput;

const normalizeCategory = (category: CategoryApiResponse): Category => ({
    id: category.id,
    name: category.name,
    parentId: category.parentId ?? category.parent_id ?? null,
    description: category.description ?? null,
    isActive: category.isActive ?? category.is_active ?? true,
    path: category.path,
});

const toCreatePayload = (category: CategoryCreateInput) => ({
    name: category.name,
    parent_id: category.parentId,
});

const toUpdatePayload = (category: CategoryUpdateInput) => ({
    name: category.name,
    parent_id: category.parentId,
});

export const useCategories = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const listCategories = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.get<CategoriesPagedResponse>(ENDPOINTS.CATEGORIES.BASE, {
                params: { page: 1, limit: 100 },
            });
            const categories = response.data.categories ?? response.data.items ?? [];

            return {
                success: true,
                categories: categories.map(normalizeCategory),
                totalCount: response.data.pagination?.total ?? categories.length,
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, categories: [], totalCount: 0, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createCategory = useCallback(async (category: CategoryCreateInput) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.post<CategoryApiResponse>(
                ENDPOINTS.CATEGORIES.BASE,
                toCreatePayload(category),
            );

            return {
                success: true,
                category: normalizeCategory(response.data),
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateCategory = useCallback(async (categoryId: number, category: CategoryUpdateInput) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axiosClient.put<CategoryApiResponse>(
                ENDPOINTS.CATEGORIES.DETAILS(categoryId),
                toUpdatePayload(category),
            );

            return {
                success: true,
                category: normalizeCategory(response.data),
            };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const deleteCategory = useCallback(async (categoryId: number, replacementCategoryId: number) => {
        setIsLoading(true);
        setError(null);

        try {
            await axiosClient.delete(
                ENDPOINTS.CATEGORIES.DETAILS(categoryId),
                { params: { replacement_category_id: replacementCategoryId } },
            );

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
        listCategories,
        createCategory,
        updateCategory,
        deleteCategory,
        isLoading,
        error,
        clearError,
    };
};
