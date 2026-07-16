type ItemParametersDisplayProps = {
    parameters: Record<string, unknown>;
};

const isNestedValue = (value: unknown): value is Record<string, unknown> | unknown[] =>
    typeof value === 'object' && value !== null;

const formatPrimitive = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
};

function NestedParameterValue({ value, depth }: { value: unknown; depth: number }) {
    const paddingClass = depth === 0 ? 'pl-4' : 'pl-4 border-l border-slate-200 dark:border-slate-700 ml-2';

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return <p className={`text-slate-400 ${paddingClass}`}>—</p>;
        }

        return (
            <div className={`space-y-1 ${paddingClass}`}>
                {value.map((entry, index) => (
                    <div key={index}>
                        {isNestedValue(entry) ? (
                            <NestedParameterValue value={entry} depth={depth + 1} />
                        ) : (
                            <p className="font-medium text-slate-800 dark:text-slate-200">{formatPrimitive(entry)}</p>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    if (isNestedValue(value)) {
        const entries = Object.entries(value);
        if (entries.length === 0) {
            return <p className={`text-slate-400 ${paddingClass}`}>—</p>;
        }

        return (
            <div className={`space-y-2 ${paddingClass}`}>
                {entries.map(([nestedKey, nestedValue]) => (
                    <div key={nestedKey}>
                        <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-slate-500">{nestedKey}</span>
                            {!isNestedValue(nestedValue) && (
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                    {formatPrimitive(nestedValue)}
                                </span>
                            )}
                        </div>
                        {isNestedValue(nestedValue) && (
                            <NestedParameterValue value={nestedValue} depth={depth + 1} />
                        )}
                    </div>
                ))}
            </div>
        );
    }

    return <span className="font-medium text-slate-800 dark:text-slate-200">{formatPrimitive(value)}</span>;
}

export default function ItemParametersDisplay({ parameters }: ItemParametersDisplayProps) {
    const entries = Object.entries(parameters);

    if (entries.length === 0) {
        return null;
    }

    return (
        <div className="space-y-3">
            {entries.map(([key, value]) => (
                <div key={key} className="space-y-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="text-slate-500">{key}</span>
                        {!isNestedValue(value) && (
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                                {formatPrimitive(value)}
                            </span>
                        )}
                    </div>
                    {isNestedValue(value) && <NestedParameterValue value={value} depth={0} />}
                </div>
            ))}
        </div>
    );
}
