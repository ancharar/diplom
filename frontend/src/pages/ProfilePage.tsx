import { useState } from 'react';
import client from '../api/client';
import type { User } from '../types';
import styles from '../styles/Profile.module.scss';

interface ProfilePageProps {
  user: User | null;
  refreshUser: () => Promise<void>;
}

export default function ProfilePage({
  user,
  refreshUser,
}: ProfilePageProps) {
  const [editMode, setEditMode] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p>Пользователь не найден</p>
        </div>
      </div>
    );
  }

  const handleCancel = () => {
    setFullName(user.full_name || '');
    setEmail(user.email || '');
    setError('');
    setEditMode(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await client.patch('/users/me/', {
        full_name: fullName,
        email,
      });

      await refreshUser();
      setEditMode(false);
    } catch (err) {
      const resp = (
        err as {
          response?: {
            data?: Record<string, string[] | string>;
          };
        }
      ).response?.data;

      if (resp) {
        setError(
          Object.values(resp)
            .flat()
            .join('. '),
        );
      } else {
        setError('Ошибка сохранения профиля');
      }
    } finally {
      setLoading(false);
    }
  };

  const initials = user.full_name
    ? user.full_name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : user.email.slice(0, 2).toUpperCase();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
      </div>

      <div className={styles.card}>
        <div className={styles.profileTop}>
          <div className={styles.avatar}>{initials}</div>

          <div>
            <h2>{user.full_name || 'Без имени'}</h2>
            <p>{user.email}</p>
          </div>
        </div>

        {editMode ? (
          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.formGroup}>
              <label>ФИО</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Введите ФИО"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Введите email"
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              <button
                type="submit"
                className={styles.saveBtn}
                disabled={loading}
              >
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>

              <button
                type="button"
                className={styles.cancelBtn}
                onClick={handleCancel}
                disabled={loading}
              >
                Отмена
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.info}>
            <div className={styles.infoRow}>
              <span>ФИО</span>
              <strong>{user.full_name || '—'}</strong>
            </div>

            <div className={styles.infoRow}>
              <span>Email</span>
              <strong>{user.email}</strong>
            </div>

            {'role' in user && (
              <div className={styles.infoRow}>
                <span>Роль</span>
                <strong>{String(user.role)}</strong>
              </div>
            )}

            <button
              className={styles.editBtn}
              onClick={() => setEditMode(true)}
            >
              Редактировать профиль
            </button>
          </div>
        )}
      </div>
    </div>
  );
}