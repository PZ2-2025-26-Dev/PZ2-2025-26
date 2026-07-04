import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROLES } from '../auth/permissions';
import { useGuests } from '../guests/useGuests';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

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
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [users, setUsers] = useState<SelectableUser[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, ownerId]);

    const loadUsers = useCallback(async () => {
        setIsLoading(true);
        const result = await browseUsers({
            page,
            limit: PAGE_SIZE,
            search: debouncedSearch || undefined,
            role: ROLES.USER,
        });

        if (result.success) {
            const eligible = result.entries
                .filter((entry) => entry.role === ROLES.USER && entry.id !== ownerId)
                .map((entry) => ({
                    id: entry.id,
                    firstName: entry.firstName,
                    lastName: entry.lastName,
                }));
            setUsers(eligible);
            setTotalCount(result.totalCount);
        } else {
            setUsers([]);
            setTotalCount(0);
        }
        setIsLoading(false);
    }, [browseUsers, ownerId, page, debouncedSearch]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    return (
        <div className="space-y-2">
            <Label htmlFor="acl-user-search">{t('itemAcl.userLabel')}</Label>
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                    id="acl-user-search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder={t('itemAcl.userSearchPlaceholder')}
                    disabled={disabled}
                    className="pl-9"
                />
            </div>

            <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
                {isLoading ? (
                    <p className="p-3 text-xs text-slate-500">{t('common.loading')}</p>
                ) : users.length === 0 ? (
                    <p className="p-3 text-xs text-slate-500">
                        {debouncedSearch ? t('itemAcl.noUsersFound') : t('itemAcl.noUsersAvailable')}
                    </p>
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
