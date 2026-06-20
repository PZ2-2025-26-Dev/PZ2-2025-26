import { Badge } from '@/components/ui/badge';

const statusVariant = {
    dostępny: 'success',
    active: 'success',
    wypożyczony: 'info',
    'oczekuje akceptacji': 'warning',
    pending_approval: 'warning',
    uszkodzony: 'destructive',
    zarezerwowany: 'violet',
    inactive: 'secondary',
    deactivated: 'secondary',
} as const;

export function StatusBadge({ status, label }: { status: string; label?: string }) {
    const variant = statusVariant[status as keyof typeof statusVariant] ?? 'secondary';
    return <Badge variant={variant}>{label ?? status}</Badge>;
}
