import { useEffect } from 'react';
import {
    CalendarClock,
    ClipboardList,
    LogIn,
    MapPin,
    Moon,
    Plug,
    QrCode,
    Sun,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

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

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    const features = [
        { title: t('welcome.card1Title'), description: t('welcome.card1Desc'), icon: ClipboardList, tone: 'text-blue-600 bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300' },
        { title: t('welcome.card2Title'), description: t('welcome.card2Desc'), icon: QrCode, tone: 'text-violet-600 bg-violet-100 dark:bg-violet-950/50 dark:text-violet-300' },
        { title: t('welcome.card3Title'), description: t('welcome.card3Desc'), icon: MapPin, tone: 'text-amber-600 bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300' },
        { title: t('welcome.card4Title'), description: t('welcome.card4Desc'), icon: CalendarClock, tone: 'text-rose-600 bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300' },
    ];

    return (
        <div className="flex min-h-screen w-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-700 text-xs font-bold tracking-wider text-white dark:bg-emerald-600">
                            AGH
                        </div>
                        <span className="hidden text-sm font-semibold text-slate-700 dark:text-slate-200 sm:inline">
                            Central Positronics
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => i18n.changeLanguage(i18n.language === 'PL' ? 'EN' : 'PL')}
                        >
                            {i18n.language === 'PL' ? 'EN' : 'PL'}
                        </Button>
                        <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            aria-label={isDarkMode ? 'Tryb jasny' : 'Tryb ciemny'}
                        >
                            {isDarkMode ? <Sun /> : <Moon />}
                        </Button>
                    </div>
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
                <section className="mx-auto max-w-3xl space-y-6 text-center">
                    <Badge variant="success">
                        Wydział Fizyki i Informatyki Stosowanej / WFiIS
                    </Badge>
                    <h1 className="flex items-center justify-center gap-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                        <Plug className="size-8 text-emerald-600 sm:size-10" />
                        <span>{t('welcome.title')}</span>
                    </h1>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 sm:text-base">
                        {t('welcome.subtitle')}
                    </p>
                    <p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                        {t('welcome.description')}
                    </p>
                    <div className="flex flex-col items-center gap-3 pt-4">
                        <Button size="lg" onClick={onLocalLogin} className="w-full sm:w-auto">
                            <LogIn />
                            {t('auth.loginButton')}
                        </Button>
                        <Button variant="link" onClick={onRegister}>
                            {t('welcome.registerLink')}
                        </Button>
                    </div>
                </section>

                <section className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {features.map(({ title, description, icon: Icon, tone }) => (
                        <Card key={title} className="h-full">
                            <CardHeader>
                                <div className={`mb-2 flex size-10 items-center justify-center rounded-xl ${tone}`}>
                                    <Icon className="size-5" />
                                </div>
                                <CardTitle className="text-sm">{title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="text-xs leading-relaxed">
                                    {description}
                                </CardDescription>
                            </CardContent>
                        </Card>
                    ))}
                </section>
            </main>

            <footer className="border-t border-slate-200 bg-white py-4 text-[11px] text-slate-400 dark:border-slate-800 dark:bg-slate-950">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-1 px-4 sm:flex-row">
                    <span>&copy; {new Date().getFullYear()} AGH WFiIS. {t('welcome.footerRights')}.</span>
                    <span>{t('welcome.footerTeam')} <strong className="text-slate-600 dark:text-slate-300">Central Positronics</strong></span>
                </div>
            </footer>
        </div>
    );
}
