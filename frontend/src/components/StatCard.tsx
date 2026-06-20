import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatCard({
    title,
    value,
    icon: Icon,
    className,
}: {
    title: string;
    value: string | number;
    icon?: LucideIcon;
    className?: string;
}) {
    return (
        <Card>
            <CardContent className="flex items-center justify-between p-4">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
                    <p className={cn('mt-1 text-xl font-bold text-slate-900 dark:text-white', className)}>{value}</p>
                </div>
                {Icon && (
                    <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                        <Icon className="size-4" />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
