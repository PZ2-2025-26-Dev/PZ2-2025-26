import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export default function GoogleCallbackPage({ onLoginSuccess }) {
    const { t } = useTranslation();
    const sent = useRef(false);

    useEffect(() => {
        if (sent.current) return;
        sent.current = true;

        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');

        if (token) {
            onLoginSuccess(
                { id: null, name: 'Google User', role: 'USER', status: 'ACTIVE' }, 
                token
            );
        } else {
            alert(t('auth.googleLoginError'));
        }
    }, [onLoginSuccess, t]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
            <div className="flex flex-col items-center gap-3">
                {/* Kręciołek / Spinner ładowania */}
                <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {/* Dynamiczne tłumaczenie klucza "auth.googleCallbackLoading" */}
                <span className="font-medium">{t('auth.googleCallbackLoading')}</span>
            </div>
        </div>
    );
}