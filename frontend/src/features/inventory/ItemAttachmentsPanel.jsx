import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * @param {Object} props
 * @param {Array} props.attachments
 * @param {boolean} props.isLoading
 * @param {boolean} props.canUpload
 * @param {boolean} props.isUploading
 * @param {Function} props.onUpload
 * @param {Function} props.onDownload
 * @param {Function} props.onDelete
 * @param {string|null} [props.error]
 */
export default function ItemAttachmentsPanel({
    attachments,
    isLoading,
    canUpload,
    isUploading,
    error,
    onUpload,
    onDownload,
    onDelete,
}) {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);

    const formatDate = (value) => {
        if (!value) return '-';
        return new Date(value).toLocaleString();
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleFileChange = (event) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;
        onUpload(files);
        event.target.value = '';
    };

    return (
        <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-slate-500 text-xs font-semibold">
                    {t('itemDetailsModal.attachments')}
                </span>

                {canUpload && (
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleFileChange}
                            disabled={isUploading}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium dark:text-emerald-400 dark:hover:text-emerald-300 disabled:opacity-50"
                        >
                            {isUploading ? t('common.loading') : t('itemDetailsModal.uploadFiles')}
                        </button>
                    </>
                )}
            </div>

            {error && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mb-2">{error}</p>
            )}

            {isLoading ? (
                <p className="text-xs text-slate-500">{t('common.loading')}</p>
            ) : attachments.length === 0 ? (
                <p className="text-xs text-slate-500">{t('itemDetailsModal.noAttachments')}</p>
            ) : (
                <ul className="space-y-2">
                    {attachments.map((attachment) => (
                        <li
                            key={attachment.id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg"
                        >
                            <div className="min-w-0">
                                <button
                                    type="button"
                                    onClick={() => onDownload(attachment)}
                                    className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 truncate text-left"
                                >
                                    {attachment.original_filename}
                                </button>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {t('itemDetailsModal.attachmentMeta', {
                                        author: attachment.uploaded_by?.name || '-',
                                        date: formatDate(attachment.uploaded_at),
                                        size: formatSize(attachment.size_bytes),
                                    })}
                                </div>
                            </div>

                            {canUpload && (
                                <button
                                    type="button"
                                    onClick={() => onDelete(attachment.id)}
                                    className="self-start sm:self-center px-2 py-1 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400"
                                >
                                    {t('itemDetailsModal.deleteAttachment')}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
