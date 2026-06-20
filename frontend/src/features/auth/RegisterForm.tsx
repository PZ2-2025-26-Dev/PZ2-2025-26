import { useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { googleLogin, register } from './authService';

type RegisterFormProps = {
    onSwitchToLogin: () => void;
    onBack: () => void;
};

export default function RegisterForm({ onSwitchToLogin, onBack }: RegisterFormProps) {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
    });

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        setMessage(null);
        setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    };

    const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            await register(form);
            setMessage({ type: 'success', text: t('auth.registerSuccess') });
        } catch {
            setMessage({ type: 'error', text: t('auth.registerError') });
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
                        <Alert variant={message.type === 'error' ? 'destructive' : 'default'} className={message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : undefined}>
                            <AlertCircle />
                            <AlertTitle>{message.type === 'success' ? t('auth.register') : t('auth.loginErrorTitle')}</AlertTitle>
                            <AlertDescription>{message.text}</AlertDescription>
                        </Alert>
                    )}

                    {[
                        ['first_name', t('auth.firstName'), 'given-name', 'text'],
                        ['last_name', t('auth.lastName'), 'family-name', 'text'],
                        ['email', t('auth.email'), 'email', 'email'],
                        ['password', t('auth.password'), 'new-password', 'password'],
                    ].map(([name, label, autoComplete, type]) => (
                        <div key={name} className="space-y-2">
                            <Label htmlFor={`register-${name}`}>{label}</Label>
                            <Input
                                id={`register-${name}`}
                                name={name}
                                type={type}
                                autoComplete={autoComplete}
                                value={form[name as keyof typeof form]}
                                onChange={handleChange}
                                required
                                disabled={isLoading}
                            />
                        </div>
                    ))}

                    <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                        <UserPlus />
                        {isLoading ? t('userManager.loading') : t('auth.registerButton')}
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
