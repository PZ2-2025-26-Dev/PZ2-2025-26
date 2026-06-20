import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const axiosClient = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    timeout: 10000,
});

axiosClient.interceptors.request.use(
    (config) => {
        if (config.data instanceof FormData) {
            if (config.headers?.set) {
                config.headers.set('Content-Type', undefined);
            } else if (config.headers) {
                delete config.headers['Content-Type'];
            }
        }

        const token = localStorage.getItem('token');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

axiosClient.interceptors.response.use(
    (response) => {

        return response;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            console.warn('Sesja wygasła lub brak uprawnień (401). Trwa wylogowywanie...');

            localStorage.removeItem('token');

        }

        return Promise.reject(error);
    }
);

export default axiosClient;
