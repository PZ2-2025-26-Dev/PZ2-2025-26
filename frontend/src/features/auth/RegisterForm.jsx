import React, { useState } from 'react';
import { register, googleLogin } from './authService';
import { useTranslation } from 'react-i18next';

const ROLES = [
    { value: 'REGULAR', label: 'Regular' },
    { value: 'READ_ONLY', label: 'Read Only' }
];

export default function RegisterForm({ onSwitchToLogin }) {
    const { t } = useTranslation();

    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: ''
    });

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleRegister = async () => {
        try {
            await register(form);
            alert(t('auth.registerSuccess'));
            console.log('Registered user:', form);
            onSwitchToLogin();
        } catch {
            alert(t('auth.registerError'));
        }
    };

    return (
        <div className="w-full max-w-md bg-white dark:bg-slate-950 p-6 rounded-2xl border space-y-3">

            <h2 className="text-lg font-bold">{t('auth.register')}</h2>

            <input name="first_name" placeholder={t('auth.firstName')} onChange={handleChange} className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <input name="last_name" placeholder={t('auth.lastName')} onChange={handleChange} className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <input name="email" type="email" placeholder={t('auth.email')} onChange={handleChange} className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <input name="password" type="password" placeholder={t('auth.password')} onChange={handleChange} className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />

            <button
                onClick={handleRegister}
                className="w-full px-8 py-3 bg-emerald-700 dark:bg-emerald-600 hover:bg-emerald-800 dark:hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-md transform hover:-translate-y-0.5 transition flex items-center justify-center space-x-2"
            >
                {t('auth.registerButton')}
            </button>

            <button
                onClick={googleLogin}
                className="w-full px-8 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition flex items-center justify-center space-x-2"
            >
                {t('auth.googleRegister')}
            </button>

            <button
                onClick={onSwitchToLogin}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline transition w-full text-center"
            >
                {t('auth.alreadyHaveAccount')}
            </button>
        </div>
    );
}