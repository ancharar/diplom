import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
  Typography,
  Box,
} from '@mui/material';
import {
  EmailOutlined,
  LockOutlined,
  PersonOutlined,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import client from '../api/client';
import type { AuthResponse, User } from '../types';
import styles from '../styles/Auth.module.scss';

const MoleculeIcon = () => (
  <svg
    width="60"
    height="60"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={styles.logoIcon}
  >
    <circle cx="32" cy="32" r="10" fill="currentColor" />
    <circle cx="32" cy="32" r="16" stroke="currentColor" strokeWidth="4" fill="none" />

    <line x1="32" y1="16" x2="32" y2="6" stroke="currentColor" strokeWidth="4" />
    <line x1="32" y1="48" x2="32" y2="58" stroke="currentColor" strokeWidth="4" />
    <line x1="16" y1="32" x2="6" y2="32" stroke="currentColor" strokeWidth="4" />
    <line x1="48" y1="32" x2="58" y2="32" stroke="currentColor" strokeWidth="4" />
    <line x1="20" y1="20" x2="10" y2="10" stroke="currentColor" strokeWidth="4" />
    <line x1="44" y1="20" x2="54" y2="10" stroke="currentColor" strokeWidth="4" />
    <line x1="20" y1="44" x2="10" y2="54" stroke="currentColor" strokeWidth="4" />
    <line x1="44" y1="44" x2="54" y2="54" stroke="currentColor" strokeWidth="4" />

    <circle cx="32" cy="6" r="4" fill="currentColor" />
    <circle cx="32" cy="58" r="4" fill="currentColor" />
    <circle cx="6" cy="32" r="4" fill="currentColor" />
    <circle cx="58" cy="32" r="4" fill="currentColor" />
    <circle cx="10" cy="10" r="4" fill="currentColor" />
    <circle cx="54" cy="10" r="4" fill="currentColor" />
    <circle cx="10" cy="54" r="4" fill="currentColor" />
    <circle cx="54" cy="54" r="4" fill="currentColor" />
  </svg>
);

interface RegisterPageProps {
  onLogin: (user: User) => void;
}

export default function RegisterPage({ onLogin }: RegisterPageProps) {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    password2: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

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
      });

      localStorage.setItem('access', data.tokens.access);
      localStorage.setItem('refresh', data.tokens.refresh);

      onLogin(data.user);
      navigate('/projects');
    } catch (err) {
      const resp = (err as { response?: { data?: Record<string, string[] | string> } })
        .response?.data;

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
    <Box className={styles.authShell}>
      <Box className={styles.authContent}>
        <Box className={styles.brand}>
          <MoleculeIcon />

          <Typography className={styles.brandTitle}>
            ScienceFlow
          </Typography>

          <Typography className={styles.brandSubtitle}>
            Пространство для научных проектов
          </Typography>
        </Box>

        <Box component="form" onSubmit={handleSubmit} className={styles.form}>
          <TextField
            required
            fullWidth
            label="ФИО"
            value={form.full_name}
            onChange={(e) => update('full_name', e.target.value)}
            size="small"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutlined />
                  </InputAdornment>
                ),
              },
            }}
          />

          <TextField
            required
            fullWidth
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            size="small"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailOutlined />
                  </InputAdornment>
                ),
              },
            }}
          />

          <TextField
            required
            fullWidth
            label="Пароль"
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            size="small"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <TextField
            required
            fullWidth
            label="Повторите пароль"
            type={showPassword2 ? 'text' : 'password'}
            value={form.password2}
            onChange={(e) => update('password2', e.target.value)}
            size="small"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPassword2(!showPassword2)}
                    >
                      {showPassword2 ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          {error && (
            <Alert severity="error" className={styles.error}>
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            className={styles.submitButton}
          >
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </Button>

          <Typography className={styles.linkText}>
            Уже есть аккаунт? <Link to="/login">Войти</Link>
          </Typography>
        </Box>

      </Box>
    </Box>
  );
}