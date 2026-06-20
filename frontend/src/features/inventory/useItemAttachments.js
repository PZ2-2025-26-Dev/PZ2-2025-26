import { useCallback, useEffect, useState } from 'react';

import { useInventory } from './useInventory';

/**
 * @param {number|null|undefined} itemId
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

    const hasApiItemId = Number.isInteger(itemId) && itemId > 0;

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
