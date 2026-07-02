import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, FileArchive, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { InventoryItem } from '@/types';

export type BatchLabelFormat = 'pdf' | 'zip';

export type BatchLabelOptions = {
    fields: string[];
    width_mm: number;
    height_mm: number;
};

type ExportResult = {
    success: boolean;
    error?: string;
};

type BatchLabelExportDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: InventoryItem[];
    onExport: (
        itemIds: string[],
        format: BatchLabelFormat,
        options: BatchLabelOptions,
    ) => Promise<ExportResult>;
    onCompleted: () => void;
};

type FieldOption = {
    key: string;
    label: string;
};

const DEFAULT_FIELDS = ['name', 'category', 'location'];
const BASE_FIELDS = ['name', 'description', 'status', 'category', 'location', 'owner', 'oldID'];

export function flattenParameterFields(
    parameters: Record<string, unknown> | null | undefined,
    prefix = '',
): string[] {
    if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) return [];

    return Object.entries(parameters).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return flattenParameterFields(value as Record<string, unknown>, path);
        }

        return [`parameters.${path}`];
    });
}

export function getCommonParameterFields(items: InventoryItem[]): string[] {
    if (items.length === 0) return [];

    const [firstItem, ...remainingItems] = items;
    const commonFields = new Set(flattenParameterFields(firstItem.parameters));

    for (const item of remainingItems) {
        const itemFields = new Set(flattenParameterFields(item.parameters));
        for (const field of commonFields) {
            if (!itemFields.has(field)) commonFields.delete(field);
        }
    }

    return [...commonFields].sort((first, second) => first.localeCompare(second));
}

export default function BatchLabelExportDialog({
    open,
    onOpenChange,
    items,
    onExport,
    onCompleted,
}: BatchLabelExportDialogProps) {
    const { t } = useTranslation();
    const [fields, setFields] = useState<string[]>(DEFAULT_FIELDS);
    const [widthMm, setWidthMm] = useState(76.2);
    const [heightMm, setHeightMm] = useState(30.48);
    const [format, setFormat] = useState<BatchLabelFormat>('pdf');
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fieldOptions = useMemo<FieldOption[]>(() => {
        const baseOptions = BASE_FIELDS.map((field) => ({
            key: field,
            label: t(`itemDetailsModal.labelFields.${field}`, { defaultValue: field }),
        }));
        const parameterOptions = getCommonParameterFields(items).map((field) => ({
            key: field,
            label: field.replace(/^parameters\./, ''),
        }));

        return [...baseOptions, ...parameterOptions];
    }, [items, t]);

    useEffect(() => {
        if (!open) return;
        setFields(DEFAULT_FIELDS);
        setWidthMm(76.2);
        setHeightMm(30.48);
        setFormat('pdf');
        setError(null);
    }, [open]);

    const toggleField = (field: string) => {
        setFields((current) => (
            current.includes(field)
                ? current.filter((entry) => entry !== field)
                : [...current, field]
        ));
    };

    const dimensionsAreValid = (
        widthMm >= 20
        && widthMm <= 200
        && heightMm >= 10
        && heightMm <= 150
    );

    const handleExport = async () => {
        if (!dimensionsAreValid || items.length === 0 || items.length > 100) return;

        setIsExporting(true);
        setError(null);
        const result = await onExport(
            items.map((item) => item.id),
            format,
            {
                fields,
                width_mm: widthMm,
                height_mm: heightMm,
            },
        );
        setIsExporting(false);

        if (!result.success) {
            setError(result.error ?? t('batchLabels.exportError'));
            return;
        }

        onOpenChange(false);
        onCompleted();
    };

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !isExporting && onOpenChange(nextOpen)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('batchLabels.title')}</DialogTitle>
                    <DialogDescription>
                        {t('batchLabels.description', { count: items.length })}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="size-4" />
                            <AlertTitle>{t('batchLabels.exportErrorTitle')}</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="batch-label-format">{t('batchLabels.format')}</Label>
                        <Select
                            value={format}
                            onValueChange={(value) => setFormat(value as BatchLabelFormat)}
                            disabled={isExporting}
                        >
                            <SelectTrigger id="batch-label-format">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pdf">
                                    <span className="flex items-center gap-2">
                                        <FileText className="size-4" />
                                        {t('batchLabels.formatPdf')}
                                    </span>
                                </SelectItem>
                                <SelectItem value="zip">
                                    <span className="flex items-center gap-2">
                                        <FileArchive className="size-4" />
                                        {t('batchLabels.formatZip')}
                                    </span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="batch-label-width">{t('batchLabels.width')}</Label>
                            <Input
                                id="batch-label-width"
                                type="number"
                                min={20}
                                max={200}
                                step={0.1}
                                value={widthMm}
                                onChange={(event) => setWidthMm(Number(event.target.value))}
                                disabled={isExporting}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="batch-label-height">{t('batchLabels.height')}</Label>
                            <Input
                                id="batch-label-height"
                                type="number"
                                min={10}
                                max={150}
                                step={0.1}
                                value={heightMm}
                                onChange={(event) => setHeightMm(Number(event.target.value))}
                                disabled={isExporting}
                            />
                        </div>
                    </div>

                    {!dimensionsAreValid && (
                        <p className="text-sm text-destructive">{t('batchLabels.invalidDimensions')}</p>
                    )}

                    <div className="space-y-3">
                        <div>
                            <Label>{t('batchLabels.fields')}</Label>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {t('batchLabels.fieldsHint')}
                            </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {fieldOptions.map((field) => (
                                <label
                                    key={field.key}
                                    className="flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm"
                                >
                                    <input
                                        type="checkbox"
                                        checked={fields.includes(field.key)}
                                        onChange={() => toggleField(field.key)}
                                        disabled={isExporting}
                                        className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className="min-w-0 truncate">{field.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="secondary"
                        onClick={() => onOpenChange(false)}
                        disabled={isExporting}
                    >
                        {t('batchLabels.cancel')}
                    </Button>
                    <Button
                        onClick={() => void handleExport()}
                        disabled={isExporting || !dimensionsAreValid || items.length === 0 || items.length > 100}
                    >
                        <Download className="size-4" />
                        {isExporting ? t('batchLabels.exporting') : t('batchLabels.download')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
