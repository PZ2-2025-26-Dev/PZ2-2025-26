import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

export default function SystemClock({ lang = 'PL' }: { lang?: string }) {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = window.setInterval(() => setTime(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    const locale = lang === 'EN' ? 'en-US' : 'pl-PL';

    return (
        <Badge variant="secondary" className="hidden h-auto items-center gap-2 rounded-lg px-3 py-1.5 font-mono sm:inline-flex">
            <Clock3 className="size-3.5 text-emerald-500" />
            <span className="flex flex-col items-start">
                <strong className="text-[11px] text-slate-700 dark:text-slate-200">
                    {time.toLocaleTimeString(locale)}
                </strong>
                <span className="text-[9px] font-normal text-slate-500">
                    {time.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
            </span>
        </Badge>
    );
}
