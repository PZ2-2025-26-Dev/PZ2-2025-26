import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import WelcomePage from './features/auth/WelcomePage';
import DashboardPage from './features/dashboard/DashboardPage';
import LoginForm from './features/auth/LoginForm';
import RegisterForm from './features/auth/RegisterForm';
import GoogleCallbackPage from './features/auth/GoogleCallback';
import { googleLogin } from './features/auth/authService';

function PendingApprovalView({ t, onBack }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 text-center">
            <div className="max-w-md bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col items-center">
                <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/30 text-amber-500 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                    {t('userManager.statuses.pending_approval')}
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
                    {t('auth.registerSuccess')}
                </p>
                <button
                    onClick={onBack}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors"
                >
                    {t('welcome.backBtn')}
                </button>
            </div>
        </div>
    );
}

export default function App() {
    const { t } = useTranslation();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [authView, setAuthView] = useState('welcome'); // Dodamy stan 'pending'
    const [loading, setLoading] = useState(true);

    const currentPath = window.location.pathname;

    const resetAuth = () => {
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
    };

    useEffect(() => {
        const initAuth = async () => {
            try {
                const token = localStorage.getItem('token');

                if (!token) {
                    setLoading(false);
                    return;
                }

                const res = await fetch('http://localhost:8000/auth/me', {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (!res.ok) throw new Error('Unauthorized or session expired');

                const userData = await res.json();

                if (userData.status === 'pending_approval' || userData.status === 'PENDING_APPROVAL') {
                    resetAuth();
                    setAuthView('pending');
                    return;
                }

                setUser(userData);
                setIsAuthenticated(true);
            } catch (err) {
                console.error('🔄 Auth initialization failed:', err);
                resetAuth();
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, []);

    useEffect(() => {
        if (isAuthenticated && currentPath !== '/auth/google/callback') {
            window.history.replaceState(null, '', '/');
        }
    }, [isAuthenticated, currentPath]);

    const handleLoginSuccess = async (dummyUser, token) => {
        if (token) {
            localStorage.setItem('token', token);
        }

        window.history.replaceState(null, '', '/');

        try {
            const res = await fetch('http://localhost:8000/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) throw new Error('Failed to fetch user after Google login');
            
            const realUser = await res.json();

            if (realUser.status === 'pending_approval' || realUser.status === 'PENDING_APPROVAL') {
                resetAuth();
                setAuthView('pending'); // Zamiast alertu ustawiamy widok oczekiwania
                return;
            }

            setUser(realUser);
            setIsAuthenticated(true);
        } catch (error) {
            console.error('❌ Error fetching user data after login:', error);
            resetAuth();
            alert(t('auth.googleLoginError'));
        }
    };

    const handleLogout = () => {
        resetAuth();
        setAuthView('welcome');
    };


    if (currentPath === '/auth/google/callback') {
        return (
            <GoogleCallbackPage onLoginSuccess={handleLoginSuccess} />
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                <div className="animate-pulse font-medium">{t('userManager.loading')}</div>
            </div>
        );
    }

    if (authView === 'pending') {
        return (
            <PendingApprovalView t={t} onBack={() => setAuthView('welcome')} />
        );
    }

    if (!isAuthenticated || !user) {
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
                        onBack={() => setAuthView('welcome')}
                        onLoginSuccess={handleLoginSuccess}
                    />
                ) : (
                    <RegisterForm
                        onSwitchToLogin={() => setAuthView('login')}
                        onBack={() => setAuthView('welcome')}
                        onRegisterSuccess={() => setAuthView('login')} 
                    />
                )}
            </div>
        );
    }

    return (
        <DashboardPage
            user={user}
            onLogout={handleLogout}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
        />
    );
}