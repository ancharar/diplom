import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from 'react-router-dom';
import client from './api/client';
import ToastContainer from './components/Toast';
import PrivateRoute from './components/PrivateRoute';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { ToastProvider } from './contexts/ToastContext';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import TaskDetailPage from './pages/TaskDetailPage';
import MyRequestsPage from './pages/MyRequestsPage';
import ProfilePage from './pages/ProfilePage';
import CreateProjectPage from './pages/CreateProjectPage';
import MyReportsPage from './pages/MyReportsPage';
import ReportsPage from './pages/ReportsPage';
import AdminPage from './pages/AdminPage';
import PublicationsPage from './pages/PublicationsPage';
import GostConstructorPage from './pages/GostConstructorPage';
import ProjectJoinRequestsPage from './pages/ProjectJoinRequestsPage';
import LiteratureSection from './components/LiteratureSection';

import type { User } from './types';

function AppLayout({
  children,
  onLogout,
  user,
}: {
  children: React.ReactNode;
  onLogout: () => void;
  user: User | null;
}) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar onLogout={onLogout} user={user} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header user={user} />

        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function LiteraturePage() {
  const { id } = useParams<{ id: string }>();

  return <LiteratureSection projectId={id} />;
}

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
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const handleLogin = (u: User) => setUser(u);

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    setUser(null);
  };

  if (loading) return null;

  return (
    <ToastProvider>
      <BrowserRouter>
        <ToastContainer />

        <Routes>
          {/* AUTH */}
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route path="/register" element={<RegisterPage onLogin={handleLogin} />} />

          {/* PROJECTS */}
          <Route
            path="/projects"
            element={
              <PrivateRoute>
                <AppLayout onLogout={handleLogout} user={user}>
                  <ProjectsPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          {/* CREATE PROJECT */}
          <Route
            path="/projects/create"
            element={
              <PrivateRoute>
                <AppLayout onLogout={handleLogout} user={user}>
                  <CreateProjectPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/projects/:id"
            element={
              <PrivateRoute>
                <AppLayout onLogout={handleLogout} user={user}>
                  <ProjectDetailPage user={user} />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/projects/:id/literature"
            element={
              <PrivateRoute>
                <AppLayout onLogout={handleLogout} user={user}>
                  <LiteraturePage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/projects/:id/reports"
            element={
              <PrivateRoute>
                <AppLayout onLogout={handleLogout} user={user}>
                  <ReportsPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/projects/:id/gost"
            element={
              <PrivateRoute>
                <AppLayout onLogout={handleLogout} user={user}>
                  <GostConstructorPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/projects/:id/join-requests"
            element={
              <PrivateRoute>
                <AppLayout onLogout={handleLogout} user={user}>
                  <ProjectJoinRequestsPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          {/* TASKS */}
          <Route
            path="/tasks/:id"
            element={
              <PrivateRoute>
                <AppLayout onLogout={handleLogout} user={user}>
                  <TaskDetailPage user={user} />
                </AppLayout>
              </PrivateRoute>
            }
          />

          {/* REPORTS */}
          <Route
            path="/my-reports"
            element={
              <PrivateRoute>
                <AppLayout onLogout={handleLogout} user={user}>
                  <MyReportsPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          {/* PUBLICATIONS */}
          <Route
            path="/publications"
            element={
              <PrivateRoute>
                <AppLayout onLogout={handleLogout} user={user}>
                  <PublicationsPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          {/* REQUESTS */}
          <Route
            path="/my-requests"
            element={
              <PrivateRoute>
                <AppLayout onLogout={handleLogout} user={user}>
                  <MyRequestsPage />
                </AppLayout>
              </PrivateRoute>
            }
          />

          {/* ADMIN */}
          <Route
            path="/admin"
            element={
              <PrivateRoute>
                <AppLayout onLogout={handleLogout} user={user}>
                  <AdminPage user={user} />
                </AppLayout>
              </PrivateRoute>
            }
          />

          {/* PROFILE */}
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <AppLayout onLogout={handleLogout} user={user}>
                  <ProfilePage user={user} refreshUser={fetchMe} />
                </AppLayout>
              </PrivateRoute>
            }
          />

          {/* DEFAULT */}
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}