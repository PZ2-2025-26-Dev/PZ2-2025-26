import  { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function WelcomePage({ onLocalLogin, onRegister, isDarkMode, setIsDarkMode }) {
    const { t, i18n } = useTranslation();

    useEffect(() => {
        const root = window.document.documentElement;
        if (isDarkMode) root.classList.add('dark');
        else root.classList.remove('dark');
    }, [isDarkMode]);

    const toggleLanguage = () => {
        i18n.changeLanguage(i18n.language === 'PL' ? 'EN' : 'PL');
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-emerald-700 dark:bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-sm tracking-wider">AGH</div>
                        <span className="font-semibold text-sm tracking-wide text-slate-700 dark:text-slate-200 hidden sm:inline-block">Central Positronics</span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button onClick={toggleLanguage} className="px-3 py-1 text-xs font-bold rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                            {i18n.language === 'PL' ? 'EN' : 'PL'}
                        </button>
                        <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition">
                            {isDarkMode ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.243 17.657l.707.707M7.757 6.364l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center py-12 lg:py-20 w-full">
                <div className="text-center space-y-6 max-w-3xl mx-auto">
                    <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
                        Wydział Fizyki i Informatyki Stosowanej / WFiIS
                    </div>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight flex items-center justify-center">
                        <span className="mr-3 text-3xl" role="img" aria-label="plug">🔌</span>
                        <span>{t('welcome.title')}</span>
                    </h1>
                    <p className="text-sm sm:text-base font-medium text-emerald-700 dark:text-emerald-400">{t('welcome.subtitle')}</p>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">{t('welcome.description')}</p>

                    <div className="pt-4 pb-8 min-h-[140px] flex flex-col items-center justify-center">
                        <div className="flex flex-col items-center space-y-3 animate-fadeIn w-full max-w-md">
                            <button
                                onClick={onLocalLogin}
                                className="w-full sm:w-auto px-8 py-3 bg-emerald-700 dark:bg-emerald-600 hover:bg-emerald-800 dark:hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-md transform hover:-translate-y-0.5 transition flex items-center justify-center gap-2"
                            >
                                <svg
                                    className="w-4 h-4 flex-shrink-0"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                                    />
                                </svg>

                                <span>{t('auth.loginButton')}</span>
                            </button>

                            <div className="flex items-center space-x-3 text-xs text-slate-400 dark:text-slate-500 pt-2">
                                <button onClick={onRegister} className="underline hover:text-slate-600 dark:hover:text-slate-300">{t('welcome.registerLink')}</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
                    {[
                        { title: t('welcome.card1Title'), desc: t('welcome.card1Desc'), color: 'text-blue-600 bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2' },
                        { title: t('welcome.card2Title'), desc: t('welcome.card2Desc'), color: 'text-purple-600 bg-purple-100 dark:bg-purple-950/40 dark:text-purple-400', icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-16v3m0 0h.01M4 12h2' },
                        { title: t('welcome.card3Title'), desc: t('welcome.card3Desc'), color: 'text-amber-600 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' },
                        { title: t('welcome.card4Title'), desc: t('welcome.card4Desc'), color: 'text-rose-600 bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' }
                    ].map((card, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col space-y-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={card.icon} /></svg>
                            </div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">{card.title}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed flex-grow">{card.desc}</p>
                        </div>
                    ))}
                </div>
            </main>

            <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[11px] text-slate-400 py-4 mt-auto">
                <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between space-y-1 sm:space-y-0">
                    <div>&copy; {new Date().getFullYear()} AGH WFiIS. {t('welcome.footerRights')}.</div>
                    <div>{t('welcome.footerTeam')} <span className="font-bold text-slate-600 dark:text-slate-300">Central Positronics</span></div>
                </div>
            </footer>
        </div>
    );
}