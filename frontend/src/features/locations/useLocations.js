import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';
import { parseApiError } from '../../api/apiUtils';

export const LOCATION_TYPES = ['building', 'room', 'cabinet', 'shelf'];

export const PARENT_TYPE_BY_TYPE = {
    building: null,
    room: 'building',
    cabinet: 'room',
    shelf: 'cabinet',
};

let locationsState = {
    locations: [],
    isLoading: false,
    error: null,
    hasLoaded: false,
};
const listeners = new Set();

const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const getSnapshot = () => locationsState;

const setLocationsState = (updater) => {
    locationsState = typeof updater === 'function' ? updater(locationsState) : updater;
    listeners.forEach(listener => listener());
};

const flattenLocationTree = (nodes, parentId = null) => nodes.flatMap(node => [
    {
        id: node.id,
        name: node.name,
        type: node.type,
        parentId,
        description: node.description || '',
        isActive: node.isActive ?? node.is_active ?? true,
    },
    ...flattenLocationTree(node.children || [], node.id),
]);

export const buildLocationTree = (locations) => {
    const lookup = {};
    const roots = [];

    locations.forEach(location => {
        lookup[location.id] = { ...location, children: [] };
    });

    locations.forEach(location => {
        if (location.parentId && lookup[location.parentId]) {
            lookup[location.parentId].children.push(lookup[location.id]);
        } else {
            roots.push(lookup[location.id]);
        }
    });

    return roots;
};

export const collectTreeNodes = (node) => [
    ...node.children,
    ...node.children.flatMap(child => collectTreeNodes(child)),
];

export const collectDescendantIds = (node) => {
    const ids = [];

    node.children.forEach(child => {
        ids.push(child.id, ...collectDescendantIds(child));
    });

    return ids;
};

export const isLocationEffectivelyActive = (location, locations) => {
    if (location.isActive === false) return false;

    let parentId = location.parentId;

    while (parentId) {
        const parent = locations.find(candidate => String(candidate.id) === String(parentId));

        if (!parent) return true;
        if (parent.isActive === false) return false;

        parentId = parent.parentId;
    }

    return true;
};

const buildLocationPath = (location, locations) => {
    if (!location) return '';

    const path = [location.name];
    let parentId = location.parentId;

    while (parentId) {
        const parent = locations.find(candidate => String(candidate.id) === String(parentId));

        if (!parent) break;

        path.unshift(parent.name);
        parentId = parent.parentId;
    }

    return path.join(' / ');
};

export const useLocations = () => {
    const store = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const { error, hasLoaded, isLoading, locations } = store;

    const loadLocations = useCallback(async (force = false) => {
        if (locationsState.isLoading && !force) return;

        setLocationsState(prev => ({
            ...prev,
            isLoading: true,
            error: null,
        }));

        try {
            const response = await axiosClient.get(ENDPOINTS.LOCATIONS.TREE);

            setLocationsState(prev => ({
                ...prev,
                locations: flattenLocationTree(response.data.items || []),
                isLoading: false,
                error: null,
                hasLoaded: true,
            }));
        } catch (err) {
            setLocationsState(prev => ({
                ...prev,
                isLoading: false,
                error: parseApiError(err),
                hasLoaded: true,
            }));
        }
    }, []);

    useEffect(() => {
        if (!hasLoaded && !isLoading) {
            loadLocations();
        }
    }, [hasLoaded, isLoading, loadLocations]);

    const activeLocations = useMemo(
        () => locations.filter(location => isLocationEffectivelyActive(location, locations)),
        [locations]
    );

    const activeBuildings = useMemo(
        () => activeLocations.filter(location => location.type === 'building'),
        [activeLocations]
    );

    const createLocation = useCallback(async (data) => {
        setLocationsState(prev => ({
            ...prev,
            isLoading: true,
            error: null,
        }));

        try {
            const response = await axiosClient.post(ENDPOINTS.LOCATIONS.BASE, {
                name: data.name,
                type: data.type,
                parentId: data.parentId,
                description: data.description || null,
            });

            await loadLocations(true);

            return {
                success: true,
                data: response.data,
                statusCode: response.status,
            };
        } catch (err) {
            const errorMessage = parseApiError(err);

            setLocationsState(prev => ({
                ...prev,
                isLoading: false,
                error: errorMessage,
            }));

            return {
                success: false,
                error: errorMessage,
                statusCode: err.response?.status,
            };
        }
    }, [loadLocations]);

    const deleteLocation = useCallback(async (locationId, replacementLocationId) => {
        setLocationsState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const response = await axiosClient.delete(ENDPOINTS.LOCATIONS.DETAILS(locationId), {
                params: { replacementLocationId },
            });

            await loadLocations(true);

            return { success: true, data: response.data, statusCode: response.status };
        } catch (err) {
            const errorMessage = parseApiError(err);
            setLocationsState(prev => ({ ...prev, isLoading: false, error: errorMessage }));

            return { success: false, error: errorMessage, statusCode: err.response?.status };
        }
    }, [loadLocations]);

    const updateLocation = useCallback((locationId, data) => {
        setLocationsState(prev => ({
            ...prev,
            locations: prev.locations.map(location => (
                String(location.id) === String(locationId)
                    ? { ...location, ...data }
                    : location
            )),
        }));
    }, []);

    const toggleLocationActive = useCallback((locationId) => {
        setLocationsState(prev => ({
            ...prev,
            locations: prev.locations.map(location => (
                String(location.id) === String(locationId)
                    ? { ...location, isActive: location.isActive === false }
                    : location
            )),
        }));
    }, []);

    const getActiveRoomsForBuilding = useCallback((buildingId) => activeLocations.filter(location => (
        location.type === 'room' && String(location.parentId) === String(buildingId)
    )), [activeLocations]);

    const getLocationPath = useCallback((locationId) => {
        const location = locations.find(candidate => String(candidate.id) === String(locationId));
        return buildLocationPath(location, locations);
    }, [locations]);

    const clearError = useCallback(() => {
        setLocationsState(prev => ({
            ...prev,
            error: null,
        }));
    }, []);

    return {
        locations,
        activeLocations,
        activeBuildings,
        clearError,
        createLocation,
        deleteLocation,
        error,
        getActiveRoomsForBuilding,
        getLocationPath,
        isLoading,
        loadLocations,
        toggleLocationActive,
        updateLocation,
    };
};
