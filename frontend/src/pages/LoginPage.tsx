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
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import client from '../api/client';
import type { AuthResponse, User } from '../types';
import styles from '../styles/Auth.module.scss';

// Иконка молекулы
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

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await client.post<AuthResponse>('/users/login/', {
        email,
        password,
      });

      localStorage.setItem('access', data.tokens.access);
      localStorage.setItem('refresh', data.tokens.refresh);

      onLogin(data.user);
      navigate('/projects');
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      setError(msg || 'Ошибка входа');
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
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            {loading ? 'Вход...' : 'Войти'}
          </Button>

          <Typography className={styles.linkText}>
            Нет аккаунта? <Link to="/register">Регистрация</Link>
          </Typography>
        </Box>

      </Box>
    </Box>
  );
}