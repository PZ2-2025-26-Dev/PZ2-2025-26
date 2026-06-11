import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { googleCallback } from './authService';

export default function GoogleCallbackPage({ onLoginSuccess }) {
    const { t } = useTranslation();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const code = params.get('code');
        const state = params.get('state');

        const send = async () => {
            try {
                const res = await googleCallback({
                    code,
                    state,
                    redirect_uri: window.location.origin + '/auth/google/callback'
                });

                localStorage.setItem('access_token', res.data.access_token);

                if (onLoginSuccess) {
                    onLoginSuccess(res.data.user);
                    window.history.replaceState({}, '', '/');
                } else {
                    window.location.href = '/';
                }
            } catch (e) {
                alert(t('auth.googleLoginError'));
            }
        };

        send();
    }, []);

    return <div>{t('auth.googleCallbackLoading')}</div>;
}