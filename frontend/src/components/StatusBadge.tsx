import { Badge } from '@/components/ui/badge';

const statusVariant = {
    available: 'success',
    active: 'success',
    pending_approval: 'warning',
    reserved: 'violet',
    loaned: 'info',
    broken: 'destructive',
    missing: 'destructive',
    overdue: 'warning',
    inactive: 'secondary',
    deactivated: 'secondary',
} as const;

export function StatusBadge({ status, label }: { status: string; label?: string }) {
    const variant = statusVariant[status as keyof typeof statusVariant] ?? 'secondary';
    return <Badge variant={variant}>{label ?? status}</Badge>;
}
