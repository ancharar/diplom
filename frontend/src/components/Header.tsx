import { useLocation, useNavigate } from 'react-router-dom';
import type { User } from '../types';
import styles from '../styles/Header.module.scss';
import {
  NotificationsOutlined,
  AddOutlined,
} from '@mui/icons-material';

interface HeaderProps {
  user: User | null;
}

export default function Header({ user }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const getPageInfo = () => {
    if (location.pathname === '/projects') {
      return {
        title: 'Проекты',
        description: 'Обзор ваших проектов, задач и активности',
      };
    }

    if (location.pathname === '/projects/create') {
      return {
        title: 'Создание проекта',
        description: 'Заполните данные для добавления нового научного проекта',
      };
    }

    if (location.pathname.startsWith('/projects/')) {
      return {
        title: 'Детали проекта',
        description: 'Просмотр информации, участников, задач и материалов проекта',
      };
    }

    if (location.pathname.startsWith('/tasks/')) {
      return {
        title: 'Задача',
        description: 'Просмотр и управление задачей проекта',
      };
    }

    if (location.pathname.startsWith('/my-requests')) {
      return {
        title: 'Заявки',
        description: 'Отслеживание ваших заявок на участие в проектах',
      };
    }

    if (location.pathname.startsWith('/profile')) {
      return {
        title: 'Моя анкета',
        description: 'Личные данные, интересы и информация исследователя',
      };
    }

    return {
      title: 'ScienceFlow',
      description: 'Платформа для совместной научной работы',
    };
  };

  const page = getPageInfo();

  const handleUserClick = () => {
    navigate('/profile');
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.title}>{page.title}</h1>
        <p className={styles.description}>{page.description}</p>
      </div>

      <div className={styles.right}>
        <button
          className={styles.createBtn}
          onClick={() => navigate('/projects/create')}
        >
          <AddOutlined />
          <span>Проект</span>
        </button>

        <button className={styles.notificationBtn}>
          <NotificationsOutlined />
          <span className={styles.badge}>3</span>
        </button>

        <div className={styles.userCard} onClick={handleUserClick}>
          <div className={styles.avatar}>
            {user.full_name.charAt(0)}
          </div>

          <div className={styles.userText}>
            <span className={styles.name}>{user.full_name}</span>
            <span className={styles.email}>{user.email}</span>
          </div>
        </div>
      </div>
    </header>
  );
}