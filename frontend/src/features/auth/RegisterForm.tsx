import { useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseApiError } from '../../api/apiUtils';
import { googleLogin, register } from './authService';

type RegisterFormProps = {
  onSwitchToLogin: () => void;
  onBack: () => void;
  onRegisterSuccess: () => void; 
};

type FieldErrors = {
    first_name?: string;
    last_name?: string;
    email?: string;
    password?: string;
};

export default function RegisterForm({ onSwitchToLogin, onBack, onRegisterSuccess }: RegisterFormProps) {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
    });

    const validate = () => {
        const nextErrors: FieldErrors = {};
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!form.first_name.trim()) nextErrors.first_name = t('auth.firstNameRequired');
        if (!form.last_name.trim()) nextErrors.last_name = t('auth.lastNameRequired');
        if (!emailRegex.test(form.email)) nextErrors.email = t('auth.invalidEmail');
        if (form.password.length < 8) nextErrors.password = t('auth.passwordTooShort');

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const isPasswordTooShortError = (error: any) => {
        const detail = error?.response?.data?.detail;
        return Array.isArray(detail) && detail.some((entry) => (
            Array.isArray(entry?.loc)
            && entry.loc.includes('password')
            && (
                String(entry?.type ?? '').includes('too_short')
                || String(entry?.msg ?? '').toLowerCase().includes('8')
            )
        ));
    };

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        setMessage(null);
        setErrors((current) => ({ ...current, [event.target.name]: undefined }));
        setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    };

    const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!validate()) return;

        setIsLoading(true);
        setMessage(null);

        try {
            await register(form);
            setMessage({ type: 'success', text: t('auth.registerSuccess') });

            onRegisterSuccess();
        } catch (error: any) {
            if (isPasswordTooShortError(error)) {
                setErrors((current) => ({ ...current, password: t('auth.passwordTooShort') }));
                setMessage({ type: 'error', text: t('auth.passwordTooShort') });
            } else {
                setMessage({ type: 'error', text: parseApiError(error, t('auth.registerError')) });
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 w-fit px-0">
                    <ArrowLeft />
                    {t('welcome.backBtn')}
                </Button>
                <CardTitle>{t('auth.register')}</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                    {message && (
                        <Alert variant={message.type === 'error' ? 'destructive' : 'default'} className={message.type === 'success' ? 'border-accent-200 bg-accent-50 text-accent-800 dark:border-accent-900 dark:bg-accent-950/40 dark:text-accent-200' : undefined}>
                            <AlertCircle />
                            <AlertTitle>{message.type === 'success' ? t('auth.register') : t('auth.loginErrorTitle')}</AlertTitle>
                            <AlertDescription>{message.text}</AlertDescription>
                        </Alert>
                    )}

                    {([
                        ['first_name', t('auth.firstName'), 'given-name', 'text'],
                        ['last_name', t('auth.lastName'), 'family-name', 'text'],
                        ['email', t('auth.email'), 'email', 'email'],
                        ['password', t('auth.password'), 'new-password', 'password'],
                    ] as const).map(([name, label, autoComplete, type]) => {
                        const fieldError = errors[name];

                        return (
                        <div key={name} className="space-y-2">
                            <Label htmlFor={`register-${name}`}>{label}</Label>
                            <Input
                                id={`register-${name}`}
                                name={name}
                                type={type}
                                autoComplete={autoComplete}
                                value={form[name as keyof typeof form]}
                                onChange={handleChange}
                                aria-invalid={Boolean(fieldError)}
                                aria-describedby={fieldError ? `register-${name}-error` : undefined}
                                required
                                disabled={isLoading}
                            />
                            {fieldError && (
                                <p id={`register-${name}-error`} className="text-sm text-rose-600 dark:text-rose-400">
                                    {fieldError}
                                </p>
                            )}
                        </div>
                    );})}

                    <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                        <UserPlus />
                        {isLoading ? t('auth.registering') : t('auth.registerButton')}
                    </Button>
                    <Button type="button" variant="secondary" size="lg" className="w-full" onClick={googleLogin}>
                        {t('auth.googleRegister')}
                    </Button>
                    <Button type="button" variant="link" className="w-full" onClick={onSwitchToLogin}>
                        {t('auth.alreadyHaveAccount')}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
