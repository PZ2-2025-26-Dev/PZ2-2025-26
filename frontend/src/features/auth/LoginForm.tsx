import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { googleLogin, login } from './authService';

import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';


// wiem że całość jest w JS-ie, ale ja mam to gdzieś i robię w TypeScripcie

type LoginUser = {
    id: string | number;
    name: string;
    role: string;
    status: 'ACTIVE';
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

type ApiError = {
    response?: {
        status?: number;
        data?: {
            detail?: {
                code?: string;
                message?: string;
            };
        };
    };
};

export default function LoginForm({
    onSwitchToRegister,
    onLoginSuccess,
    onBack,
}: LoginFormProps) {
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

            onLoginSuccess(
                {
                    id: user.id,
                    name: `${user.first_name} ${user.last_name || ''}`.trim(),
                    role: user.role,
                    status: 'ACTIVE',
                },
                response.data.access_token,
            );
        } catch (error) {
            const err = error as ApiError;

            const status = err.response?.status;
            const code = err.response?.data?.detail?.code;
            const message = err.response?.data?.detail?.message;

            const errorMap: Record<string, string> = {
                PENDING_APPROVAL: t('auth.pendingApprovalError'),
                INVALID_CREDENTIALS: t('auth.invalidCredentials'),
                FORBIDDEN: t('auth.forbidden'),
            };
            if (status === 403 && code && errorMap[code]) {
                setLoginError(errorMap[code]);
                return;
            }

            if (status === 401 && code === 'INVALID_CREDENTIALS') {
                setLoginError(errorMap.INVALID_CREDENTIALS);
                return;
            }
            if (status === 422) {
                setLoginError(errorMap.INVALID_CREDENTIALS);
                return;
            }

            setLoginError(message || t('auth.serverError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 w-fit px-0">
                    <ArrowLeft />
                    {t('welcome.backBtn')}
                </Button>
                <CardTitle>{t('auth.login')}</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                    <Alert variant="destructive" aria-live="polite">
                        <AlertCircle aria-hidden="true" />
                        <AlertTitle>{t('auth.loginErrorTitle')}</AlertTitle>
                        <AlertDescription>{loginError}</AlertDescription>
                    </Alert>
                )}

                <div className="space-y-2">
                    <Label htmlFor="login-email">{t('auth.email')}</Label>
                    <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'login-email-error' : undefined}
                    placeholder={t('auth.email')}
                    value={email}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    onChange={(e) => {
                        setEmail(e.target.value);
                        setLoginError('');
                        if (errors.email) {
                            setErrors((p) => ({ ...p, email: undefined }));
                        }
                    }}
                />

                    {errors.email && (
                    <p id="login-email-error" className="text-xs text-rose-600 dark:text-rose-400">
                        {errors.email}
                    </p>
                )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="login-password">{t('auth.password')}</Label>
                    <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'login-password-error' : undefined}
                    placeholder={t('auth.password')}
                    value={password}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    onChange={(e) => {
                        setPassword(e.target.value);
                        setLoginError('');
                        if (errors.password) {
                            setErrors((p) => ({ ...p, password: undefined }));
                        }
                    }}
                />

                    {errors.password && (
                    <p id="login-password-error" className="text-xs text-rose-600 dark:text-rose-400">
                        {errors.password}
                    </p>
                )}
                </div>

                <Button
                type="submit"
                size="lg"
                disabled={loading || !email || !password}
                className="w-full"
            >
                <LogIn />
                {loading ? t('auth.loggingIn') : t('auth.loginButton')}
                </Button>

                <div className="text-center text-xs text-slate-500">{t('auth.or')}</div>

                <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={googleLogin}
                className="w-full"
            >
                {t('auth.googleLogin')}
                </Button>

                <Button
                type="button"
                variant="link"
                onClick={onSwitchToRegister}
                className="w-full"
            >
                {t('auth.dontHaveAccount')}
                </Button>
                </form>
            </CardContent>
        </Card>
    );
}