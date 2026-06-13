import React, { useState, useCallback, useEffect } from 'react';
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

function normalizeId(id) {
    return Number(id);
}

function filterItemsForDisplay(items, searchQuery) {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter(
        (item) =>
            item.name.toLowerCase().includes(query) ||
            (item.legacy_id && item.legacy_id.toLowerCase().includes(query)) ||
            (item.location?.path && item.location.path.toLowerCase().includes(query))
    );
}

function collectAllNodeIds(nodes) {
    const ids = [];
    for (const node of nodes) {
        ids.push(normalizeId(node.id));
        if (node.children?.length) {
            ids.push(...collectAllNodeIds(node.children));
        }
    }
    return ids;
}

function findAncestorIds(nodes, targetId, ancestors = []) {
    for (const node of nodes) {
        const id = normalizeId(node.id);
        if (id === normalizeId(targetId)) return ancestors;
        if (node.children?.length) {
            const found = findAncestorIds(node.children, targetId, [...ancestors, id]);
            if (found) return found;
        }
    }
    return null;
}

function ItemList({ items, isLoading, searchQuery, t }) {
    const visibleItems = filterItemsForDisplay(items, searchQuery);

    if (isLoading) {
        return <p className="text-[10px] text-slate-400 py-1.5 pl-1 animate-pulse">{t('locationTree.loading')}</p>;
    }

    if (visibleItems.length === 0) {
        return <p className="text-[10px] text-slate-400 py-1.5 pl-1">{t('locationTree.noItems')}</p>;
    }

    return (
        <ul className="mt-1 mb-2 space-y-1">
            {visibleItems.map((item) => (
                <li
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-1.5 px-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-lg text-[11px]"
                >
                    <div className="min-w-0">
                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                            {item.location?.path}
                            {item.category?.name ? ` · ${item.category.name}` : ''}
                        </div>
                    </div>
                    <span
                        className={`inline-flex self-start sm:self-center px-2 py-0.5 rounded-full font-medium text-[10px] shrink-0 ${
                            STATUS_BADGE_CLASSES[item.status] ?? 'bg-slate-100 text-slate-600'
                        }`}
                    >
                        {t(`locationTree.status.${item.status}`, item.status)}
                    </span>
                </li>
            ))}
        </ul>
    );
}

function LocationNode({
    node,
    depth,
    expandedIds,
    selectedId,
    itemsByLocation,
    isLocationLoading,
    onSelect,
    onToggleExpand,
    searchQuery,
    t,
}) {
    const nodeId = normalizeId(node.id);
    const hasChildren = node.children?.length > 0;
    const isExpanded = expandedIds.has(nodeId);
    const isSelected = selectedId === nodeId;
    const typeLabelKey = TYPE_LABEL_KEYS[node.type] ?? 'typeBuilding';
    const items = itemsByLocation[nodeId] ?? [];
    const isLoadingItems = isLocationLoading(nodeId);

    return (
        <div className="select-none">
            <div
                className="flex items-center gap-1 py-1 rounded-lg group"
                style={{ paddingLeft: `${depth * 1.25}rem` }}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={() => onToggleExpand(nodeId)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? t('locationTree.collapse') : t('locationTree.expand')}
                        className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 shrink-0"
                    >
                        <svg
                            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path d="M6 4l8 6-8 6V4z" />
                        </svg>
                    </button>
                ) : (
                    <span className="w-5 shrink-0" />
                )}

                <button
                    type="button"
                    onClick={() => onSelect(nodeId)}
                    className={`flex-1 flex items-center gap-2 text-left px-2 py-1 rounded-lg text-xs transition border ${
                        isSelected
                            ? 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 text-emerald-900 dark:text-emerald-100 font-semibold'
                            : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/60'
                    }`}
                >
                    <span className="text-[9px] uppercase tracking-wide font-bold text-slate-400 dark:text-slate-500 shrink-0">
                        {t(`locationTree.${typeLabelKey}`)}
                    </span>
                    <span className="truncate">{node.name}</span>
                </button>
            </div>

            {isSelected && (
                <div style={{ paddingLeft: `${depth * 1.25 + 1.75}rem` }}>
                    <ItemList items={items} isLoading={isLoadingItems} searchQuery={searchQuery} t={t} />
                </div>
            )}

            {hasChildren && isExpanded && (
                <div>
                    {node.children.map((child) => (
                        <LocationNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            expandedIds={expandedIds}
                            selectedId={selectedId}
                            itemsByLocation={itemsByLocation}
                            isLocationLoading={isLocationLoading}
                            onSelect={onSelect}
                            onToggleExpand={onToggleExpand}
                            searchQuery={searchQuery}
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
        debouncedSearch,
    } = useLocationTree();

    const [expandedIds, setExpandedIds] = useState(new Set());
    const [selectedId, setSelectedId] = useState(null);

    useEffect(() => {
        if (!debouncedSearch || tree.length === 0) return;
        setExpandedIds(new Set(collectAllNodeIds(tree)));
    }, [debouncedSearch, tree]);

    useEffect(() => {
        if (selectedId === null || tree.length === 0) return;
        const ancestors = findAncestorIds(tree, selectedId);
        if (ancestors === null) {
            setSelectedId(null);
            return;
        }
        setExpandedIds((prev) => {
            const next = new Set(prev);
            ancestors.forEach((id) => next.add(id));
            return next;
        });
    }, [tree, selectedId]);

    const handleToggleExpand = useCallback((id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleSelect = useCallback((id) => {
        setSelectedId((current) => {
            if (current === id) return null;
            selectLocation(id);
            return id;
        });
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
                    <div className="space-y-0.5">
                        {tree.map((node) => (
                            <LocationNode
                                key={node.id}
                                node={node}
                                depth={0}
                                expandedIds={expandedIds}
                                selectedId={selectedId}
                                itemsByLocation={itemsByLocation}
                                isLocationLoading={isLocationLoading}
                                onSelect={handleSelect}
                                onToggleExpand={handleToggleExpand}
                                searchQuery={debouncedSearch}
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
