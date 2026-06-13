import { useState, useEffect, useCallback, useRef } from 'react';
import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';
import { parseApiError } from '../../api/apiUtils';

/**
 * @typedef {Object} LocationTreeNode
 * @property {number} id
 * @property {string} name
 * @property {'building'|'room'|'cabinet'|'shelf'} type
 * @property {LocationTreeNode[]} children
 */

/**
 * @typedef {Object} ItemDetails
 * @property {number} id
 * @property {string} name
 * @property {{ id: number, name: string }} category
 * @property {{ id: number, path: string }} location
 * @property {{ id: number, name: string }} owner
 * @property {string|null} description
 * @property {string} status
 * @property {string|null} legacy_id
 */

const SEARCH_DEBOUNCE_MS = 300;

/**
 * @param {LocationTreeNode[]} tree
 * @param {string} [parentPath]
 * @returns {{ id: number, name: string, path: string, type: string }[]}
 */
export function flattenLocationTree(tree, parentPath = '') {
    const result = [];
    for (const node of tree) {
        const path = parentPath ? `${parentPath} / ${node.name}` : node.name;
        result.push({ id: node.id, name: node.name, path, type: node.type });
        if (node.children?.length) {
            result.push(...flattenLocationTree(node.children, path));
        }
    }
    return result;
}

export async function fetchLocationTree(search = '') {
    const params = search ? { search } : {};
    const { data } = await axiosClient.get(ENDPOINTS.LOCATIONS.TREE, { params });
    return data.tree ?? [];
}

export const useLocationTree = () => {
    const [tree, setTree] = useState([]);
    const [itemsByLocation, setItemsByLocation] = useState({});
    const [isLoadingTree, setIsLoadingTree] = useState(false);
    const [loadingLocationIds, setLoadingLocationIds] = useState(new Set());
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilters, setStatusFilters] = useState([]);
    const selectedLocationIdsRef = useRef(new Set());

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchTree = useCallback(async (searchQuery, { silent = false } = {}) => {
        if (!silent) {
            setIsLoadingTree((loading) => loading || tree.length === 0);
        }
        setError(null);
        try {
            const params = searchQuery ? { search: searchQuery } : {};
            const { data } = await axiosClient.get(ENDPOINTS.LOCATIONS.TREE, { params });
            setTree(data.tree ?? []);
        } catch (err) {
            setError(parseApiError(err));
        } finally {
            setIsLoadingTree(false);
        }
    }, [tree.length]);

    useEffect(() => {
        fetchTree(debouncedSearch, { silent: tree.length > 0 });
    }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchItemsForLocation = useCallback(async (locationId, statuses = statusFilters) => {
        setLoadingLocationIds((prev) => new Set(prev).add(Number(locationId)));
        setError(null);
        try {
            const params = {
                location_id: locationId,
                include_descendants: true,
                limit: 100,
            };
            if (statuses.length > 0) params.status = statuses;

            const { data } = await axiosClient.get(ENDPOINTS.ITEMS.BASE, { params });
            setItemsByLocation((prev) => ({ ...prev, [Number(locationId)]: data.items ?? [] }));
        } catch (err) {
            setError(parseApiError(err));
            setItemsByLocation((prev) => ({ ...prev, [Number(locationId)]: [] }));
        } finally {
            setLoadingLocationIds((prev) => {
                const next = new Set(prev);
                next.delete(Number(locationId));
                return next;
            });
        }
    }, [statusFilters]);

    const selectLocation = useCallback((locationId) => {
        selectedLocationIdsRef.current.add(Number(locationId));
        fetchItemsForLocation(locationId);
    }, [fetchItemsForLocation]);

    const refreshSelectedLocations = useCallback(() => {
        selectedLocationIdsRef.current.forEach((locationId) => {
            fetchItemsForLocation(locationId);
        });
    }, [fetchItemsForLocation]);

    useEffect(() => {
        if (selectedLocationIdsRef.current.size === 0) return;
        refreshSelectedLocations();
    }, [statusFilters, refreshSelectedLocations]);

    const toggleStatusFilter = useCallback((status) => {
        setStatusFilters((prev) =>
            prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
        );
    }, []);

    const clearError = useCallback(() => setError(null), []);

    const isLocationLoading = useCallback(
        (locationId) => loadingLocationIds.has(Number(locationId)),
        [loadingLocationIds]
    );

    return {
        tree,
        itemsByLocation,
        isLoadingTree,
        isLocationLoading,
        error,
        search,
        setSearch,
        statusFilters,
        toggleStatusFilter,
        selectLocation,
        clearError,
        refetchTree: () => fetchTree(debouncedSearch),
        debouncedSearch,
    };
};
