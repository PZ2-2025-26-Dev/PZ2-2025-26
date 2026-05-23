import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import pl from './locales/pl.json';
import en from './locales/en.json';

i18n
    .use(initReactI18next)
    .init({
        resources: {
            PL: { translation: pl },
            EN: { translation: en }
        },
        lng: 'PL', // domyślny język
        fallbackLng: 'EN',
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;