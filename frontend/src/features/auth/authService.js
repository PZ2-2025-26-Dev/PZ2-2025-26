import axiosClient from '../../api/axiosClient';
import { ENDPOINTS } from '../../api/endpoints';

export const login = (data) =>
    axiosClient.post(ENDPOINTS.AUTH.LOGIN, data);

export const register = (data) =>
    axiosClient.post(ENDPOINTS.AUTH.REGISTER, data);

export const googleLogin = () =>
    window.location.href =
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}${ENDPOINTS.AUTH.GOOGLE_LOGIN}`;

export const googleCallback = (data) =>
    axiosClient.post(ENDPOINTS.AUTH.GOOGLE_CALLBACK, data);