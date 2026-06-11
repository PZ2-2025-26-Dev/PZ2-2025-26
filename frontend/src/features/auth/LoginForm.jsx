import React, { useState } from 'react';
import { login, googleLogin } from './authService';
import { useTranslation } from 'react-i18next';

export default function LoginForm({ onSwitchToRegister, onLoginSuccess }) {
    const { t } = useTranslation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        try {
            const res = await login({ email, password });

            localStorage.setItem('access_token', res.data.access_token);

            onLoginSuccess(res.data.user);
        } catch (e) {
            alert(t('auth.loginError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">

            <h2 className="text-lg font-bold">{t('auth.login')}</h2>

            <input
                type="email"
                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder={t('auth.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />

            <input
                type="password"
                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder={t('auth.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />

            <button
                onClick={handleLogin}
                disabled={loading || !email || !password}
                className="w-full px-8 py-3 bg-emerald-700 dark:bg-emerald-600 hover:bg-emerald-800 dark:hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-md transform hover:-translate-y-0.5 transition flex items-center justify-center space-x-2"
            >
                {t('auth.loginButton')}
            </button>

            <div className="text-center text-sm text-gray-500">lub</div>

            <button
                onClick={googleLogin}
                className="w-full px-8 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition flex items-center justify-center space-x-2"
            >
                {t('auth.googleLogin')}
            </button>

            <button
                onClick={onSwitchToRegister}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline transition w-full text-center"
            >
                {t('auth.dontHaveAccount')}
            </button>
        </div>
    );
}