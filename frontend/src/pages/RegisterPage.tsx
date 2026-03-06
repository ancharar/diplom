import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import type { AuthResponse, User } from '../types';
import styles from '../styles/Auth.module.scss';

interface RegisterPageProps {
  onLogin: (user: User) => void;
}

export default function RegisterPage({ onLogin }: RegisterPageProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', password2: '', role: 'member' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.password2) {
      setError('Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      const { data } = await client.post<AuthResponse>('/users/register/', {
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: form.role,
      });
      localStorage.setItem('access', data.tokens.access);
      localStorage.setItem('refresh', data.tokens.refresh);
      onLogin(data.user);
      navigate('/projects');
    } catch (err) {
      const resp = (err as { response?: { data?: Record<string, string[]> } }).response?.data;
      if (resp) {
        const messages = Object.values(resp).flat().join('. ');
        setError(messages);
      } else {
        setError('Ошибка регистрации');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Регистрация</h1>
        <div className="form-group">
          <label>ФИО</label>
          <input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Пароль</label>
          <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Подтверждение пароля</label>
          <input type="password" value={form.password2} onChange={(e) => update('password2', e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Роль</label>
          <select value={form.role} onChange={(e) => update('role', e.target.value)}>
            <option value="member">Участник</option>
            <option value="admin">Администратор</option>
          </select>
        </div>
        {error && <p className="error-msg">{error}</p>}
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Регистрация...' : 'Зарегистрироваться'}
        </button>
        <p className={styles.footer}>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </form>
    </div>
  );
}
