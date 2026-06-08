import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Delete as DeleteIcon } from '@mui/icons-material';
import client from '../api/client';
import Loader from '../components/Loader';
import { SkeletonTable } from '../components/Skeleton';
import StatusBadge from '../components/StatusBadge';
import JoinRequestModal from '../components/JoinRequestModal';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorMessages';
import type { Project, ProjectCatalog, Task, User } from '../types';
import styles from '../styles/ProjectDetail.module.scss';

interface ProjectDetailPageProps {
  user: User | null;
}

const ROLE_LABELS: Record<string, string> = {
  analyst: 'Аналитик',
  developer: 'Разработчик',
  tester: 'Тестировщик',
  designer: 'Дизайнер',
  researcher: 'Исследователь',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
};

type TabKey = 'allTasks' | 'myTasks';

export default function ProjectDetailPage({ user }: ProjectDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [projectFull, setProjectFull] = useState<Project | null>(null);
  const [projectCatalog, setProjectCatalog] = useState<ProjectCatalog | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<TabKey>('allTasks');

  const [loadedTabs, setLoadedTabs] = useState<Set<TabKey>>(new Set());
  const [tabLoading, setTabLoading] = useState<Set<TabKey>>(new Set());

  // Все задачи (только для владельца)
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  // Мои задачи (для всех участников)
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [myFilterStatus, setMyFilterStatus] = useState('');
  const [myFilterPriority, setMyFilterPriority] = useState('');

  const [memberForm, setMemberForm] = useState({ email: '', project_role: 'developer' });
  const [inviteSuccess, setInviteSuccess] = useState('');

  interface ProjectStats {
    total: number; todo: number; in_progress: number; done: number;
    overdue: number; completion_percent: number;
  }
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [memberError, setMemberError] = useState('');

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium', deadline: '', assignee_id: '' });
  const [taskError, setTaskError] = useState('');

  const [showJoinModal, setShowJoinModal] = useState(false);

  const isOwner = projectFull?.owner.id === user?.id;

  const fetchProject = async () => {
    const { data } = await client.get(`/projects/${id}/`);
    if ('memberships' in data) {
      setProjectFull(data as Project);
      setProjectCatalog(null);
      setIsMember(true);
    } else {
      setProjectCatalog(data as ProjectCatalog);
      setProjectFull(null);
      setIsMember(false);
    }
  };

  const fetchAllTasks = useCallback(async () => {
    if (!isOwner) return;
    try {
      const params: Record<string, string> = {};
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      const { data } = await client.get<Task[]>(`/projects/${id}/tasks/`, { params });
      setAllTasks(data);
    } catch { /* ignore */ }
  }, [id, filterStatus, filterPriority, isOwner]);

  const fetchMyTasks = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (myFilterStatus) params.status = myFilterStatus;
      if (myFilterPriority) params.priority = myFilterPriority;
      const { data } = await client.get<Task[]>(`/projects/${id}/my-tasks/`, { params });
      setMyTasks(data);
    } catch { /* ignore */ }
  }, [id, myFilterStatus, myFilterPriority]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await client.get(`/projects/${id}/stats/`);
      setStats(data);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    fetchProject().finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && isMember) fetchStats();
  }, [loading, isMember, fetchStats]);

  useEffect(() => {
    if (loading || !isMember) return;

    const loadTab = async (tab: TabKey) => {
      setTabLoading((prev) => new Set(prev).add(tab));
      try {
        if (tab === 'allTasks' && isOwner) {
          await fetchAllTasks();
        } else if (tab === 'myTasks') {
          await fetchMyTasks();
        }
      } finally {
        setTabLoading((prev) => { const s = new Set(prev); s.delete(tab); return s; });
        setLoadedTabs((prev) => new Set(prev).add(tab));
      }
    };

    if (!loadedTabs.has(activeTab)) {
      loadTab(activeTab);
    }
  }, [activeTab, loading, isMember, isOwner, fetchAllTasks, fetchMyTasks]);

  useEffect(() => {
    if (!loading && isOwner && loadedTabs.has('allTasks')) fetchAllTasks();
  }, [filterStatus, filterPriority, fetchAllTasks]);

  useEffect(() => {
    if (!loading && isMember && loadedTabs.has('myTasks')) fetchMyTasks();
  }, [myFilterStatus, myFilterPriority, fetchMyTasks]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError('');
    setInviteSuccess('');
    try {
      await client.post(`/projects/${id}/invite/`, {
        email: memberForm.email,
        project_role: memberForm.project_role,
      });
      setMemberForm({ email: '', project_role: 'developer' });
      setInviteSuccess('Приглашение отправлено');
    } catch (err) {
      showError(getErrorMessage(err));
      const resp = (err as { response?: { data?: Record<string, string[]> } }).response?.data;
      setMemberError(resp ? Object.values(resp).flat().join('. ') : 'Ошибка отправки приглашения');
    }
  };

  const handleRemoveMember = async (userId: number) => {
    try {
      await client.delete(`/projects/${id}/members/${userId}/`);
      fetchProject();
    } catch (err) {
      const resp = (err as { response?: { data?: Record<string, string[]> } }).response?.data;
      setMemberError(resp ? Object.values(resp).flat().join('. ') : 'Ошибка удаления');
    }
  };

  const resetTaskForm = () => {
    setTaskForm({ title: '', description: '', priority: 'medium', deadline: '', assignee_id: '' });
    setTaskError('');
  };

  const openTaskModal = () => {
    resetTaskForm();
    setShowTaskForm(true);
  };

  const closeTaskModal = () => {
    setShowTaskForm(false);
    resetTaskForm();
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError('');
    try {
      const payload: Record<string, string> = { title: taskForm.title, priority: taskForm.priority };
      if (taskForm.description) payload.description = taskForm.description;
      if (taskForm.deadline) payload.deadline = taskForm.deadline;
      if (taskForm.assignee_id) payload.assignee_id = taskForm.assignee_id;
      await client.post(`/projects/${id}/tasks/`, payload);
      closeTaskModal();
      showSuccess('Задача создана');
      fetchAllTasks();
      fetchMyTasks();
    } catch (err) {
      showError(getErrorMessage(err));
      const resp = (err as { response?: { data?: Record<string, string[]> } }).response?.data;
      setTaskError(resp ? Object.values(resp).flat().join('. ') : 'Ошибка создания задачи');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      await client.delete(`/tasks/${taskId}/`);
      showSuccess('Задача удалена');
      fetchAllTasks();
      fetchMyTasks();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  };

  if (loading) return <Loader />;

  // Не участник
  if (!isMember && projectCatalog) {
    return (
      <div className="container">
        <div className={styles.topActions}>
          <button
            className="btn btn-outline"
            onClick={() => navigate('/projects')}
            style={{ marginRight: 'auto' }}
          >
            ← Назад к проектам
          </button>
        </div>

        <div className={styles.topGrid}>
          <div className={styles.infoCard}>
            <h1 className={styles.projectTitle}>{projectCatalog.title}</h1>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}><span>Область:</span> {projectCatalog.area}</div>
              <div className={styles.infoItem}><span>Статус:</span> {projectCatalog.status === 'in_progress' ? 'В процессе' : 'Завершён'}</div>
              <div className={styles.infoItem}><span>Начало:</span> {projectCatalog.start_date}</div>
              <div className={styles.infoItem}><span>Окончание:</span> {projectCatalog.end_date}</div>
              <div className={styles.infoItem}><span>Участников:</span> {projectCatalog.members_count}</div>
              {projectCatalog.goal && <div className={styles.infoItemFull}><span>Цель:</span> {projectCatalog.goal}</div>}
              {projectCatalog.description && <div className={styles.infoItemFull}><span>Описание:</span> {projectCatalog.description}</div>}
            </div>
            <div style={{ marginTop: 16 }}>
              {projectCatalog.has_pending_request ? (
                <span className={styles.badgePending}>Заявка на рассмотрении</span>
              ) : (
                <button className="btn btn-primary" onClick={() => setShowJoinModal(true)}>Подать заявку</button>
              )}
            </div>
          </div>
        </div>
        {showJoinModal && (
          <JoinRequestModal
            projectId={projectCatalog.id}
            onClose={() => setShowJoinModal(false)}
            onSuccess={() => { setShowJoinModal(false); fetchProject(); }}
          />
        )}
      </div>
    );
  }

  const project = projectFull;
  if (!project) return <p>Проект не найден</p>;

  const isTabLoading = (tab: TabKey) => tabLoading.has(tab);

  return (
    <div className="container">
      {/* Верхняя панель с кнопками */}
      <div className={styles.topActions}>
        <button
          className="btn btn-outline"
          onClick={() => navigate('/projects')}
          style={{ marginRight: 'auto' }}
        >
          ← Назад к проектам
        </button>

        {isOwner && (
          <>
            <button
              className={`btn btn-outline ${styles.actionBtn}`}
              onClick={() => navigate(`/projects/${id}/reports`)}
            >
              Отчеты проекта
            </button>
            <button
              className={`btn btn-outline ${styles.actionBtn}`}
              onClick={() => navigate(`/projects/${id}/literature`)}
            >
              Литература проекта
            </button>
            <button
              className={`btn btn-outline ${styles.actionBtn}`}
              onClick={() => navigate(`/projects/${id}/join-requests`)}
            >
              Заявки на вступление
            </button>
          </>
        )}
      </div>

      {/* Виджет статистики */}
      {stats && (
        <div className={styles.statsWidget}>
          {[
            { label: 'Всего', value: stats.total },
            { label: 'К выполнению', value: stats.todo },
            { label: 'В процессе', value: stats.in_progress },
            { label: 'Выполнено', value: stats.done },
            { label: 'Просрочено', value: stats.overdue },
          ].map(({ label, value }) => (
            <div key={label} className={styles.statCard}>
              <span className={styles.statValue}>{value}</span>
              <span className={styles.statLabel}>{label}</span>
            </div>
          ))}
          <div className={styles.statCard} style={{ gridColumn: '1 / -1' }}>
            <div className={styles.progressBarLabel}>
              <span>Выполнение</span>
              <span>{stats.completion_percent}%</span>
            </div>
            <div className={styles.progressBarTrack}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${stats.completion_percent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Верхняя сетка: информация о проекте + участники */}
      <div className={styles.topGrid}>
        <div className={styles.infoCard}>
          <h1 className={styles.projectTitle}>{project.title}</h1>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}><span>Область:</span> {project.area}</div>
            <div className={styles.infoItem}><span>Статус:</span> {project.status === 'in_progress' ? 'В процессе' : 'Завершён'}</div>
            <div className={styles.infoItem}><span>Начало:</span> {project.start_date}</div>
            <div className={styles.infoItem}><span>Окончание:</span> {project.end_date}</div>
            {project.goal && <div className={styles.infoItemFull}><span>Цель:</span> {project.goal}</div>}
            {project.description && <div className={styles.infoItemFull}><span>Описание:</span> {project.description}</div>}
          </div>
        </div>

        <div className={styles.membersCard}>
          <div className={styles.cardHeader}>
            <h3>Участники проекта</h3>
            {isOwner && <span className={styles.ownerBadge}>Вы владелец</span>}
          </div>
          <div className={styles.memberList}>
            {project.memberships.map((m) => (
              <div key={m.id} className={styles.memberChip}>
                <span className={styles.memberName}>{m.user.full_name}</span>
                <span className={styles.memberRole}>{ROLE_LABELS[m.project_role] || m.project_role}</span>
                {isOwner && m.user.id !== project.owner.id && (
                  <button className={styles.removeBtn} onClick={() => handleRemoveMember(m.user.id)}>×</button>
                )}
              </div>
            ))}
          </div>
          {isOwner && (
            <form onSubmit={handleAddMember} className={styles.addMemberForm}>
              <input
                type="email"
                placeholder="Email пользователя"
                value={memberForm.email}
                onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                required
              />
              <select value={memberForm.project_role} onChange={(e) => setMemberForm({ ...memberForm, project_role: e.target.value })}>
                <option value="analyst">Аналитик</option>
                <option value="developer">Разработчик</option>
                <option value="tester">Тестировщик</option>
                <option value="designer">Дизайнер</option>
                <option value="researcher">Исследователь</option>
              </select>
              <button type="submit" className="btn btn-primary">Пригласить</button>
            </form>
          )}
          {memberError && <p className="error-msg">{memberError}</p>}
          {inviteSuccess && <p style={{ color: '#1f8b75', fontSize: 13, marginTop: 6 }}>{inviteSuccess}</p>}
        </div>
      </div>

      {/* Вкладки */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'allTasks' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('allTasks')}
        >
          Все задачи
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'myTasks' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('myTasks')}
        >
          Мои задачи
        </button>
      </div>

      {/* Вкладка: Все задачи */}
      {activeTab === 'allTasks' && (
        <div className={styles.tabContent}>
          {isOwner ? (
            <>
              <div className={styles.tabHeader}>
                <div className={styles.filters}>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="">Все статусы</option>
                    <option value="todo">К выполнению</option>
                    <option value="in_progress">В процессе</option>
                    <option value="done">Завершена</option>
                  </select>
                  <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
                    <option value="">Все приоритеты</option>
                    <option value="low">Низкий</option>
                    <option value="medium">Средний</option>
                    <option value="high">Высокий</option>
                  </select>
                </div>
                <button className="btn btn-primary" style={{ borderRadius: 12 }} onClick={openTaskModal}>
                  + Создать задачу
                </button>
              </div>

              {showTaskForm && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 1000,
                    background: 'rgba(15, 31, 36, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 20,
                  }}
                  onClick={closeTaskModal}
                >
                  <form
                    className={styles.taskForm}
                    onSubmit={handleCreateTask}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: 'min(560px, 100%)',
                      background: '#ffffff',
                      borderRadius: 24,
                      padding: 24,
                      boxShadow: '0 24px 80px rgba(15, 31, 36, 0.24)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                      <h3 style={{ margin: 0 }}>Новая задача</h3>
                    </div>

                    <input placeholder="Название" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required />
                    <textarea placeholder="Описание" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
                    <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                      <option value="low">Низкий</option>
                      <option value="medium">Средний</option>
                      <option value="high">Высокий</option>
                    </select>
                    <input type="date" value={taskForm.deadline} onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })} />
                    <select value={taskForm.assignee_id} onChange={(e) => setTaskForm({ ...taskForm, assignee_id: e.target.value })}>
                      <option value="">Назначить исполнителя</option>
                      {project.memberships.map((m) => (
                        <option key={m.user.id} value={m.user.id}>{m.user.full_name}</option>
                      ))}
                    </select>
                    {taskError && <p className="error-msg">{taskError}</p>}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                      <button type="button" className="btn btn-outline" onClick={closeTaskModal}>
                        Отмена
                      </button>
                      <button type="submit" className="btn btn-primary">
                        Создать
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {isTabLoading('allTasks') ? (
                <SkeletonTable rows={5} cols={5} />
              ) : (
                <table className={styles.taskTable}>
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Статус</th>
                      <th>Приоритет</th>
                      <th>Исполнитель</th>
                      <th>Дедлайн</th>
                      <th style={{ width: 50 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTasks.map((t) => (
                      <tr key={t.id}>
                        <td style={{ cursor: 'pointer' }} onClick={() => navigate(`/tasks/${t.id}`)}>
                          {t.title}
                        </td>
                        <td onClick={() => navigate(`/tasks/${t.id}`)}>
                          <StatusBadge status={t.status} />
                        </td>
                        <td onClick={() => navigate(`/tasks/${t.id}`)}>
                          {PRIORITY_LABELS[t.priority] || t.priority}
                        </td>
                        <td onClick={() => navigate(`/tasks/${t.id}`)}>
                          {t.assignee?.full_name || '—'}
                        </td>
                        <td onClick={() => navigate(`/tasks/${t.id}`)}>
                          {t.deadline || '—'}
                        </td>
                        <td>
                          <button
                            className={styles.deleteTaskBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Удалить задачу "${t.title}"?`)) {
                                handleDeleteTask(t.id);
                              }
                            }}
                            title="Удалить"
                          >
                            <DeleteIcon fontSize="small" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {allTasks.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center' }}>Нет задач</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <div className={styles.accessDenied}>Только владелец проекта может просматривать все задачи</div>
          )}
        </div>
      )}

      {/* Вкладка: Мои задачи */}
      {activeTab === 'myTasks' && (
        <div className={styles.tabContent}>
          <div className={styles.filters}>
            <select value={myFilterStatus} onChange={(e) => setMyFilterStatus(e.target.value)}>
              <option value="">Все статусы</option>
              <option value="todo">К выполнению</option>
              <option value="in_progress">В процессе</option>
              <option value="done">Завершена</option>
            </select>
            <select value={myFilterPriority} onChange={(e) => setMyFilterPriority(e.target.value)}>
              <option value="">Все приоритеты</option>
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
            </select>
          </div>

          {isTabLoading('myTasks') ? (
            <SkeletonTable rows={5} cols={5} />
          ) : (
            <table className={styles.taskTable}>
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Статус</th>
                  <th>Приоритет</th>
                  <th>Исполнитель</th>
                  <th>Дедлайн</th>
                </tr>
              </thead>
              <tbody>
                {myTasks.map((t) => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/tasks/${t.id}`)}>
                    <td>{t.title}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td>{PRIORITY_LABELS[t.priority] || t.priority}</td>
                    <td>{t.assignee?.full_name || '—'}</td>
                    <td>{t.deadline || '—'}</td>
                  </tr>
                ))}
                {myTasks.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center' }}>У вас нет задач в этом проекте</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showTaskForm && (
        <div
          role="presentation"
          onMouseDown={closeTaskModal}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(23, 50, 59, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-task-title"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 620,
              background: '#ffffff',
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
            }}
          >
            <h3 id="create-task-title" style={{ margin: '0 0 20px 0', color: '#17323b' }}>
              Создание задачи
            </h3>

            <form className={styles.taskForm} onSubmit={handleCreateTask} style={{ marginBottom: 0 }}>
              <input
                style={{ gridColumn: '1 / -1' }}
                placeholder="Название задачи *"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                required
              />

              <textarea
                placeholder="Описание"
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              />

              <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
              </select>

              <input type="date" value={taskForm.deadline} onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })} />

              <select value={taskForm.assignee_id} onChange={(e) => setTaskForm({ ...taskForm, assignee_id: e.target.value })}>
                <option value="">Назначить исполнителя</option>
                {project.memberships.map((m) => (
                  <option key={m.user.id} value={m.user.id}>{m.user.full_name}</option>
                ))}
              </select>

              {taskError && <p className="error-msg" style={{ gridColumn: '1 / -1' }}>{taskError}</p>}

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" className="btn btn-outline" style={{ borderRadius: 12 }} onClick={closeTaskModal}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary" style={{ borderRadius: 12 }}>
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}