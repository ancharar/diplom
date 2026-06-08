import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import client from '../api/client';
import Loader from '../components/Loader';
import JoinRequestModal from '../components/JoinRequestModal';
import type { Project, ProjectCatalog, Task } from '../types';
import styles from '../styles/Projects.module.scss';

export default function ProjectsPage() {
  const navigate = useNavigate();

  const [tab, setTab] = useState<'my' | 'catalog'>('my');
  const [roleFilter, setRoleFilter] = useState<'all' | 'leader' | 'member'>('all');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [catalog, setCatalog] = useState<ProjectCatalog[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinProjectId, setJoinProjectId] = useState<number | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());

  const DONE_STATUSES = ['complete', 'closed', 'done'];

  const projectColors = [
    '#e8f4f0',
    '#fef3e8',
    '#f0e8fe',
    '#fee8e8',
    '#e8f0fe',
    '#fefee8',
    '#e8fef0',
    '#fde8fe',
  ];

  const CHART_COLORS = {
    active: '#1f8b75',
    completed: '#8aa4ac',
    overdue: '#b45a5a',
  };

  const getProjectColor = (index: number) => {
    return projectColors[index % projectColors.length];
  };

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const monthTitle = calendarDate.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });

  const goPrevMonth = () => {
    setCalendarDate(
      new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1),
    );
  };

  const goNextMonth = () => {
    setCalendarDate(
      new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1),
    );
  };

  const goToday = () => {
    setCalendarDate(new Date());
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [projectsRes, catalogRes, tasksRes, meRes] = await Promise.allSettled([
          client.get<Project[]>('/projects/'),
          client.get<ProjectCatalog[]>('/projects/catalog/'),
          client.get<Task[]>('/users/me/tasks/'),
          client.get<{ id: number }>('/users/me/'),
        ]);

        if (projectsRes.status === 'fulfilled') {
          setProjects(projectsRes.value.data);
        }

        if (catalogRes.status === 'fulfilled') {
          setCatalog(catalogRes.value.data);
        }

        if (tasksRes.status === 'fulfilled') {
          setMyTasks(tasksRes.value.data);
        }

        if (meRes.status === 'fulfilled') {
          setCurrentUserId(meRes.value.data.id);
        }
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const fetchCatalog = async () => {
    try {
      const { data } = await client.get<ProjectCatalog[]>('/projects/catalog/');
      setCatalog(data);
    } catch {
      // ignore
    }
  };

  const handleCancelRequest = async (projectId: number) => {
    try {
      const { data } = await client.get<
        { id: number; project: number; status: string }[]
      >('/users/me/join-requests/');

      const req = data.find(
        (r) => r.project === projectId && r.status === 'pending',
      );

      if (req) {
        await client.delete(`/users/me/join-requests/${req.id}/`);
        fetchCatalog();
      }
    } catch {
      // ignore
    }
  };

  const deadlineMap = useMemo(() => {
    const map = new Map<string, Task[]>();

    myTasks.forEach((task) => {
      if (!task.deadline) return;
      const date = task.deadline.slice(0, 10);
      const current = map.get(date) || [];
      map.set(date, [...current, task]);
    });

    return map;
  }, [myTasks]);

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startOffset =
      firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const endOffset =
      lastDay.getDay() === 0 ? 0 : 7 - lastDay.getDay();

    const totalDays = startOffset + lastDay.getDate() + endOffset;
    const start = new Date(year, month, 1 - startOffset);

    return Array.from({ length: totalDays }, (_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      const iso = formatLocalDate(date);

      return {
        date,
        iso,
        isCurrentMonth: date.getMonth() === month,
        isToday: iso === formatLocalDate(new Date()),
        tasks: deadlineMap.get(iso) || [],
      };
    });
  }, [calendarDate, deadlineMap]);

  const filteredProjects = useMemo(() => {
    if (roleFilter === 'leader') return projects.filter((p) => p.owner?.id === currentUserId);
    if (roleFilter === 'member') return projects.filter((p) => p.owner?.id !== currentUserId);
    return projects;
  }, [projects, roleFilter, currentUserId]);

  const activeTasksCount = myTasks.filter(
    (task) => !DONE_STATUSES.includes(task.status),
  ).length;

  const completedTasksCount = myTasks.filter((task) =>
    DONE_STATUSES.includes(task.status),
  ).length;

  const overdueTasksCount = myTasks.filter((task) => {
    if (!task.deadline) return false;
    const deadlineDate = new Date(task.deadline);
    const today = new Date();
    deadlineDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return !DONE_STATUSES.includes(task.status) && deadlineDate < today;
  }).length;

  const pieData = [
    { name: 'Активные', value: activeTasksCount, color: CHART_COLORS.active },
    { name: 'Завершенные', value: completedTasksCount, color: CHART_COLORS.completed },
    { name: 'Просроченные', value: overdueTasksCount, color: CHART_COLORS.overdue },
  ].filter((item) => item.value > 0);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'in_progress': return 'В процессе';
      case 'completed':
      case 'complete':
      case 'closed':
      case 'done':
        return 'Завершён';
      case 'planning': return 'Планирование';
      default: return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'in_progress': return styles.statusInProgress;
      case 'completed':
      case 'complete':
      case 'closed':
      case 'done':
        return styles.statusCompleted;
      case 'planning': return styles.statusPlanning;
      default: return '';
    }
  };

  if (loading) return <Loader />;

  return (
    <div className={styles.fullPageContainer}>
      <div className={styles.dashboardGrid}>
        <section className={`${styles.dashboardBlock} ${styles.projectsBlock}`}>
          <div className={styles.blockHeader}>
            <h2>Текущие проекты</h2>
          </div>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === 'my' ? styles.tabActive : ''}`}
              onClick={() => setTab('my')}
            >
              Мои проекты
            </button>
            <button
              className={`${styles.tab} ${tab === 'catalog' ? styles.tabActive : ''}`}
              onClick={() => setTab('catalog')}
            >
              Каталог проектов
            </button>
          </div>

          {tab === 'my' && (
            <div className={styles.tabs} style={{ marginBottom: 12 }}>
              <button
                className={`${styles.tab} ${roleFilter === 'all' ? styles.tabActive : ''}`}
                onClick={() => setRoleFilter('all')}
              >
                Все
              </button>
              <button
                className={`${styles.tab} ${roleFilter === 'leader' ? styles.tabActive : ''}`}
                onClick={() => setRoleFilter('leader')}
              >
                Руководитель
              </button>
              <button
                className={`${styles.tab} ${roleFilter === 'member' ? styles.tabActive : ''}`}
                onClick={() => setRoleFilter('member')}
              >
                Участник
              </button>
            </div>
          )}

          <div className={styles.projectsScrollable}>
            {tab === 'my' && (
              <div className={styles.grid}>
                {filteredProjects.map((p, index) => (
                  <div
                    key={p.id}
                    className={styles.projectCard}
                    style={{ backgroundColor: getProjectColor(index) }}
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    <div className={styles.projectHeader}>
                      <h3 className={styles.projectTitle}>{p.title}</h3>
                      <span className={`${styles.projectStatus} ${getStatusClass(p.status)}`}>
                        {getStatusText(p.status)}
                      </span>
                    </div>

                    <div className={styles.projectDates}>
                      <span> {p.start_date} — {p.end_date}</span>
                    </div>

                    <div className={styles.projectArea}>
                      <span className={styles.areaBadge}>{p.area}</span>
                    </div>

                    {/* Участники проекта - Мои проекты */}
                    <div className={styles.projectMembers}>
                      <div className={styles.membersHeader}>
                        <span className={styles.membersIcon}>👥</span>
                        <span>Участники</span>
                      </div>
                      <div className={styles.membersList}>
                        {p.memberships?.slice(0, 3).map((m) => (
                          <div key={m.id} className={styles.memberAvatar} title={m.user.full_name}>
                            {m.user.full_name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {p.memberships?.length > 3 && (
                          <div className={styles.memberMore}>+{p.memberships.length - 3}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {filteredProjects.length === 0 && (
                  <div className={styles.emptyState}>
                    <p>{projects.length === 0 ? 'У вас пока нет проектов' : 'Нет проектов в этой категории'}</p>
                  </div>
                )}
              </div>
            )}

            {tab === 'catalog' && (
              <div className={styles.grid}>
                {catalog.map((p, index) => (
                  <div
                    key={p.id}
                    className={styles.projectCard}
                    style={{ backgroundColor: getProjectColor(index) }}
                  >
                    <div
                      className={styles.projectHeader}
                      onClick={() => navigate(`/projects/${p.id}`)}
                    >
                      <h3 className={styles.projectTitle}>{p.title}</h3>
                      <span className={styles.projectMemberCount}>
                         {p.members_count}
                      </span>
                    </div>

                    <div className={styles.projectArea}>
                      <span className={styles.areaBadge}>{p.area}</span>
                    </div>

                    {/* Участники проекта - Каталог (только количество, так как нет деталей) */}
                    <div className={styles.projectMembersCatalog}>
                      <div className={styles.membersHeader}>
                        <span className={styles.membersIcon}>👥</span>
                        <span>Участников: {p.members_count}</span>
                      </div>
                    </div>

                    <div className={styles.projectActions}>
                      {p.is_member ? (
                        <span className={styles.badgeMember}>✓ Вы участник</span>
                      ) : p.has_pending_request ? (
                        <button
                          className={styles.cancelButton}
                          onClick={() => handleCancelRequest(p.id)}
                        >
                          Отозвать заявку
                        </button>
                      ) : (
                        <button
                          className={styles.joinButton}
                          onClick={() => setJoinProjectId(p.id)}
                        >
                          + Подать заявку
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {catalog.length === 0 && (
                  <div className={styles.emptyState}>
                    <p>Каталог проектов пуст</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <div className={styles.rightContainer}>
          <section className={`${styles.dashboardBlock} ${styles.calendarBlock}`}>
            <div className={styles.calendarHeader}>
              <h2>Календарь задач</h2>
              <div className={styles.calendarControls}>
                <button type="button" onClick={goPrevMonth}>‹</button>
                <span>{monthTitle}</span>
                <button type="button" onClick={goNextMonth}>›</button>
                <button type="button" onClick={goToday}>Сегодня</button>
              </div>
            </div>

            <div className={styles.calendar}>
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
                <div key={day} className={styles.calendarWeekDay}>{day}</div>
              ))}
              {calendarDays.map((day) => (
                <div
                  key={day.iso}
                  className={`${styles.calendarDay} ${
                    !day.isCurrentMonth ? styles.calendarDayMuted : ''
                  } ${day.isToday ? styles.calendarDayToday : ''}`}
                >
                  <span className={styles.calendarDayNumber}>{day.date.getDate()}</span>
                  <div className={styles.calendarTasks}>
                    {day.tasks.slice(0, 2).map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        className={styles.taskDot}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        title={task.title}
                      >
                        {task.title}
                      </button>
                    ))}
                    {day.tasks.length > 2 && (
                      <div className={styles.moreTasks}>+{day.tasks.length - 2}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={`${styles.dashboardBlock} ${styles.statsBlock}`}>
            <h2>Статистика задач</h2>
            <div className={styles.statsContainer}>
              <div className={styles.chartWrapper}>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="45%"
                        innerRadius={42}
                        outerRadius={68}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value} задач`, 'Количество']}
                        contentStyle={{
                          borderRadius: 12,
                          border: 'none',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        align="center"
                        iconType="circle"
                        formatter={(value) => (
                          <span style={{ color: '#5f747c', fontSize: 11 }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className={styles.noStats}>Нет данных для отображения</div>
                )}
              </div>

              <div className={styles.statsNumbers}>
                <div className={styles.statNumberItem}>
                  <span className={styles.statNumberValue}>{activeTasksCount}</span>
                  <span className={styles.statNumberLabel}>Активные</span>
                </div>
                <div className={styles.statNumberItem}>
                  <span className={styles.statNumberValue}>{completedTasksCount}</span>
                  <span className={styles.statNumberLabel}>Завершенные</span>
                </div>
                <div className={styles.statNumberItem}>
                  <span className={styles.statNumberValue}>{overdueTasksCount}</span>
                  <span className={styles.statNumberLabel}>Просроченные</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {joinProjectId !== null && (
        <JoinRequestModal
          projectId={joinProjectId}
          onClose={() => setJoinProjectId(null)}
          onSuccess={() => {
            setJoinProjectId(null);
            fetchCatalog();
          }}
        />
      )}
    </div>
  );
}