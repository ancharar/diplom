import { useEffect, useState } from 'react';
import client from '../api/client';
import type { AdminUser, User } from '../types';
import styles from '../styles/Admin.module.scss';

interface AdminPageProps {
  user: User | null;
}

export default function AdminPage({ user }: AdminPageProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    try {
      const { data } = await client.get<AdminUser[]>('/users/admin/users/');
      setUsers(data);
    } catch {
      setError('Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleBlock = async (u: AdminUser) => {
    try {
      await client.patch(`/users/admin/users/${u.id}/`, {
        is_blocked: !u.is_blocked,
      });
      fetchUsers();
    } catch {
      setError('Ошибка обновления пользователя');
    }
  };

  const handleToggleAdmin = async (u: AdminUser) => {
    try {
      await client.patch(`/users/admin/users/${u.id}/`, {
        is_staff: !u.is_staff,
      });
      fetchUsers();
    } catch {
      setError('Ошибка обновления пользователя');
    }
  };

  const handleDelete = async (u: AdminUser) => {
    if (!window.confirm(`Удалить пользователя ${u.full_name}?`)) return;
    try {
      await client.delete(`/users/admin/users/${u.id}/`);
      fetchUsers();
    } catch {
      setError('Ошибка удаления пользователя');
    }
  };

  if (!user?.is_staff) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Доступ запрещен. Только для администраторов.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Администрирование</h1>
        <p className={styles.subtitle}>
          Управление пользователями системы
        </p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <p>Загрузка...</p>
      ) : (
        <table className={styles.userTable}>
          <thead>
            <tr>
              <th>ID</th>
              <th>ФИО</th>
              <th>Email</th>
              <th>Статус</th>
              <th>Роль</th>
              <th>Дата регистрации</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.full_name}</td>
                <td>{u.email}</td>
                <td>
                  {u.is_blocked ? (
                    <span className={`${styles.badge} ${styles.badgeBlocked}`}>
                      Заблокирован
                    </span>
                  ) : (
                    <span className={`${styles.badge} ${styles.badgeActive}`}>
                      Активен
                    </span>
                  )}
                </td>
                <td>
                  {u.is_staff && (
                    <span className={`${styles.badge} ${styles.badgeAdmin}`}>
                      Админ
                    </span>
                  )}
                </td>
                <td>{new Date(u.created_at).toLocaleDateString('ru')}</td>
                <td>
                  {u.id !== user.id && (
                    <div className={styles.actions}>
                      <button
                        className={`${styles.actionBtn} ${
                          u.is_blocked ? styles.unblockBtn : styles.blockBtn
                        }`}
                        onClick={() => handleToggleBlock(u)}
                      >
                        {u.is_blocked ? 'Разблокировать' : 'Заблокировать'}
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.adminBtn}`}
                        onClick={() => handleToggleAdmin(u)}
                      >
                        {u.is_staff ? 'Снять админа' : 'Назначить админом'}
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        onClick={() => handleDelete(u)}
                      >
                        Удалить
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
