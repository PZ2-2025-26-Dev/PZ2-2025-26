import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export type ParameterRow = {
    id: string;
    key: string;
    value: string;
};

export type ParameterBuildResult =
    | { success: true; parameters: Record<string, unknown> }
    | { success: false; error: string };

const formatStoredValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

const parseParameterValue = (raw: string, key: string): unknown | ParameterBuildResult => {
    const trimmed = raw.trim();
    if (trimmed === '') return '';

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            return JSON.parse(trimmed);
        } catch {
            return { success: false, error: key };
        }
    }

    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

    return trimmed;
};

export const parametersToRows = (parameters: Record<string, unknown> | null): ParameterRow[] => {
    if (!parameters) return [{ id: 'row-0', key: '', value: '' }];
    const entries = Object.entries(parameters);
    if (entries.length === 0) return [{ id: 'row-0', key: '', value: '' }];
    return entries.map(([key, value], index) => ({
        id: `row-${index}-${key}`,
        key,
        value: formatStoredValue(value),
    }));
};

export const buildParametersFromRows = (rows: ParameterRow[]): ParameterBuildResult => {
    const result: Record<string, unknown> = {};

    for (const row of rows) {
        const key = row.key.trim();
        if (!key) continue;

        const parsed = parseParameterValue(row.value, key);
        if (typeof parsed === 'object' && parsed !== null && 'success' in parsed) {
            return parsed;
        }
        result[key] = parsed;
    }

    return { success: true, parameters: result };
};

/** @deprecated Use buildParametersFromRows */
export const rowsToParameters = (rows: ParameterRow[]): Record<string, unknown> => {
    const built = buildParametersFromRows(rows);
    return built.success ? built.parameters : {};
};

const isComplexValue = (value: string) => value.includes('\n') || value.trim().startsWith('{') || value.trim().startsWith('[');

type ItemParametersEditorProps = {
    rows: ParameterRow[];
    onChange: (rows: ParameterRow[]) => void;
    error?: string | null;
};

export default function ItemParametersEditor({ rows, onChange, error }: ItemParametersEditorProps) {
    const { t } = useTranslation();

    const updateRow = (id: string, patch: Partial<Pick<ParameterRow, 'key' | 'value'>>) => {
        onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    };

    const addRow = () => {
        onChange([...rows, { id: `row-${Date.now()}`, key: '', value: '' }]);
    };

    const removeRow = (id: string) => {
        if (rows.length <= 1) {
            onChange([{ id: 'row-0', key: '', value: '' }]);
            return;
        }
        onChange(rows.filter((row) => row.id !== id));
    };

    return (
        <div className="space-y-3">
            <p className="text-xs text-slate-500">{t('itemDetailsModal.parameterValueHint')}</p>
            {rows.map((row) => (
                <div key={row.id} className="flex items-start gap-2">
                    <Input
                        value={row.key}
                        onChange={(event) => updateRow(row.id, { key: event.target.value })}
                        placeholder={t('itemDetailsModal.parameterKeyPlaceholder')}
                        className="flex-1"
                    />
                    {isComplexValue(row.value) ? (
                        <Textarea
                            value={row.value}
                            onChange={(event) => updateRow(row.id, { value: event.target.value })}
                            placeholder={t('itemDetailsModal.parameterComplexPlaceholder')}
                            className="min-h-[72px] flex-[1.5] font-mono text-xs"
                            spellCheck={false}
                        />
                    ) : (
                        <Input
                            value={row.value}
                            onChange={(event) => updateRow(row.id, { value: event.target.value })}
                            placeholder={t('itemDetailsModal.parameterValuePlaceholder')}
                            className="flex-[1.5]"
                        />
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeRow(row.id)}
                        aria-label={t('itemDetailsModal.removeParameter')}
                    >
                        <Trash2 className="size-4 text-red-500" />
                    </Button>
                </div>
            ))}
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="size-4" />
                {t('itemDetailsModal.addParameter')}
            </Button>
        </div>
    );
}
