import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';

export const login = (data) =>
    axiosClient.post(ENDPOINTS.AUTH.LOGIN, data);

export const register = (data) =>
    axiosClient.post(ENDPOINTS.AUTH.REGISTER, data);

export const googleLogin = () => {
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
    const params = new URLSearchParams({ frontend_url: window.location.origin });
    window.location.href = `${apiUrl}${ENDPOINTS.AUTH.GOOGLE_LOGIN}?${params.toString()}`;
};

export const googleCallback = (data) =>
    axiosClient.post(ENDPOINTS.AUTH.GOOGLE_CALLBACK, data);
