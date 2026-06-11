import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { googleCallback } from './authService';

export default function GoogleCallbackPage({ onLoginSuccess }) {
    const { t } = useTranslation();
    const callbackSent = useRef(false);

    useEffect(() => {
        if (callbackSent.current) return;
        callbackSent.current = true;

        const params = new URLSearchParams(window.location.search);

        const code = params.get('code');
        const state = params.get('state');

        if (!code) {
            alert(t('auth.googleLoginError'));
            return;
        }

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
    }, [onLoginSuccess, t]);

    return <div>{t('auth.googleCallbackLoading')}</div>;
}