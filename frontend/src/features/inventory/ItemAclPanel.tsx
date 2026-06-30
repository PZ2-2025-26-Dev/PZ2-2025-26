import { useEffect, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AclUserPicker from './AclUserPicker';
import { ITEM_ACL_PERMISSIONS, useItemAcl } from './useItemAcl';

type ItemAclPanelProps = {
    itemId: string | number;
    ownerId: number;
    isOpen: boolean;
};

type AclEntry = {
    id: number;
    userId: number;
    permission: string;
    user: { id: number; name: string };
};

export default function ItemAclPanel({ itemId, ownerId, isOpen }: ItemAclPanelProps) {
    const { t } = useTranslation();
    const { listAcl, grantAcl, revokeAcl, isLoading, error, clearError } = useItemAcl();

    const [entries, setEntries] = useState<AclEntry[]>([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedPermission, setSelectedPermission] = useState(ITEM_ACL_PERMISSIONS[1]);
    const [actionError, setActionError] = useState<string | null>(null);

    const loadEntries = async () => {
        const result = await listAcl(itemId);
        if (result.success) setEntries(result.entries);
    };

    useEffect(() => {
        if (!isOpen || !itemId) return;
        clearError();
        setActionError(null);
        setSelectedUserId('');
        loadEntries();
    }, [isOpen, itemId, clearError]);

    const handleGrant = async () => {
        setActionError(null);
        const userId = Number(selectedUserId);
        if (!userId || Number.isNaN(userId)) {
            setActionError(t('itemAcl.userRequired'));
            return;
        }

        const result = await grantAcl(itemId, userId, selectedPermission);
        if (!result.success) {
            setActionError(result.error ?? t('itemAcl.grantFailed'));
            return;
        }

        setSelectedUserId('');
        await loadEntries();
    };

    const handleRevoke = async (aclId: number) => {
        setActionError(null);
        const result = await revokeAcl(itemId, aclId);
        if (!result.success) {
            setActionError(result.error ?? t('itemAcl.revokeFailed'));
            return;
        }
        await loadEntries();
    };

    return (
        <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <UserPlus className="size-5" />
                    <CardTitle className="text-base">{t('itemAcl.title')}</CardTitle>
                </div>
                <CardDescription>{t('itemAcl.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {(error || actionError) && (
                    <p className="text-xs text-red-600 dark:text-red-400">{actionError ?? error}</p>
                )}

                {entries.length > 0 ? (
                    <div className="space-y-2">
                        {entries.map((entry) => (
                            <div
                                key={entry.id}
                                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-medium">{entry.user.name}</p>
                                    <p className="text-xs text-slate-500">
                                        {t(`itemAcl.permissions.${entry.permission}`)}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    disabled={isLoading}
                                    onClick={() => handleRevoke(entry.id)}
                                    aria-label={t('itemAcl.revoke')}
                                >
                                    <Trash2 className="size-4 text-red-500" />
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-slate-500">{t('itemAcl.empty')}</p>
                )}

                <div className="space-y-3 rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t('itemAcl.grantTitle')}
                    </p>

                    <AclUserPicker
                        ownerId={ownerId}
                        value={selectedUserId}
                        onChange={setSelectedUserId}
                        disabled={isLoading}
                    />

                    <div className="space-y-2">
                        <Label htmlFor="acl-permission">{t('itemAcl.permissionLabel')}</Label>
                        <Select modal={false} value={selectedPermission} onValueChange={setSelectedPermission}>
                            <SelectTrigger id="acl-permission">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ITEM_ACL_PERMISSIONS.map((permission) => (
                                    <SelectItem key={permission} value={permission}>
                                        {t(`itemAcl.permissions.${permission}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button className="w-full" disabled={isLoading} onClick={handleGrant}>
                        {t('itemAcl.grantButton')}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
