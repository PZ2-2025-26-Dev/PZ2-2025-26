import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { googleLogin, login } from './authService';

type LoginUser = {
    id: string | number;
    name: string;
    role: string;
    status: 'ACTIVE' | 'GUEST';
};

type LoginFormProps = {
    onSwitchToRegister: () => void;
    onLoginSuccess: (user: LoginUser, token: string) => void;
    onBack: () => void;
};

type FieldErrors = {
    email?: string;
    password?: string;
};

export default function LoginForm({ onSwitchToRegister, onLoginSuccess, onBack }: LoginFormProps) {
    const { t } = useTranslation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [errors, setErrors] = useState<FieldErrors>({});

    const validate = () => {
        const newErrors: FieldErrors = {};
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            newErrors.email = t('auth.invalidEmail');
        }

        if (password.length < 8) {
            newErrors.password = t('auth.passwordTooShort');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoginError('');

        if (!validate()) return;

        setLoading(true);
        try {
            const response = await login({ email, password });
            const user = response.data.user;
            const token = response.data.access_token;

            onLoginSuccess(
                {
                    id: user.id,
                    name: `${user.first_name} ${user.last_name || ''}`.trim(),
                    role: user.role,
                    status: 'ACTIVE',
                },
                token,
            );
        } catch (err: any) {
            const status = err?.response?.status;
            const detail = err?.response?.data?.detail;

            if (status === 403 && detail === 'PENDING_APPROVAL') {
                setLoginError(t('auth.pendingApprovalError'));
            } else if (status === 401) {
                setLoginError(t('auth.invalidCredentials'));
            } else {
                setLoginError(t('auth.serverError'));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = () => {
        googleLogin();
    };

    const clearLoginError = () => {
        if (loginError) setLoginError('');
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-primary/10 rounded-full">
                            <svg className="h-10 w-10 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M6 18h8" />
                                <path d="M9 3v5" />
                                <path d="M12 8l6 6" />
                                <circle cx="7" cy="17" r="3" />
                            </svg>
                        </div>
                    </div>
                    <CardTitle className="text-2xl">{t('auth.appTitle')}</CardTitle>
                    <CardDescription>
                        {t('auth.appSubtitle')}
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <Button type="button" onClick={handleGoogle} className="w-full h-12 text-base" size="lg">
                            {t('auth.googleLogin')}
                        </Button>

                        <div className="relative">
                            <Separator />
                            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                                {t('auth.or')}
                            </span>
                        </div>

                        {loginError && (
                            <Alert variant="destructive" aria-live="polite">
                                <AlertTitle>{t('auth.loginErrorTitle')}</AlertTitle>
                                <AlertDescription>{loginError}</AlertDescription>
                            </Alert>
                        )}

                        <div>
                            <Label htmlFor="login-email" className="sr-only">{t('auth.email')}</Label>
                            <Input
                                id="login-email"
                                type="email"
                                autoComplete="email"
                                aria-invalid={Boolean(errors.email)}
                                aria-describedby={errors.email ? 'login-email-error' : undefined}
                                placeholder={t('auth.email')}
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    clearLoginError();
                                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                                }}
                            />
                            {errors.email && (
                                <p id="login-email-error" className="mt-1 text-sm text-rose-600 dark:text-rose-400">{errors.email}</p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="login-password" className="sr-only">{t('auth.password')}</Label>
                            <Input
                                id="login-password"
                                type="password"
                                autoComplete="current-password"
                                aria-invalid={Boolean(errors.password)}
                                aria-describedby={errors.password ? 'login-password-error' : undefined}
                                placeholder={t('auth.password')}
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    clearLoginError();
                                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                                }}
                            />
                            {errors.password && (
                                <p id="login-password-error" className="mt-1 text-sm text-rose-600 dark:text-rose-400">{errors.password}</p>
                            )}
                        </div>

                        <Button type="submit" disabled={loading || !email || !password} className="flex w-full items-center justify-center rounded-xl bg-emerald-700 px-8 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:bg-emerald-600 dark:hover:bg-emerald-500">
                            {loading ? t('auth.loggingIn') : t('auth.loginButton')}
                        </Button>

                        <div className="text-center text-sm text-slate-500">{t('auth.or')}</div>

                        <div className="flex items-center justify-between">
                            <button type="button" onClick={onBack} className="text-xs text-slate-400 hover:text-slate-600">← {t('welcome.backBtn')}</button>
                            <button type="button" onClick={onSwitchToRegister} className="text-xs text-slate-400 underline hover:text-slate-600">{t('auth.dontHaveAccount')}</button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}