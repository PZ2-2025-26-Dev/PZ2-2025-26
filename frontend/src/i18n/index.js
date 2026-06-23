import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import pl from './locales/pl.json';
import en from './locales/en.json';

const getStoredLanguage = () => {
    const storedLanguage = localStorage.getItem('language');
    if (storedLanguage === 'PL' || storedLanguage === 'EN') return storedLanguage;

    return navigator.language.toLowerCase().startsWith('pl') ? 'PL' : 'EN';
};

i18n
    .use(initReactI18next)
    .init({
        resources: {
            PL: { translation: pl },
            EN: { translation: en }
        },
        lng: getStoredLanguage(),
        fallbackLng: 'EN',
        interpolation: {
            escapeValue: false
        }
    });

i18n.on('languageChanged', (language) => {
    if (language === 'PL' || language === 'EN') {
        localStorage.setItem('language', language);
    }
});

export default i18n;