import React, { useState, useEffect } from 'react';


export default function SystemClock({ lang = 'PL' }) {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const config = {
        PL: { locale: 'pl-PL' },
        EN: { locale: 'en-US' }
    }[lang];

    return (
        <div className="flex flex-col items-end text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 shadow-sm">
            <div className="flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="font-bold text-slate-700 dark:text-slate-200">
          {time.toLocaleTimeString(config.locale)}
        </span>
            </div>
            <div className="text-[10px] opacity-70">
                {time.toLocaleDateString(config.locale, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
        </div>
    );
}
