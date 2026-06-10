import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    LOCATION_TYPES,
    PARENT_TYPE_BY_TYPE,
    buildLocationTree,
    collectDescendantIds,
    collectTreeNodes,
    isLocationEffectivelyActive,
    useLocations,
} from './useLocations';

export default function LocationManager() {
    const { t } = useTranslation();
    const { activeLocations, createLocation, deleteLocation, error, isLoading, locations, toggleLocationActive, updateLocation } = useLocations();
    const [editingId, setEditingId] = useState(null);
    const [deleteCandidate, setDeleteCandidate] = useState(null);
    const [replacementLocationId, setReplacementLocationId] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        type: 'building',
        parentId: '',
        description: '',
    });

    const locationTree = useMemo(() => buildLocationTree(locations), [locations]);
    const editingNode = useMemo(() => locations.find(location => location.id === editingId), [editingId, locations]);

    const excludedParentIds = useMemo(() => {
        if (!editingNode) return [];

        const treeNode = buildLocationTree(locations)
            .flatMap(root => [root, ...collectTreeNodes(root)])
            .find(node => node.id === editingId);

        return treeNode ? [editingId, ...collectDescendantIds(treeNode)] : [editingId];
    }, [editingId, editingNode, locations]);

    const availableParents = useMemo(() => {
        const expectedParentType = PARENT_TYPE_BY_TYPE[formData.type];

        if (!expectedParentType) return [];

        return locations.filter(location => (
            location.type === expectedParentType
            && !excludedParentIds.includes(location.id)
            && isLocationEffectivelyActive(location, locations)
        ));
    }, [excludedParentIds, formData.type, locations]);

    const isParentRequired = Boolean(PARENT_TYPE_BY_TYPE[formData.type]);
    const canSubmit = formData.name.trim() && (!isParentRequired || formData.parentId) && !isLoading;
    const replacementRooms = activeLocations.filter(location => (
        location.type === 'room' && String(location.id) !== String(deleteCandidate?.id)
    ));

    const resetForm = () => {
        setEditingId(null);
        setFormData({
            name: '',
            type: 'building',
            parentId: '',
            description: '',
        });
    };

    const handleTypeChange = (type) => {
        setFormData(prev => ({
            ...prev,
            type,
            parentId: '',
        }));
    };

    const handleEdit = (location) => {
        setEditingId(location.id);
        setFormData({
            name: location.name,
            type: location.type,
            parentId: location.parentId || '',
            description: location.description || '',
        });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!formData.name.trim()) return;

        const expectedParentType = PARENT_TYPE_BY_TYPE[formData.type];
        const parentId = expectedParentType ? Number(formData.parentId) : null;

        if (expectedParentType && !parentId) return;

        if (editingId) {
            updateLocation(editingId, {
                name: formData.name.trim(),
                type: formData.type,
                parentId,
                description: formData.description.trim(),
            });
            resetForm();
        } else {
            const result = await createLocation({
                name: formData.name.trim(),
                type: formData.type,
                parentId,
                description: formData.description.trim(),
            });

            if (result.success) {
                resetForm();
            }
        }
    };

    const handleToggleActive = (locationId) => {
        toggleLocationActive(locationId);
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
        }
    };

    const LocationNode = ({ node, level = 0 }) => (
        <div className="flex flex-col">
            <div className={`flex items-center justify-between gap-3 py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-900/30 rounded-lg group transition border border-transparent hover:border-slate-100 dark:hover:border-slate-800 ${level > 0 ? 'ml-6 border-l-slate-200 dark:border-l-slate-800' : ''} ${node.isActive === false ? 'bg-slate-100/60 dark:bg-slate-900/60 opacity-70' : ''}`}>
                <div className="min-w-0 flex items-center space-x-2">
                    <div className="text-slate-300 dark:text-slate-600 shrink-0">
                        {node.children.length > 0 ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`truncate text-sm ${level === 0 ? 'font-semibold text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                                {node.name}
                            </span>
                            {node.isActive === false && (
                                <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[9px] font-bold uppercase tracking-wide">
                                    {t('locationManager.hiddenBadge')}
                                </span>
                            )}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                            {t(`locationManager.types.${node.type}`)}
                        </div>
                        {node.description && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                {node.description}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                        onClick={() => handleEdit(node)}
                        className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 px-2 py-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded"
                    >
                        {t('locationManager.edit')}
                    </button>
                    <button
                        onClick={() => handleToggleActive(node.id)}
                        className={`text-[10px] uppercase font-bold px-2 py-1 rounded transition ${node.isActive === false ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30' : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'}`}
                    >
                        {node.isActive === false ? t('locationManager.restore') : t('locationManager.hide')}
                    </button>
                    {node.type === 'room' && (
                        <button
                            onClick={() => openDeleteModal(node)}
                            className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 px-2 py-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded"
                        >
                            {t('locationManager.delete')}
                        </button>
                    )}
                </div>
            </div>

            {node.children.length > 0 && (
                <div className="border-l border-slate-100 dark:border-slate-800/60 ml-[21px] mt-1 space-y-1">
                    {node.children.map(child => (
                        <LocationNode key={child.id} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                <div className="lg:col-span-1">
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                                {editingId ? t('locationManager.editTitle') : t('locationManager.addTitle')}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {t('locationManager.formDesc')}
                            </p>
                        </div>
                        {editingId && (
                            <button
                                type="button"
                                onClick={resetForm}
                                disabled={isLoading}
                                className="text-[10px] uppercase font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                            >
                                {t('locationManager.clear')}
                            </button>
                        )}
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
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-300 transition appearance-none"
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
                                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-300 transition appearance-none"
                                >
                                    <option value="">{t('locationManager.selectParent')}</option>
                                    {availableParents.map(parent => (
                                        <option key={parent.id} value={parent.id}>{parent.name}</option>
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
                            {isLoading ? t('locationManager.saving') : editingId ? t('locationManager.saveChanges') : t('locationManager.addBtn')}
                        </button>
                    </form>
                </div>
            </div>

                <div className="lg:col-span-2">
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5 h-full">
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('locationManager.treeTitle')}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('locationManager.desc')}</p>
                        </div>
                    </div>

                    <div className="bg-slate-50/50 dark:bg-slate-900/20 rounded-lg border border-slate-100 dark:border-slate-800/60 p-4">
                        {isLoading && locationTree.length === 0 ? (
                            <div className="text-center py-8 text-sm text-slate-400">{t('locationManager.loading')}</div>
                        ) : locationTree.length > 0 ? (
                            <div className="space-y-1">
                                {locationTree.map(rootNode => (
                                    <LocationNode key={rootNode.id} node={rootNode} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-sm text-slate-400">{t('locationManager.emptyTree')}</div>
                        )}
                    </div>
                </div>
                </div>
            </div>

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
                                <option key={room.id} value={room.id}>{room.name}</option>
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
