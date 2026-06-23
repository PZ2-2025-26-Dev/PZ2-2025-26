import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

type WelcomePageProps = {
    onLocalLogin: () => void;
    onRegister: () => void;
    isDarkMode: boolean;
    setIsDarkMode: (enabled: boolean) => void;
};

export default function WelcomePage({
    onLocalLogin,
    onRegister,
    isDarkMode,
    setIsDarkMode,
}: WelcomePageProps) {
    const { t, i18n } = useTranslation();
    const currentLanguage = i18n.language?.toUpperCase() === 'PL' ? 'PL' : 'EN';

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    return (
        <div className="min-h-[100dvh] w-full bg-slate-100 font-sans text-slate-950 transition-colors dark:bg-slate-950 dark:text-white">
            <main className="mx-auto grid min-h-[100dvh] w-full max-w-5xl grid-rows-[minmax(0,1fr)_auto] gap-3 p-3 sm:gap-4 sm:p-5 lg:p-7">
                <section className="relative isolate h-full min-h-0 overflow-hidden rounded-[1.75rem] bg-emerald-900 px-7 py-8 text-white shadow-xl shadow-emerald-950/15 dark:bg-[#052e2b] sm:rounded-[2rem] sm:px-10 sm:py-10 lg:px-14 lg:py-12">
                    <button
                        type="button"
                        onClick={() => void i18n.changeLanguage(currentLanguage === 'PL' ? 'EN' : 'PL')}
                        className="absolute -right-10 -top-10 z-20 flex h-44 w-44 items-end justify-start rounded-full bg-amber-400 pb-10 pl-10 text-left text-amber-950 shadow-lg transition hover:bg-amber-300 focus:outline-none focus:ring-4 focus:ring-white/70 sm:-right-8 sm:-top-12 sm:h-56 sm:w-56 sm:pb-14 sm:pl-14"
                        aria-label={currentLanguage === 'PL' ? t('welcome.switchToEnglish') : t('welcome.switchToPolish')}
                    >
                        <span className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-[0.18em] opacity-70">
                                {t('welcome.language')}
                            </span>
                            <span className="text-lg font-black tracking-tight sm:text-xl">
                                {currentLanguage === 'PL' ? 'EN' : 'PL'}
                            </span>
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className="absolute right-5 top-36 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-md backdrop-blur transition hover:bg-white/25 focus:outline-none focus:ring-4 focus:ring-white/50 sm:right-8 sm:top-44 sm:h-14 sm:w-14"
                        aria-label={isDarkMode ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'}
                    >
                        {isDarkMode ? (
                            <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.243 17.657l.707.707M7.757 6.364l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                            </svg>
                        ) : (
                            <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        )}
                    </button>

                    <div className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full border-[3rem] border-emerald-600/35 dark:border-emerald-700/30 sm:-bottom-32 sm:h-72 sm:w-72" />

                    <div className="relative z-10 flex h-full min-h-0 flex-col justify-between">
                        <div className="max-w-[13rem] sm:max-w-sm">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase leading-relaxed tracking-[0.18em] text-emerald-100">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                                <span>{t('welcome.faculty')}</span>
                            </div>
                        </div>

                        <div className="max-w-xl pb-1">
                            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-300 sm:text-xs">
                                {t('welcome.systemLabel')}
                            </p>
                            <h1 className="max-w-lg text-[clamp(2.5rem,11vw,4.5rem)] font-black leading-[0.94] tracking-[-0.045em] text-white">
                                {t('welcome.productName')}
                            </h1>
                            <p className="mt-5 max-w-md text-[15px] font-medium leading-relaxed text-emerald-50 sm:text-base">
                                {t('welcome.conciseDescription')}
                            </p>
                        </div>
                    </div>
                </section>

                <div className="space-y-2.5 pb-[max(0rem,env(safe-area-inset-bottom))]">
                    <button
                        type="button"
                        onClick={onLocalLogin}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-extrabold text-white shadow-lg shadow-emerald-700/20 transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400 dark:focus:ring-offset-slate-950 sm:text-base"
                    >
                        {t('welcome.enterSystem')}
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>

                    <p className="text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                        {t('welcome.noAccount')}{' '}
                        <button
                            type="button"
                            onClick={onRegister}
                            className="font-bold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
                        >
                            {t('welcome.createAccount')}
                        </button>
                    </p>
                </div>
            </main>
        </div>
    );
}
