import { useCallback, useMemo, useSyncExternalStore } from 'react';

export const LOCATION_TYPES = ['building', 'room', 'cabinet', 'shelf'];

export const PARENT_TYPE_BY_TYPE = {
    building: null,
    room: 'building',
    cabinet: 'room',
    shelf: 'cabinet',
};

const initialLocations = [
    { id: 1, name: 'D10', type: 'building', parentId: null, description: 'Główny budynek WFiIS', isActive: true },
    { id: 2, name: 'D11', type: 'building', parentId: null, description: 'Budynek laboratoryjny', isActive: true },
    { id: 3, name: '204', type: 'room', parentId: 1, description: 'Laboratorium elektroniki', isActive: true },
    { id: 4, name: '105', type: 'room', parentId: 2, description: 'Sala pomiarowa', isActive: true },
    { id: 5, name: 'Szafa A', type: 'cabinet', parentId: 3, description: 'Aparatura podręczna', isActive: true },
    { id: 6, name: 'Półka 1', type: 'shelf', parentId: 5, description: '', isActive: true },
];

let locationsState = initialLocations;
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

const getNextLocationId = (locations) => Math.max(...locations.map(location => Number(location.id)), 0) + 1;

export const useLocations = () => {
    const locations = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    const activeLocations = useMemo(
        () => locations.filter(location => isLocationEffectivelyActive(location, locations)),
        [locations]
    );

    const activeBuildings = useMemo(
        () => activeLocations.filter(location => location.type === 'building'),
        [activeLocations]
    );

    const createLocation = useCallback((data) => {
        setLocationsState(prev => [
            ...prev,
            {
                ...data,
                id: getNextLocationId(prev),
                isActive: true,
            },
        ]);
    }, []);

    const updateLocation = useCallback((locationId, data) => {
        setLocationsState(prev => prev.map(location => (
            String(location.id) === String(locationId)
                ? { ...location, ...data }
                : location
        )));
    }, []);

    const toggleLocationActive = useCallback((locationId) => {
        setLocationsState(prev => prev.map(location => (
            String(location.id) === String(locationId)
                ? { ...location, isActive: location.isActive === false }
                : location
        )));
    }, []);

    const getActiveRoomsForBuilding = useCallback((buildingId) => activeLocations.filter(location => (
        location.type === 'room' && String(location.parentId) === String(buildingId)
    )), [activeLocations]);

    const getLocationPath = useCallback((locationId) => {
        const location = locations.find(candidate => String(candidate.id) === String(locationId));
        return buildLocationPath(location, locations);
    }, [locations]);

    return {
        locations,
        activeLocations,
        activeBuildings,
        createLocation,
        getActiveRoomsForBuilding,
        getLocationPath,
        toggleLocationActive,
        updateLocation,
    };
};
