import React, { useState } from 'react';
import WelcomePage from './features/auth/WelcomePage';
import DashboardPage from './features/dashboard/DashboardPage';

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
        <>
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
        </>
    );
}