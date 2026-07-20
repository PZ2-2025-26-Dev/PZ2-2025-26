import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AppUser } from '@/types';
import { ENDPOINTS } from './api/endpoints';
import DashboardPage from './features/dashboard/DashboardPage';
import GoogleCallbackPage from './features/auth/GoogleCallback';
import LoginForm from './features/auth/LoginForm';
import RegisterForm from './features/auth/RegisterForm';
import WelcomePage from './features/auth/WelcomePage';
import {
    applyPreferences,
    getStoredPreferences,
    preferencesFromApi,
    preferencesToApi,
    type AppPreferences,
} from './theme/appPreferences';

type AuthView = 'welcome' | 'login' | 'register' | 'pending';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function PendingApprovalView({ t, onBack }: { t: TFunction; onBack: () => void }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--color-page-bg))] p-6">
            <Card className="w-full max-w-md text-center">
                <CardHeader className="items-center">
                    <div className="mb-2 flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
                        <Clock3 className="size-7" />
                    </div>
                    <CardTitle>{t('userManager.statuses.pending_approval')}</CardTitle>
                    <CardDescription>{t('auth.registerSuccess')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button variant="secondary" onClick={onBack}>
                        {t('welcome.backBtn')}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

export default function App() {
    const { t } = useTranslation();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<AppUser | null>(null);
    const [preferences, setPreferences] = useState<AppPreferences>(() => getStoredPreferences());
    const isDarkMode = preferences.uiTheme === 'dark';
    const [authView, setAuthView] = useState<AuthView>('welcome');
    const [loading, setLoading] = useState(true);
    const [appError, setAppError] = useState('');

    const currentPath = window.location.pathname;
    const isGoogleCallbackPath = currentPath === '/auth/google/callback' || currentPath === '/google/complete';

    useEffect(() => {
        applyPreferences(preferences);
    }, [preferences]);

    const normalizeUser = useCallback((userData: AppUser & Record<string, unknown>): AppUser => {
        const nextPreferences = preferencesFromApi(userData);
        setPreferences(nextPreferences);
        return {
            ...userData,
            uiTheme: nextPreferences.uiTheme,
            uiFont: nextPreferences.uiFont,
            uiAccent: nextPreferences.uiAccent,
        };
    }, []);

    const updatePreferences = useCallback((nextPreferences: AppPreferences) => {
        setPreferences(nextPreferences);
        setUser((currentUser) => currentUser ? {
            ...currentUser,
            uiTheme: nextPreferences.uiTheme,
            uiFont: nextPreferences.uiFont,
            uiAccent: nextPreferences.uiAccent,
        } : currentUser);

        const token = localStorage.getItem('token');
        if (!token || !isAuthenticated) return;

        void fetch(`${API_BASE_URL}${ENDPOINTS.AUTH.PREFERENCES}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(preferencesToApi(nextPreferences)),
        }).then(async (response) => {
            if (!response.ok) throw new Error('Failed to save preferences');
            const savedUser = await response.json() as AppUser & Record<string, unknown>;
            setUser(normalizeUser(savedUser));
        }).catch((error) => {
            console.error('Failed to save user preferences:', error);
        });
    }, [isAuthenticated, normalizeUser]);

    const setIsDarkMode = useCallback((enabled: boolean) => {
        updatePreferences({
            ...preferences,
            uiTheme: enabled ? 'dark' : 'light',
        });
    }, [preferences, updatePreferences]);

    const resetAuth = useCallback(() => {
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;

                const response = await fetch(`${API_BASE_URL}${ENDPOINTS.AUTH.ME}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!response.ok) throw new Error('Unauthorized or session expired');
                const userData = normalizeUser(await response.json() as AppUser & Record<string, unknown>);

                if (userData.status === 'pending_approval' || userData.status === 'PENDING_APPROVAL') {
                    resetAuth();
                    setAuthView('pending');
                    return;
                }

                setUser(userData);
                setIsAuthenticated(true);
            } catch (error) {
                console.error('Auth initialization failed:', error);
                resetAuth();
            } finally {
                setLoading(false);
            }
        };

        void initAuth();
    }, [resetAuth]);

    useEffect(() => {
        if (isAuthenticated && !isGoogleCallbackPath) {
            window.history.replaceState(null, '', '/');
        }
    }, [isAuthenticated, isGoogleCallbackPath]);

    const handleLoginSuccess = useCallback(async (_user: AppUser, token: string) => {
        setAppError('');
        if (token) localStorage.setItem('token', token);
        window.history.replaceState(null, '', '/');

        try {
            const response = await fetch(`${API_BASE_URL}${ENDPOINTS.AUTH.ME}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) throw new Error('Failed to fetch user after login');
            const realUser = normalizeUser(await response.json() as AppUser & Record<string, unknown>);

            if (realUser.status === 'pending_approval' || realUser.status === 'PENDING_APPROVAL') {
                resetAuth();
                setAuthView('pending');
                return;
            }

            setUser(realUser);
            setIsAuthenticated(true);
        } catch (error) {
            console.error('Error fetching user data after login:', error);
            resetAuth();
            setAppError(t('auth.googleLoginError'));
            setAuthView('login');
        }
    }, [resetAuth, t]);

    if (isGoogleCallbackPath) {
        return <GoogleCallbackPage onLoginSuccess={handleLoginSuccess} />;
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--color-page-bg))]">
                <Card className="w-full max-w-sm">
                    <CardContent className="space-y-3 pt-5">
                        <Skeleton className="mx-auto size-10 rounded-full" />
                        <Skeleton className="mx-auto h-4 w-36" />
                        <Skeleton className="h-9 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (authView === 'pending') {
        return <PendingApprovalView t={t} onBack={() => setAuthView('welcome')} />;
    }

    if (!isAuthenticated || !user) {
        if (authView === 'welcome') {
            return (
                <WelcomePage
                    isDarkMode={isDarkMode}
                    setIsDarkMode={setIsDarkMode}
                    onLocalLogin={() => setAuthView('login')}
                    onRegister={() => setAuthView('register')}
                />
            );
        }

        return (
            <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--color-page-bg))] p-4">
                <div className="w-full max-w-md space-y-4">
                    {appError && (
                        <Alert variant="destructive">
                            <AlertCircle />
                            <AlertTitle>{t('auth.loginErrorTitle')}</AlertTitle>
                            <AlertDescription>{appError}</AlertDescription>
                        </Alert>
                    )}
                    {authView === 'login' ? (
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
            </div>
        );
    }

    return (
        <DashboardPage
            user={user}
            onLogout={() => {
                resetAuth();
                setAuthView('welcome');
            }}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            preferences={preferences}
            onPreferencesChange={updatePreferences}
        />
    );
}
