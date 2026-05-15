import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  HomeOutlined,
  MailOutlined,
  DescriptionOutlined,
  LogoutOutlined,
  MenuOpenOutlined,
  MenuOutlined,
  AssessmentOutlined,
  AdminPanelSettingsOutlined,
} from '@mui/icons-material';
import styles from '../styles/Sidebar.module.scss';
import type { User } from '../types';

const MoleculeIcon = () => (
  <svg
    width="40"
    height="40"
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

type SidebarProps = {
  onLogout?: () => void;
  user?: User | null;
};

export default function Sidebar({ onLogout, user }: SidebarProps) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    onLogout?.();
    navigate('/login');
  };

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.top}>
        <div className={styles.logoBlock}>
          <MoleculeIcon />
          <span className={styles.logoText}>ScienceFlow</span>
        </div>

        <button
          className={styles.toggleButton}
          onClick={() => setCollapsed((prev) => !prev)}
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          {collapsed ? <MenuOutlined /> : <MenuOpenOutlined />}
        </button>
      </div>

      <nav className={styles.nav}>
        <NavLink
          to="/projects"
          title="Проекты"
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.active : ''}`
          }
        >
          <HomeOutlined />
          <span>Проекты</span>
        </NavLink>

        <NavLink
          to="/my-requests"
          title="Заявки"
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.active : ''}`
          }
        >
          <MailOutlined />
          <span>Заявки</span>
        </NavLink>

        <NavLink
          to="/my-reports"
          title="Мои отчеты"
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.active : ''}`
          }
        >
          <AssessmentOutlined />
          <span>Мои отчеты</span>
        </NavLink>

        <NavLink
          to="/publications"
          title="Мои публикации"
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.active : ''}`
          }
        >
          <DescriptionOutlined />
          <span>Мои публикации</span>
        </NavLink>

        {user?.is_staff && (
          <NavLink
            to="/admin"
            title="Администрирование"
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <AdminPanelSettingsOutlined />
            <span>Админ-панель</span>
          </NavLink>
        )}
      </nav>

      <button className={styles.logoutButton} onClick={handleLogout} title="Выход">
        <LogoutOutlined />
        <span>Выход</span>
      </button>
    </aside>
  );
}
