import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Universal loading indicator. A "dumb" component — fully controlled by props.
 *
 * @param {'spinner' | 'skeleton-table' | 'overlay'} variant
 * @param {string} [label] - Optional text label (e.g., "Loading...")
 * @param {number} [rows=5] - Number of skeleton rows (only for variant="skeleton-table")
 */

export default function Loader({ variant = 'spinner', label, rows = 5 }) {
    const { t } = useTranslation();
    const text = label ?? t('common.loading');

    if (variant === 'skeleton-table') {
        return (
            <div className="animate-pulse space-y-2 px-4 py-3">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex space-x-4">
                        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-24" />
                        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded flex-1" />
                        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-20" />
                        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-16" />
                        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-20" />
                    </div>
                ))}
            </div>
        );
    }

    if (variant === 'overlay') {
        return (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm rounded-xl">
                <div className="flex flex-col items-center space-y-2">
                    <svg className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{text}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center space-x-2 py-8 justify-center">
            <svg className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{text}</span>
        </div>
    );
}