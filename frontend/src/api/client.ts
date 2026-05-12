// frontend/src/api/client.ts

import axios, { type InternalAxiosRequestConfig, type AxiosError } from 'axios';

// Интерфейс для расширенной конфигурации
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _retryCount?: number;
}

// Базовый URL API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Конфигурация ретраев
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Request interceptor: добавляем токен авторизации
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: обработка ошибок и обновление токена
client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as ExtendedAxiosRequestConfig;
    
    if (!config) {
      return Promise.reject(error);
    }

    // Ретраи для сетевых ошибок и ошибок сервера (5xx)
    const isRetryable =
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      (error.response && error.response.status >= 500);

    if (isRetryable) {
      config._retryCount = config._retryCount || 0;
      if (config._retryCount < MAX_RETRIES) {
        config._retryCount += 1;
        const delay = RETRY_DELAY * config._retryCount;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return client(config);
      }
    }

    // Обработка 401 Unauthorized - обновление токена
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refresh');
      
      if (refreshToken && !config._retry) {
        config._retry = true;
        
        try {
          const response = await axios.post(
            `${API_BASE_URL}/users/token/refresh/`,
            { refresh: refreshToken }
          );
          
          const { access } = response.data;
          localStorage.setItem('access', access);
          
          // Повторяем исходный запрос с новым токеном
          if (config.headers) {
            config.headers.Authorization = `Bearer ${access}`;
          }
          return client(config);
        } catch (refreshError) {
          // Если обновить токен не удалось - разлогиниваем пользователя
          localStorage.removeItem('access');
          localStorage.removeItem('refresh');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // Токена нет или ретрай уже был - разлогиниваемся
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default client;