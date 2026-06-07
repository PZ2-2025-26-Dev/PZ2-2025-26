import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocationTree } from './useLocationTree';

const STATUS_OPTIONS = [
    { value: 'available', labelKey: 'statusAvailable' },
    { value: 'loaned', labelKey: 'statusLoaned' },
];

const TYPE_LABEL_KEYS = {
    building: 'typeBuilding',
    room: 'typeRoom',
    cabinet: 'typeCabinet',
    shelf: 'typeShelf',
};

const STATUS_BADGE_CLASSES = {
    available: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
    loaned: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
    pending_approval: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
    reserved: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
    broken: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400',
};

function LocationNode({
    node,
    level,
    expandedIds,
    selectedId,
    itemsByLocation,
    isLocationLoading,
    onToggleExpand,
    onSelect,
    t,
}) {
    const hasChildren = node.children?.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedId === node.id;
    const items = itemsByLocation[node.id] ?? [];
    const isLoadingItems = isLocationLoading(node.id);

    return (
        <div className="flex flex-col">
            <div
                className={`flex items-center gap-2 py-2 px-3 rounded-lg transition border ${
                    isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-900/30 hover:border-slate-100 dark:hover:border-slate-800'
                }`}
                style={{ marginLeft: level > 0 ? `${level * 1.25}rem` : 0 }}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={() => onToggleExpand(node.id)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5"
                        aria-label={isExpanded ? t('locationTree.collapse') : t('locationTree.expand')}
                    >
                        <svg
                            className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                ) : (
                    <span className="w-4" />
                )}

                <button
                    type="button"
                    onClick={() => onSelect(node.id)}
                    className="flex-1 text-left min-w-0"
                >
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mr-2">
                        {t(`locationTree.${TYPE_LABEL_KEYS[node.type] ?? 'typeBuilding'}`)}
                    </span>
                    <span className={`text-sm ${level === 0 ? 'font-semibold text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                        {node.name}
                    </span>
                </button>
            </div>

            {isSelected && (
                <div
                    className="mt-1 mb-2 space-y-1 border-l-2 border-emerald-200 dark:border-emerald-900/60 pl-3"
                    style={{ marginLeft: `${(level + 1) * 1.25}rem` }}
                >
                    {isLoadingItems ? (
                        <p className="text-xs text-slate-400 py-2 animate-pulse">{t('locationTree.loading')}</p>
                    ) : items.length > 0 ? (
                        items.map((item) => (
                            <div
                                key={item.id}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2 px-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg text-xs"
                            >
                                <div className="min-w-0">
                                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{item.name}</div>
                                    <div className="text-[10px] text-slate-400 truncate">
                                        {item.category?.name}
                                        {item.legacy_id ? ` · ${item.legacy_id}` : ''}
                                    </div>
                                </div>
                                <span
                                    className={`inline-flex self-start sm:self-center px-2 py-0.5 rounded-full font-medium text-[10px] ${
                                        STATUS_BADGE_CLASSES[item.status] ?? 'bg-slate-100 text-slate-600'
                                    }`}
                                >
                                    {t(`locationTree.status.${item.status}`, item.status)}
                                </span>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-slate-400 py-2">{t('locationTree.noItems')}</p>
                    )}
                </div>
            )}

            {hasChildren && isExpanded && (
                <div className="space-y-0.5">
                    {node.children.map((child) => (
                        <LocationNode
                            key={child.id}
                            node={child}
                            level={level + 1}
                            expandedIds={expandedIds}
                            selectedId={selectedId}
                            itemsByLocation={itemsByLocation}
                            isLocationLoading={isLocationLoading}
                            onToggleExpand={onToggleExpand}
                            onSelect={onSelect}
                            t={t}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function LocationTreeView() {
    const { t } = useTranslation();
    const {
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
    } = useLocationTree();

    const [expandedIds, setExpandedIds] = useState(new Set());
    const [selectedId, setSelectedId] = useState(null);

    const handleToggleExpand = useCallback((id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleSelect = useCallback((id) => {
        setSelectedId(id);
        setExpandedIds((prev) => new Set(prev).add(id));
        selectLocation(id);
    }, [selectLocation]);

    return (
        <div className="space-y-4 animate-fadeIn">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm space-y-4">
                <div>
                    <h2 className="font-bold text-sm text-slate-900 dark:text-white">{t('locationTree.title')}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('locationTree.desc')}</p>
                </div>

                <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('locationTree.searchPlaceholder')}
                        className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 transition text-slate-800 dark:text-slate-100"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-900">
                    <span className="text-xs text-slate-400 font-medium">{t('locationTree.filterStatus')}:</span>
                    {STATUS_OPTIONS.map(({ value, labelKey }) => {
                        const isActive = statusFilters.includes(value);
                        return (
                            <label
                                key={value}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer border transition ${
                                    isActive
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 hover:border-emerald-300'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={isActive}
                                    onChange={() => toggleStatusFilter(value)}
                                />
                                {t(`locationTree.${labelKey}`)}
                            </label>
                        );
                    })}
                </div>
            </div>

            {error && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-400">
                    <span>{error}</span>
                    <button type="button" onClick={clearError} className="font-bold hover:underline">
                        {t('locationTree.dismissError')}
                    </button>
                </div>
            )}

            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4">
                {isLoadingTree ? (
                    <p className="text-center py-8 text-sm text-slate-400 animate-pulse">{t('locationTree.loading')}</p>
                ) : tree.length > 0 ? (
                    <div className="space-y-1">
                        {tree.map((node) => (
                            <LocationNode
                                key={node.id}
                                node={node}
                                level={0}
                                expandedIds={expandedIds}
                                selectedId={selectedId}
                                itemsByLocation={itemsByLocation}
                                isLocationLoading={isLocationLoading}
                                onToggleExpand={handleToggleExpand}
                                onSelect={handleSelect}
                                t={t}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-center py-8 text-sm text-slate-400">{t('locationTree.emptyTree')}</p>
                )}
            </div>
        </div>
    );
}
