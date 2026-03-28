import { Link, useNavigate } from 'react-router-dom';
import type { User } from '../types';
import styles from '../styles/Header.module.scss';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    onLogout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <Link to="/projects" className={styles.link}>Проекты</Link>
        <Link to="/my-requests" className={styles.link}>Мои заявки</Link>
        <Link to="/vk" className={styles.link}>VK-публикации</Link>
      </nav>
      <div className={styles.userInfo}>
        <span className={styles.name}>{user.full_name}</span>
        {/* ROLE_DISABLED: <span className={styles.role}>{user.role === 'admin' ? 'Админ' : 'Участник'}</span> */}
        <button onClick={handleLogout} className={styles.logoutBtn}>Выйти</button>
      </div>
    </header>
  );
}
