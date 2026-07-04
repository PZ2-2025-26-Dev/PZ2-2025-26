export type UiTheme = 'light' | 'dark';
export type UiFont = 'sans' | 'serif' | 'mono';
export type UiAccent = 'agh-green' | 'agh-red' | 'agh-gold' | 'agh-blue';

export type AppPreferences = {
    uiTheme: UiTheme;
    uiFont: UiFont;
    uiAccent: UiAccent;
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
    uiTheme: 'light',
    uiFont: 'sans',
    uiAccent: 'agh-green',
};

export const APP_FONT_OPTIONS: Array<{ value: UiFont; labelKey: string; previewClassName: string }> = [
    { value: 'sans', labelKey: 'settings.fonts.sans', previewClassName: 'font-sans' },
    { value: 'serif', labelKey: 'settings.fonts.serif', previewClassName: 'font-serif' },
    { value: 'mono', labelKey: 'settings.fonts.mono', previewClassName: 'font-mono' },
];

export const APP_ACCENT_OPTIONS: Array<{ value: UiAccent; labelKey: string; swatch: string }> = [
    { value: 'agh-green', labelKey: 'settings.accents.aghGreen', swatch: '#00693C' },
    { value: 'agh-red', labelKey: 'settings.accents.aghRed', swatch: '#A71930' },
    { value: 'agh-gold', labelKey: 'settings.accents.aghGold', swatch: '#C69214' },
    { value: 'agh-blue', labelKey: 'settings.accents.aghBlue', swatch: '#006BA6' },
];

const PREFERENCES_STORAGE_KEY = 'appPreferences';

function isUiTheme(value: unknown): value is UiTheme {
    return value === 'light' || value === 'dark';
}

function isUiFont(value: unknown): value is UiFont {
    return value === 'sans' || value === 'serif' || value === 'mono';
}

function isUiAccent(value: unknown): value is UiAccent {
    return value === 'agh-green' || value === 'agh-red' || value === 'agh-gold' || value === 'agh-blue';
}

export function getStoredPreferences(): AppPreferences {
    const storedPreferences = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    const legacyTheme = localStorage.getItem('theme');

    if (!storedPreferences) {
        return {
            ...DEFAULT_APP_PREFERENCES,
            uiTheme: legacyTheme === 'dark' || legacyTheme === 'light'
                ? legacyTheme
                : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
        };
    }

    try {
        const parsed = JSON.parse(storedPreferences) as Partial<AppPreferences>;
        return {
            uiTheme: isUiTheme(parsed.uiTheme) ? parsed.uiTheme : DEFAULT_APP_PREFERENCES.uiTheme,
            uiFont: isUiFont(parsed.uiFont) ? parsed.uiFont : DEFAULT_APP_PREFERENCES.uiFont,
            uiAccent: isUiAccent(parsed.uiAccent) ? parsed.uiAccent : DEFAULT_APP_PREFERENCES.uiAccent,
        };
    } catch {
        return DEFAULT_APP_PREFERENCES;
    }
}

export function storePreferences(preferences: AppPreferences) {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    localStorage.setItem('theme', preferences.uiTheme);
}

export function applyPreferences(preferences: AppPreferences) {
    document.documentElement.classList.toggle('dark', preferences.uiTheme === 'dark');
    document.documentElement.dataset.font = preferences.uiFont;
    document.documentElement.dataset.accent = preferences.uiAccent;
    storePreferences(preferences);
}

export function preferencesFromApi(data: {
    ui_theme?: unknown;
    ui_font?: unknown;
    ui_accent?: unknown;
}): AppPreferences {
    return {
        uiTheme: isUiTheme(data.ui_theme) ? data.ui_theme : DEFAULT_APP_PREFERENCES.uiTheme,
        uiFont: isUiFont(data.ui_font) ? data.ui_font : DEFAULT_APP_PREFERENCES.uiFont,
        uiAccent: isUiAccent(data.ui_accent) ? data.ui_accent : DEFAULT_APP_PREFERENCES.uiAccent,
    };
}

export function preferencesToApi(preferences: AppPreferences) {
    return {
        ui_theme: preferences.uiTheme,
        ui_font: preferences.uiFont,
        ui_accent: preferences.uiAccent,
    };
}
