import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const LEVEL_LABELS = ['building', 'room', 'cabinet', 'shelf'];

function findNodePath(tree, targetId, path = []) {
    for (const node of tree) {
        const nextPath = [...path, node];
        if (Number(node.id) === Number(targetId)) return nextPath;
        if (node.children?.length) {
            const found = findNodePath(node.children, targetId, nextPath);
            if (found) return found;
        }
    }
    return null;
}

function buildPathLabel(nodes) {
    return nodes.map((node) => node.name).join(' / ');
}

/**
 * Kaskadowy wybór lokalizacji: budynek → sala → szafa → półka.
 * Kolejny select pojawia się dopiero po wyborze poziomu wyżej.
 */
export default function LocationCascadePicker({
    tree,
    value,
    onChange,
    disabled = false,
    isLoading = false,
    labelPrefix = 'addAssetModal',
}) {
    const { t } = useTranslation();
    const [selectedPath, setSelectedPath] = useState([]);

    useEffect(() => {
        if (!value || !tree.length) {
            setSelectedPath([]);
            return;
        }
        const path = findNodePath(tree, value);
        setSelectedPath(path ?? []);
    }, [value, tree]);

    const visibleLevels = useMemo(() => {
        const levels = [{ nodes: tree, depth: 0 }];
        for (let i = 0; i < selectedPath.length; i += 1) {
            const children = selectedPath[i]?.children ?? [];
            if (children.length > 0) {
                levels.push({ nodes: children, depth: i + 1 });
            }
        }
        return levels;
    }, [tree, selectedPath]);

    const handleLevelChange = (depth, rawId, nodes) => {
        if (!rawId) {
            const nextPath = selectedPath.slice(0, depth);
            setSelectedPath(nextPath);
            if (nextPath.length === 0) {
                onChange({ locationId: '', locationPath: '' });
                return;
            }
            const last = nextPath[nextPath.length - 1];
            onChange({
                locationId: Number(last.id),
                locationPath: buildPathLabel(nextPath),
            });
            return;
        }

        const node = nodes.find((item) => String(item.id) === String(rawId));
        if (!node) return;

        const nextPath = [...selectedPath.slice(0, depth), node];
        setSelectedPath(nextPath);
        onChange({
            locationId: Number(node.id),
            locationPath: buildPathLabel(nextPath),
        });
    };

    const selectClassName =
        'w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed';

    if (isLoading) {
        return (
            <p className="text-xs text-slate-400 py-2">
                {t(`${labelPrefix}.locationsLoading`)}
            </p>
        );
    }

    if (!tree.length) {
        return (
            <p className="text-xs text-slate-400 py-2">
                {t(`${labelPrefix}.locationsEmpty`)}
            </p>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visibleLevels.map(({ nodes, depth }) => {
                const labelKey = LEVEL_LABELS[depth] ?? 'building';
                const selectedId = selectedPath[depth]?.id ?? '';
                const isRequired = depth === 0;

                return (
                    <div key={depth}>
                        <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">
                            {t(`${labelPrefix}.${labelKey}`)}
                            {isRequired ? ' *' : ''}
                        </label>
                        <select
                            value={selectedId}
                            onChange={(e) => handleLevelChange(depth, e.target.value, nodes)}
                            disabled={disabled}
                            required={isRequired}
                            className={selectClassName}
                        >
                            <option value="">{t(`${labelPrefix}.selectLocation`)}</option>
                            {nodes.map((node) => (
                                <option key={node.id} value={node.id}>
                                    {node.name}
                                </option>
                            ))}
                        </select>
                    </div>
                );
            })}
        </div>
    );
}
