import type { AxiosError } from 'axios';

/**
 * Преобразование API-ошибок в читаемые сообщения на русском.
 */
export function getErrorMessage(error: unknown): string {
  const axiosErr = error as AxiosError<Record<string, unknown>>;

  if (axiosErr.code === 'ERR_NETWORK') {
    return 'Нет подключения к серверу. Проверьте интернет-соединение.';
  }
  if (axiosErr.code === 'ECONNABORTED') {
    return 'Превышено время ожидания ответа от сервера.';
  }

  const status = axiosErr.response?.status;
  if (status === 500) {
    return 'Ошибка сервера. Попробуйте повторить позже.';
  }
  if (status === 403) {
    return 'У вас нет прав для выполнения этого действия.';
  }
  if (status === 404) {
    return 'Запрашиваемый ресурс не найден.';
  }

  const data = axiosErr.response?.data;
  if (typeof data === 'string') return data;
  if (data?.detail) return String(data.detail);
  if (data?.error) return String(data.error);
  if (data?.non_field_errors) {
    return (data.non_field_errors as string[]).join('. ');
  }

  // Попытка собрать ошибки полей
  if (data && typeof data === 'object') {
    const msgs = Object.values(data)
      .flat()
      .filter((v) => typeof v === 'string');
    if (msgs.length) return msgs.join('. ');
  }

  return 'Произошла неизвестная ошибка.';
}
