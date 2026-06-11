import React, { useState, Suspense, lazy } from 'react';
import Loader from './components/ui/Loader';

const WelcomePage = lazy(() => import('./features/auth/WelcomePage'));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));

export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [lang, setLang] = useState('PL');
    const [isDarkMode, setIsDarkMode] = useState(false);

    const handleLoginViaSSO = (selectedRole) => {
        setUser({
            id: 'usr-4412',
            name: 'Jan Kowalski',
            role: selectedRole,
            identityProvider: 'AGH_SSO'
        });
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setUser(null);
    };

    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <Loader variant="spinner" />
            </div>
        }>
            {isAuthenticated ? (
                <DashboardPage
                    user={user}
                    onLogout={handleLogout}
                    lang={lang}
                    setLang={setLang}
                    isDarkMode={isDarkMode}
                    setIsDarkMode={setIsDarkMode}
                />
            ) : (
                <WelcomePage
                    onSSOLogin={handleLoginViaSSO}
                    lang={lang}
                    setLang={setLang}
                    isDarkMode={isDarkMode}
                    setIsDarkMode={setIsDarkMode}
                />
            )}
        </Suspense>
    );
}