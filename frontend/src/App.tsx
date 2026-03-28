import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import client from './api/client';
import Header from './components/Header';
import ToastContainer from './components/Toast';
import PrivateRoute from './components/PrivateRoute';
import { ToastProvider } from './contexts/ToastContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import TaskDetailPage from './pages/TaskDetailPage';
import MyRequestsPage from './pages/MyRequestsPage';
import VKPage from './pages/VKPage';
import type { User } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    try {
      const token = localStorage.getItem('access');
      if (!token) return;
      const { data } = await client.get<User>('/users/me/');
      setUser(data);
    } catch {
      /* токен невалиден — игнорируем */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const handleLogin = (u: User) => setUser(u);
  const handleLogout = () => setUser(null);

  if (loading) return null;

  return (
    <ToastProvider>
      <BrowserRouter>
        <Header user={user} onLogout={handleLogout} />
        <ToastContainer />
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route path="/register" element={<RegisterPage onLogin={handleLogin} />} />
          <Route path="/projects" element={<PrivateRoute><ProjectsPage user={user} /></PrivateRoute>} />
          <Route path="/projects/:id" element={<PrivateRoute><ProjectDetailPage user={user} /></PrivateRoute>} />
          <Route path="/tasks/:id" element={<PrivateRoute><TaskDetailPage user={user} /></PrivateRoute>} />
          <Route path="/my-requests" element={<PrivateRoute><MyRequestsPage user={user} /></PrivateRoute>} />
          <Route path="/vk" element={<PrivateRoute><VKPage user={user} /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
