import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    LOCATION_TYPES,
    PARENT_TYPE_BY_TYPE,
    isLocationEffectivelyActive,
    useLocations,
} from './useLocations';

const NEXT_TYPE_BY_TYPE = {
    building: 'room',
    room: 'cabinet',
    cabinet: 'shelf',
    shelf: null,
};

const LEVELS = [
    { type: 'building', labelKey: 'selectBuilding', parentKey: null, stateKey: 'buildingId' },
    { type: 'room', labelKey: 'selectRoom', parentKey: 'buildingId', stateKey: 'roomId' },
    { type: 'cabinet', labelKey: 'selectCabinet', parentKey: 'roomId', stateKey: 'cabinetId' },
    { type: 'shelf', labelKey: 'selectShelf', parentKey: 'cabinetId', stateKey: 'shelfId' },
];

const initialSelection = {
    buildingId: '',
    roomId: '',
    cabinetId: '',
    shelfId: '',
};

const initialFormData = {
    name: '',
    type: 'building',
    parentId: '',
    description: '',
};

export default function LocationManager() {
    const { t } = useTranslation();
    const {
        activeLocations,
        createLocation,
        deleteLocation,
        error,
        getLocationPath,
        isLoading,
        locations,
        toggleLocationActive,
        updateLocation,
    } = useLocations();

    const [selection, setSelection] = useState(initialSelection);
    const [formData, setFormData] = useState(initialFormData);
    const [editCandidate, setEditCandidate] = useState(null);
    const [editFormData, setEditFormData] = useState({ name: '', description: '' });
    const [deleteCandidate, setDeleteCandidate] = useState(null);
    const [replacementLocationId, setReplacementLocationId] = useState('');

    const selectedPath = useMemo(() => LEVELS
        .map(level => locations.find(location => String(location.id) === String(selection[level.stateKey])))
        .filter(Boolean), [locations, selection]);
    const currentParent = selectedPath.at(-1) || null;
    const childType = currentParent ? NEXT_TYPE_BY_TYPE[currentParent.type] : 'building';

    const visibleLocations = useMemo(() => {
        if (currentParent) {
            return locations.filter(location => String(location.parentId) === String(currentParent.id));
        }

        return locations.filter(location => location.type === 'building');
    }, [currentParent, locations]);

    const locationOptionsByType = useMemo(() => LEVELS.reduce((acc, level) => {
        const parentId = level.parentKey ? selection[level.parentKey] : null;

        acc[level.type] = locations.filter(location => (
            location.type === level.type
            && (!level.parentKey || String(location.parentId) === String(parentId))
        ));

        return acc;
    }, {}), [locations, selection]);

    const availableParents = useMemo(() => {
        const expectedParentType = PARENT_TYPE_BY_TYPE[formData.type];

        if (!expectedParentType) return [];

        return locations.filter(location => (
            location.type === expectedParentType
            && isLocationEffectivelyActive(location, locations)
        ));
    }, [formData.type, locations]);

    const isParentRequired = Boolean(PARENT_TYPE_BY_TYPE[formData.type]);
    const canSubmit = formData.name.trim() && (!isParentRequired || formData.parentId) && !isLoading;
    const canAddInCurrentPlace = Boolean(childType);
    const canEdit = editFormData.name.trim() && !isLoading;
    const replacementRooms = activeLocations.filter(location => (
        location.type === 'room' && String(location.id) !== String(deleteCandidate?.id)
    ));

    const resetForm = () => {
        setFormData(initialFormData);
    };

    const setSelectedLevel = (levelIndex, value) => {
        setSelection(prev => LEVELS.reduce((nextSelection, level, index) => ({
            ...nextSelection,
            [level.stateKey]: index < levelIndex ? prev[level.stateKey] : index === levelIndex ? value : '',
        }), {}));
    };

    const openLocationLevel = (location) => {
        const levelIndex = LEVELS.findIndex(level => level.type === location.type);

        if (levelIndex >= 0) {
            setSelectedLevel(levelIndex, location.id);
        }
    };

    const handleTypeChange = (type) => {
        setFormData(prev => ({
            ...prev,
            type,
            parentId: '',
        }));
    };

    const handleAddHere = () => {
        if (!canAddInCurrentPlace) return;

        setFormData({
            name: '',
            type: childType,
            parentId: currentParent?.id || '',
            description: '',
        });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!canSubmit) return;

        const result = await createLocation({
            name: formData.name.trim(),
            type: formData.type,
            parentId: formData.parentId ? Number(formData.parentId) : null,
            description: formData.description.trim(),
        });

        if (result.success) {
            resetForm();
        }
    };

    const openEditModal = (location) => {
        setEditCandidate(location);
        setEditFormData({
            name: location.name,
            description: location.description || '',
        });
    };

    const closeEditModal = () => {
        setEditCandidate(null);
        setEditFormData({ name: '', description: '' });
    };

    const handleEdit = (event) => {
        event.preventDefault();

        if (!canEdit) return;

        updateLocation(editCandidate.id, {
            name: editFormData.name.trim(),
            description: editFormData.description.trim(),
        });
        closeEditModal();
    };

    const openDeleteModal = (location) => {
        const firstRoom = activeLocations.find(candidate => (
            candidate.type === 'room' && String(candidate.id) !== String(location.id)
        ));

        setDeleteCandidate(location);
        setReplacementLocationId(firstRoom?.id || '');
    };

    const handleDelete = async (event) => {
        event.preventDefault();

        const result = await deleteLocation(deleteCandidate.id, replacementLocationId);

        if (result.success) {
            setDeleteCandidate(null);
            setReplacementLocationId('');
            setSelection(prev => Object.entries(prev).reduce((nextSelection, [key, value]) => ({
                ...nextSelection,
                [key]: String(value) === String(deleteCandidate.id) ? '' : value,
            }), {}));
        }
    };

    return (
        <>
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 animate-fadeIn">
                <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-4">
                            <div>
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('locationManager.navigationTitle')}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('locationManager.navigationDesc')}</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddHere}
                                disabled={!canAddInCurrentPlace || isLoading}
                                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('locationManager.addHere')}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                            {LEVELS.map((level, index) => {
                                const parentSelected = !level.parentKey || selection[level.parentKey];
                                const options = locationOptionsByType[level.type] || [];

                                return (
                                    <div key={level.type}>
                                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                            {t(`locationManager.${level.labelKey}`)}
                                        </label>
                                        <select
                                            value={selection[level.stateKey]}
                                            onChange={(event) => setSelectedLevel(index, event.target.value)}
                                            disabled={!parentSelected || isLoading}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <option value="">{t('locationManager.noSelection')}</option>
                                            {options.map(location => (
                                                <option key={location.id} value={location.id}>
                                                    {location.name}{location.isActive === false ? ` (${t('locationManager.hiddenBadge')})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-4 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 p-3">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                {t('locationManager.selectedPath')}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {selectedPath.length > 0
                                    ? selectedPath.map(location => location.name).join(' / ')
                                    : t('locationManager.noSelection')}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('locationManager.visibleItems')}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('locationManager.desc')}</p>
                            </div>
                        </div>

                        {isLoading && visibleLocations.length === 0 ? (
                            <div className="text-center py-8 text-sm text-slate-400">{t('locationManager.loading')}</div>
                        ) : visibleLocations.length > 0 ? (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
                                {visibleLocations.map(location => (
                                    <div
                                        key={location.id}
                                        className={`grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 p-3 ${location.isActive === false ? 'bg-slate-100/70 dark:bg-slate-900/60 opacity-75' : 'bg-white dark:bg-slate-950'}`}
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{location.name}</span>
                                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400 text-[10px] font-bold uppercase">
                                                    {t(`locationManager.types.${location.type}`)}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${location.isActive === false ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
                                                    {location.isActive === false ? t('locationManager.hiddenBadge') : t('locationManager.activeBadge')}
                                                </span>
                                            </div>
                                            {location.description && (
                                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                                                    {location.description}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {NEXT_TYPE_BY_TYPE[location.type] && (
                                                <button
                                                    type="button"
                                                    onClick={() => openLocationLevel(location)}
                                                    className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg"
                                                >
                                                    {t('locationManager.open')}
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => openEditModal(location)}
                                                className="px-3 py-1.5 text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg"
                                            >
                                                {t('locationManager.edit')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => toggleLocationActive(location.id)}
                                                className={`px-3 py-1.5 text-[10px] uppercase font-bold rounded-lg ${location.isActive === false ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30' : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'}`}
                                            >
                                                {location.isActive === false ? t('locationManager.restore') : t('locationManager.hide')}
                                            </button>
                                            {location.type === 'room' && (
                                                <button
                                                    type="button"
                                                    onClick={() => openDeleteModal(location)}
                                                    className="px-3 py-1.5 text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                                                >
                                                    {t('locationManager.delete')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-sm text-slate-400">{t('locationManager.noItemsAtLevel')}</div>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5 h-fit">
                    <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                                {t('locationManager.addTitle')}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {t('locationManager.formDesc')}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={resetForm}
                            disabled={isLoading}
                            className="text-[10px] uppercase font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                        >
                            {t('locationManager.clear')}
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                {t('locationManager.nameLabel')}
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(event) => setFormData(prev => ({ ...prev, name: event.target.value }))}
                                disabled={isLoading}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100 transition"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                {t('locationManager.typeLabel')}
                            </label>
                            <select
                                value={formData.type}
                                onChange={(event) => handleTypeChange(event.target.value)}
                                disabled={isLoading}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-300 transition"
                            >
                                {LOCATION_TYPES.map(type => (
                                    <option key={type} value={type}>{t(`locationManager.types.${type}`)}</option>
                                ))}
                            </select>
                        </div>

                        {PARENT_TYPE_BY_TYPE[formData.type] && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                    {t('locationManager.parentLabel')}
                                </label>
                                <select
                                    required
                                    value={formData.parentId}
                                    onChange={(event) => setFormData(prev => ({ ...prev, parentId: event.target.value }))}
                                    disabled={isLoading || availableParents.length === 0}
                                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">{t('locationManager.selectParent')}</option>
                                    {availableParents.map(parent => (
                                        <option key={parent.id} value={parent.id}>{getLocationPath(parent.id)}</option>
                                    ))}
                                </select>
                                {availableParents.length === 0 && (
                                    <p className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                                        {t('locationManager.noParentAvailable')}
                                    </p>
                                )}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                {t('locationManager.descriptionLabel')}
                            </label>
                            <textarea
                                rows="3"
                                value={formData.description}
                                onChange={(event) => setFormData(prev => ({ ...prev, description: event.target.value }))}
                                disabled={isLoading}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100 transition resize-none"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? t('locationManager.saving') : t('locationManager.addBtn')}
                        </button>
                    </form>
                </div>
            </div>

            {editCandidate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <form onSubmit={handleEdit} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-xl shadow-xl p-5 space-y-4">
                        <div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('locationManager.editTitle')}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {getLocationPath(editCandidate.id)}
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                {t('locationManager.nameLabel')}
                            </label>
                            <input
                                type="text"
                                required
                                value={editFormData.name}
                                onChange={(event) => setEditFormData(prev => ({ ...prev, name: event.target.value }))}
                                disabled={isLoading}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                {t('locationManager.descriptionLabel')}
                            </label>
                            <textarea
                                rows="3"
                                value={editFormData.description}
                                onChange={(event) => setEditFormData(prev => ({ ...prev, description: event.target.value }))}
                                disabled={isLoading}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100 resize-none"
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeEditModal}
                                className="px-4 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs font-medium rounded-lg"
                            >
                                {t('locationManager.cancelDelete')}
                            </button>
                            <button
                                type="submit"
                                disabled={!canEdit}
                                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                            >
                                {t('locationManager.saveChanges')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {deleteCandidate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <form onSubmit={handleDelete} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-xl shadow-xl p-5 space-y-4">
                        <div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('locationManager.deleteRoomTitle')}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {t('locationManager.deleteRoomDesc', { name: deleteCandidate.name })}
                            </p>
                        </div>

                        <select
                            required
                            value={replacementLocationId}
                            onChange={(event) => setReplacementLocationId(event.target.value)}
                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-300"
                        >
                            <option value="">{t('locationManager.selectReplacementRoom')}</option>
                            {replacementRooms.map(room => (
                                <option key={room.id} value={room.id}>{getLocationPath(room.id)}</option>
                            ))}
                        </select>

                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setDeleteCandidate(null)}
                                className="px-4 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs font-medium rounded-lg"
                            >
                                {t('locationManager.cancelDelete')}
                            </button>
                            <button
                                type="submit"
                                disabled={!replacementLocationId || isLoading}
                                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                            >
                                {t('locationManager.confirmDelete')}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
}
