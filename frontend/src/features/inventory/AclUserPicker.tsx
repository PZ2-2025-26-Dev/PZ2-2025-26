import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROLES } from '../auth/permissions';
import { useGuests } from '../guests/useGuests';

const PAGE_SIZE = 10;

type SelectableUser = {
    id: number;
    firstName: string;
    lastName: string;
};

type AclUserPickerProps = {
    ownerId: number;
    value: string;
    onChange: (userId: string) => void;
    disabled?: boolean;
};

const getUserLabel = (user: SelectableUser) =>
    `${user.firstName} ${user.lastName}`.trim() || `#${user.id}`;

export default function AclUserPicker({ ownerId, value, onChange, disabled }: AclUserPickerProps) {
    const { t } = useTranslation();
    const { browseUsers } = useGuests();

    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [users, setUsers] = useState<SelectableUser[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    const loadUsers = useCallback(async () => {
        setIsLoading(true);
        const result = await browseUsers({
            page,
            limit: PAGE_SIZE,
            search: searchQuery || undefined,
            role: ROLES.USER,
        });

        if (result.success) {
            setUsers(
                result.entries
                    .filter((entry) => entry.role === ROLES.USER && entry.id !== ownerId)
                    .map((entry) => ({
                        id: entry.id,
                        firstName: entry.firstName,
                        lastName: entry.lastName,
                    })),
            );
            setTotalCount(result.totalCount);
        } else {
            setUsers([]);
            setTotalCount(0);
        }
        setIsLoading(false);
    }, [browseUsers, ownerId, page, searchQuery]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    useEffect(() => {
        setPage(1);
    }, [searchQuery, ownerId]);

    const handleSearch = () => {
        setSearchQuery(searchInput.trim());
    };

    return (
        <div className="space-y-2">
            <Label htmlFor="acl-user-search">{t('itemAcl.userLabel')}</Label>
            <div className="flex gap-2">
                <Input
                    id="acl-user-search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                    placeholder={t('itemAcl.userSearchPlaceholder')}
                    disabled={disabled}
                />
                <Button type="button" variant="outline" size="icon" onClick={handleSearch} disabled={disabled}>
                    <Search className="size-4" />
                </Button>
            </div>

            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
                {isLoading ? (
                    <p className="p-3 text-xs text-slate-500">{t('common.loading')}</p>
                ) : users.length === 0 ? (
                    <p className="p-3 text-xs text-slate-500">{t('itemAcl.noUsersFound')}</p>
                ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {users.map((user) => {
                            const isSelected = value === String(user.id);
                            return (
                                <li key={user.id}>
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => onChange(String(user.id))}
                                        className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30 ${
                                            isSelected ? 'bg-emerald-50 font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : ''
                                        }`}
                                    >
                                        {getUserLabel(user)}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-slate-500">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled || page <= 1 || isLoading}
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                        {t('itemAcl.prevPage')}
                    </Button>
                    <span>{t('itemAcl.pageInfo', { page, total: totalPages })}</span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled || page >= totalPages || isLoading}
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    >
                        {t('itemAcl.nextPage')}
                    </Button>
                </div>
            )}
        </div>
    );
}
