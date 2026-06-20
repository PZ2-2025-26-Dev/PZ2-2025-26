import { useCallback, useEffect, useState } from 'react';

import { useInventory } from './useInventory';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {string|number|null|undefined} itemId
 */
const isValidItemId = (itemId) => {
    if (itemId === null || itemId === undefined || itemId === '') return false;
    if (typeof itemId === 'number') return Number.isInteger(itemId) && itemId > 0;
    if (typeof itemId === 'string') {
        if (UUID_PATTERN.test(itemId)) return true;
        const parsed = Number(itemId);
        return Number.isInteger(parsed) && parsed > 0;
    }
    return false;
};

/**
 * @param {string|number|null|undefined} itemId
 * @param {boolean} isOpen
 */
export const useItemAttachments = (itemId, isOpen) => {
    const {
        listAttachments,
        uploadAttachments,
        downloadAttachment,
        deleteAttachment,
    } = useInventory();

    const [attachments, setAttachments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);

    const hasApiItemId = isValidItemId(itemId);

    useEffect(() => {
        if (!isOpen || !hasApiItemId) {
            setAttachments([]);
            setError(null);
            return;
        }

        setIsLoading(true);
        listAttachments(itemId).then((result) => {
            if (result.success) {
                setAttachments(result.data ?? []);
            } else {
                setError(result.error ?? null);
            }
            setIsLoading(false);
        });
    }, [isOpen, hasApiItemId, itemId, listAttachments]);

    const handleUpload = useCallback(async (files) => {
        if (!hasApiItemId) return;

        setIsUploading(true);
        setError(null);
        const result = await uploadAttachments(itemId, files);
        if (result.success) {
            setAttachments(result.data ?? []);
        } else {
            setError(result.error ?? null);
        }
        setIsUploading(false);
    }, [hasApiItemId, itemId, uploadAttachments]);

    const handleDownload = useCallback(async (attachment) => {
        if (!hasApiItemId) return;

        const result = await downloadAttachment(itemId, attachment.id, attachment.original_filename);
        if (!result.success) {
            setError(result.error ?? null);
        }
    }, [hasApiItemId, itemId, downloadAttachment]);

    const handleDelete = useCallback(async (attachmentId) => {
        if (!hasApiItemId) return;

        const result = await deleteAttachment(itemId, attachmentId);
        if (result.success) {
            setAttachments((current) => current.filter((entry) => entry.id !== attachmentId));
        } else {
            setError(result.error ?? null);
        }
    }, [hasApiItemId, itemId, deleteAttachment]);

    return {
        attachments,
        isLoading,
        isUploading,
        error,
        hasApiItemId,
        handleUpload,
        handleDownload,
        handleDelete,
    };
};
