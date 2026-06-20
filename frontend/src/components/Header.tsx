import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NotificationsOutlined, AddOutlined } from '@mui/icons-material';
import client from '../api/client';
import type { Notification, User } from '../types';
import styles from '../styles/Header.module.scss';

interface HeaderProps {
  user: User | null;
}

export default function Header({ user }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);

  const fetchUnreadCount = async () => {
    try {
      const { data } = await client.get<Notification[]>('/notifications/?unread=true');
      if (isMounted.current) {
        setUnreadCount(data.length);
      }
    } catch {
      // silent
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data } = await client.get<Notification[]>('/notifications/');
      if (isMounted.current) {
        setNotifications(data.slice(0, 20));
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const loadInitialCount = async () => {
      await fetchUnreadCount();
    };
    loadInitialCount();

    const interval = setInterval(fetchUnreadCount, 30000);
    
    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleBellClick = async () => {
    if (!showDropdown) {
      await fetchNotifications();
    }
    setShowDropdown((v) => !v);
  };

  const handleReadAll = async () => {
    await client.post('/notifications/read-all/');
    if (isMounted.current) {
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
  };

  const handleRead = async (id: number) => {
    await client.post(`/notifications/${id}/read/`);
    if (isMounted.current) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  };

  const handleAccept = async (n: Notification) => {
    if (!n.invitation) return;
    await client.post(`/projects/invitations/${n.invitation.id}/accept/`);
    await handleRead(n.id);
    if (isMounted.current) {
      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    }
  };

  const handleDecline = async (n: Notification) => {
    if (!n.invitation) return;
    await client.post(`/projects/invitations/${n.invitation.id}/decline/`);
    await handleRead(n.id);
    if (isMounted.current) {
      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    }
  };

  if (!user) return null;

  const getPageInfo = () => {
    if (location.pathname === '/projects') {
      return { title: 'Проекты', description: 'Обзор ваших проектов, задач и активности' };
    }
    if (location.pathname === '/projects/create') {
      return { title: 'Создание проекта', description: 'Заполните данные для добавления нового научного проекта' };
    }
    if (location.pathname.includes('/literature')) {
      return { title: 'Литература', description: 'Управление литературными источниками проекта' };
    }
    if (location.pathname.startsWith('/my-reports')) {
      return { title: 'Мои отчеты', description: 'Загружайте и отслеживайте статус ваших научных отчетов' };
    }
    if (location.pathname.includes('/reports')) {
      return { title: 'Отчеты', description: 'Управление отчетностью по проекту' };
    }
    if (location.pathname.includes('/join-requests')) {
      return { title: 'Заявки на вступление', description: 'Управление заявками пользователей на участие в проекте' };
    }
    if (location.pathname.startsWith('/projects/')) {
      return { title: 'Детали проекта', description: 'Просмотр информации, участников, задач и материалов проекта' };
    }
    if (location.pathname.startsWith('/tasks/')) {
      return { title: 'Задача', description: 'Просмотр и управление задачей проекта' };
    }
    if (location.pathname.startsWith('/my-requests')) {
      return { title: 'Мои заявки', description: 'Отслеживание ваших заявок на участие в проектах' };
    }
    if (location.pathname.startsWith('/profile')) {
      return { title: 'Профиль', description: 'Информация о текущем пользователе' };
    }
    if (location.pathname.startsWith('/publications')) {
      return { title: 'Мои публикации', description: 'Управление списком моих научных публикаций' };
    }
    return { title: 'ScienceFlow', description: 'Платформа для совместной научной работы' };
  };

  const page = getPageInfo();

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.title}>{page.title}</h1>
        <p className={styles.description}>{page.description}</p>
      </div>

      <div className={styles.right}>
        <button className={styles.createBtn} onClick={() => navigate('/projects/create')}>
          <AddOutlined />
          <span>Проект</span>
        </button>

        <div className={styles.notificationWrapper} ref={dropdownRef}>
          <button className={styles.notificationBtn} onClick={handleBellClick}>
            <NotificationsOutlined />
            {unreadCount > 0 && (
              <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>

          {showDropdown && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHeader}>
                <span className={styles.dropdownTitle}>Уведомления</span>
                {unreadCount > 0 && (
                  <button className={styles.readAllBtn} onClick={handleReadAll}>
                    Прочитать все
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className={styles.emptyNotifications}>Уведомлений нет</div>
              ) : (
                <div className={styles.notificationList}>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`${styles.notificationItem} ${n.is_read ? styles.read : styles.unread}`}
                      onClick={() => {
                        if (!n.is_read) handleRead(n.id);
                        if (n.notification_type === 'task_assigned' && n.task) {
                          navigate(`/tasks/${n.task.id}`);
                          setShowDropdown(false);
                        }
                      }}
                    >
                      <div className={styles.notifTitle}>{n.title}</div>
                      {n.message && <div className={styles.notifMessage}>{n.message}</div>}
                      <div className={styles.notifDate}>{formatDate(n.created_at)}</div>

                      {n.notification_type === 'project_invitation' && n.invitation?.status === 'pending' && (
                        <div className={styles.inviteActions} onClick={(e) => e.stopPropagation()}>
                          <button
                            className={styles.acceptBtn}
                            onClick={() => handleAccept(n)}
                          >
                            Принять
                          </button>
                          <button
                            className={styles.declineBtn}
                            onClick={() => handleDecline(n)}
                          >
                            Отклонить
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.userCard} onClick={() => navigate('/profile')}>
          <div className={styles.avatar}>{user.full_name.charAt(0)}</div>
          <div className={styles.userText}>
            <span className={styles.name}>{user.full_name}</span>
            <span className={styles.email}>{user.email}</span>
          </div>
        </div>
      </div>
    </header>
  );
}