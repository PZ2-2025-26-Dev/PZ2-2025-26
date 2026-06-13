import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';

const axiosClient = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    // Timeout dla zapytań (np. 10 sekund)
    timeout: 10000,
});

// Interceptor żądań (Request Interceptor)
// Uruchamia się przed wysłaniem każdego zapytania do backendu
axiosClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Interceptor odpowiedzi (Response Interceptor)
// Uruchamia się po otrzymaniu odpowiedzi, przed przekazaniem jej do komponentu/hooka
axiosClient.interceptors.response.use(
    (response) => {
        // Zwracamy tylko same dane, żeby nie musieć wszędzie pisać response.data
        return response;
    },
    (error) => {
        // Globalna obsługa błędów autoryzacji
        if (error.response && error.response.status === 401) {
            console.warn('Sesja wygasła lub brak uprawnień (401). Trwa wylogowywanie...');

            // Czyszczenie lokalnych danych sesji
            localStorage.removeItem('access_token');

            // Przekierowanie na stronę logowania (jeśli używamy React Routera)
            // window.location.href = '/login';
        }

        // Zwracamy błąd dalej, by mógł zostać obsłużony przez lokalnego bloka try..catch w custom hooku
        return Promise.reject(error);
    }
);

export default axiosClient;