import axios, { type InternalAxiosRequestConfig } from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Retry конфигурация (UI_NF3)
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      _retryCount?: number;
    };

    // Retry для сетевых ошибок и 5xx (НЕ для 4xx)
    const isRetryable =
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      (error.response && error.response.status >= 500);

    if (isRetryable) {
      config._retryCount = config._retryCount || 0;
      if (config._retryCount < MAX_RETRIES) {
        config._retryCount += 1;
        await new Promise((res) =>
          setTimeout(res, RETRY_DELAY * config._retryCount!),
        );
        return client(config);
      }
    }

    // 401 — обновление токена
    if (error.response?.status === 401) {
      const refresh = localStorage.getItem('refresh');
      if (refresh && !config._retry) {
        config._retry = true;
        try {
          const { data } = await axios.post(
            'http://localhost:8000/api/v1/users/token/refresh/',
            { refresh },
          );
          localStorage.setItem('access', data.access);
          config.headers.Authorization = `Bearer ${data.access}`;
          return client(config);
        } catch {
          localStorage.removeItem('access');
          localStorage.removeItem('refresh');
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);

export default client;
