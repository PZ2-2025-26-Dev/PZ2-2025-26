import React, { useState } from 'react';
import WelcomePage from './features/auth/WelcomePage';
import DashboardPage from './features/dashboard/DashboardPage';
import LoginForm from './features/auth/LoginForm';
import RegisterForm from './features/auth/RegisterForm';
import GoogleCallbackPage from './features/auth/GoogleCallback';
    import { googleLogin } from './features/auth/authService';

export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(false);

    const [authView, setAuthView] = useState('welcome'); // welcome | login | register

    const handleLoginSuccess = (user) => {
        setUser(user);
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setUser(null);
    };

    const currentPath = window.location.pathname;

    if (currentPath === '/auth/google/callback') {
        return (
            <GoogleCallbackPage
                onLoginSuccess={handleLoginSuccess}
            />
        );
    }

    if (isAuthenticated) {
        return (
            <DashboardPage
                user={user}
                onLogout={handleLogout}
                isDarkMode={isDarkMode}
                setIsDarkMode={setIsDarkMode}
            />
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            {authView === 'welcome' ? (
                <WelcomePage
                    isDarkMode={isDarkMode}
                    setIsDarkMode={setIsDarkMode}
                    onLocalLogin={() => setAuthView('login')}
                    onRegister={() => setAuthView('register')}
                    onGoogleLogin={googleLogin}
                />
            ) : authView === 'login' ? (
                <LoginForm
                    onSwitchToRegister={() => setAuthView('register')}
                    onLoginSuccess={handleLoginSuccess}
                />
            ) : (
                <RegisterForm
                    onSwitchToLogin={() => setAuthView('login')}
                />
            )}
        </div>
    );
}