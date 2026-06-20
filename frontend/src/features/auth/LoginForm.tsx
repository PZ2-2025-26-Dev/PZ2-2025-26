import { useState, type FormEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert';
import { googleLogin, login } from './authService';

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

type LoginError = {
    response?: {
        status?: number;
        data?: {
            detail?: string;
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

        if (password.length < 8) {
            newErrors.password = t('auth.passwordTooShort');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoginError('');

        if (!validate()) {
            return;
        }

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
            const loginFailure = error as LoginError;
            const status = loginFailure.response?.status;
            const detail = loginFailure.response?.data?.detail;

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

    const clearLoginError = () => {
        if (loginError) {
            setLoginError('');
        }
    };

    return (
        <form
            onSubmit={handleLogin}
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        >
            <button
                type="button"
                onClick={onBack}
                className="text-xs text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
            >
                ← {t('welcome.backBtn')}
            </button>

            <h2 className="text-lg font-bold">{t('auth.login')}</h2>

            {loginError && (
                <Alert variant="destructive" aria-live="polite">
                    <AlertCircle aria-hidden="true" />
                    <AlertTitle>{t('auth.loginErrorTitle')}</AlertTitle>
                    <AlertDescription>{loginError}</AlertDescription>
                </Alert>
            )}

            <div>
                <input
                    type="email"
                    autoComplete="email"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'login-email-error' : undefined}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder={t('auth.email')}
                    value={email}
                    onChange={(event) => {
                        setEmail(event.target.value);
                        clearLoginError();
                        if (errors.email) {
                            setErrors((previous) => ({ ...previous, email: undefined }));
                        }
                    }}
                />

                {errors.email && (
                    <p id="login-email-error" className="mt-1 text-sm text-rose-600 dark:text-rose-400">
                        {errors.email}
                    </p>
                )}
            </div>

            <div>
                <input
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'login-password-error' : undefined}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder={t('auth.password')}
                    value={password}
                    onChange={(event) => {
                        setPassword(event.target.value);
                        clearLoginError();
                        if (errors.password) {
                            setErrors((previous) => ({ ...previous, password: undefined }));
                        }
                    }}
                />

                {errors.password && (
                    <p id="login-password-error" className="mt-1 text-sm text-rose-600 dark:text-rose-400">
                        {errors.password}
                    </p>
                )}
            </div>

            <button
                type="submit"
                disabled={loading || !email || !password}
                className="flex w-full items-center justify-center rounded-xl bg-emerald-700 px-8 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
                {loading ? t('auth.loggingIn') : t('auth.loginButton')}
            </button>

            <div className="text-center text-sm text-slate-500">{t('auth.or')}</div>

            <button
                type="button"
                onClick={googleLogin}
                className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-8 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
                {t('auth.googleLogin')}
            </button>

            <button
                type="button"
                onClick={onSwitchToRegister}
                className="w-full text-center text-xs text-slate-400 underline transition hover:text-slate-600 dark:hover:text-slate-200"
            >
                {t('auth.dontHaveAccount')}
            </button>
        </form>
    );
}
