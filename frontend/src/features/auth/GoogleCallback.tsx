import { useEffect, useRef, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import type { AppUser } from '@/types';

export default function GoogleCallbackPage({
    onLoginSuccess,
}: {
    onLoginSuccess: (user: AppUser, token: string) => void;
}) {
    const { t } = useTranslation();
    const sent = useRef(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (sent.current) return;
        sent.current = true;

        const token = new URLSearchParams(window.location.search).get('token');
        if (token) {
            onLoginSuccess({ id: null, name: 'Google User', role: 'user', status: 'active' }, token);
        } else {
            setError(t('auth.googleLoginError'));
        }
    }, [onLoginSuccess, t]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-900">
            <Card className="w-full max-w-sm">
                <CardContent className="pt-5">
                    {error ? (
                        <Alert variant="destructive">
                            <AlertCircle />
                            <AlertTitle>{t('auth.loginErrorTitle')}</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : (
                        <div className="flex flex-col items-center gap-3 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                            <LoaderCircle className="size-8 animate-spin text-emerald-600" />
                            {t('auth.googleCallbackLoading')}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
