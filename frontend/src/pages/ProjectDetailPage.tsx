import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import Loader from '../components/Loader';
import { SkeletonTable } from '../components/Skeleton';
import StatusBadge from '../components/StatusBadge';
import JoinRequestModal from '../components/JoinRequestModal';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorMessages';
import type { Project, ProjectCatalog, Task, User, JoinRequest, LiteratureSource, ProjectFile } from '../types';
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

const STATUS_LABELS: Record<string, string> = {
  pending: 'На рассмотрении',
  approved: 'Одобрена',
  rejected: 'Отклонена',
};

type TabKey = 'tasks' | 'literature' | 'requests';

export default function ProjectDetailPage({ user }: ProjectDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  /* Данные проекта — полный или краткий формат */
  const [projectFull, setProjectFull] = useState<Project | null>(null);
  const [projectCatalog, setProjectCatalog] = useState<ProjectCatalog | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  /* Активная вкладка */
  const [activeTab, setActiveTab] = useState<TabKey>('tasks');

  /* Флаги загрузки вкладок (lazy loading) */
  const [loadedTabs, setLoadedTabs] = useState<Set<TabKey>>(new Set());
  const [tabLoading, setTabLoading] = useState<Set<TabKey>>(new Set());

  /* Задачи (только для участников) */
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  /* Форма добавления участника */
  const [memberForm, setMemberForm] = useState({ user_id: '', project_role: 'developer' });
  const [memberError, setMemberError] = useState('');

  /* Форма создания задачи */
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium', deadline: '' });
  const [taskError, setTaskError] = useState('');

  /* Литературные источники */
  const [sources, setSources] = useState<LiteratureSource[]>([]);
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [sourceForm, setSourceForm] = useState({ title: '', authors: '', year: '', url: '', description: '', tags: '' });
  const [sourceError, setSourceError] = useState('');

  /* Файлы */
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [fileDesc, setFileDesc] = useState('');
  const [fileError, setFileError] = useState('');

  /* Заявки (для владельца) */
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [reqFilterStatus, setReqFilterStatus] = useState('pending');

  /* Модалка подачи заявки (для не-участников) */
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

  const fetchTasks = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      const { data } = await client.get<Task[]>(`/projects/${id}/tasks/`, { params });
      setTasks(data);
    } catch { /* не участник */ }
  }, [id, filterStatus, filterPriority]);

  const fetchSources = async () => {
    try {
      const { data } = await client.get<LiteratureSource[]>(`/projects/${id}/literature/sources/`);
      setSources(data);
    } catch { /* ignore */ }
  };

  const fetchFiles = async () => {
    try {
      const { data } = await client.get<ProjectFile[]>(`/projects/${id}/literature/files/`);
      setFiles(data);
    } catch { /* ignore */ }
  };

  const fetchJoinRequests = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (reqFilterStatus) params.status = reqFilterStatus;
      const { data } = await client.get<JoinRequest[]>(`/projects/${id}/join-requests/`, { params });
      setJoinRequests(data);
    } catch { /* не владелец */ }
  }, [id, reqFilterStatus]);

  /* Первоначальная загрузка проекта */
  useEffect(() => {
    fetchProject().finally(() => setLoading(false));
  }, [id]);

  /* Lazy loading: загружаем данные вкладки при переключении */
  useEffect(() => {
    if (loading || !isMember) return;

    const loadTab = async (tab: TabKey) => {
      setTabLoading((prev) => new Set(prev).add(tab));
      try {
        if (tab === 'tasks') {
          await fetchTasks();
        } else if (tab === 'literature') {
          await Promise.all([fetchSources(), fetchFiles()]);
        } else if (tab === 'requests' && isOwner) {
          await fetchJoinRequests();
        }
      } finally {
        setTabLoading((prev) => { const s = new Set(prev); s.delete(tab); return s; });
        setLoadedTabs((prev) => new Set(prev).add(tab));
      }
    };

    if (!loadedTabs.has(activeTab)) {
      loadTab(activeTab);
    }
  }, [activeTab, loading, isMember, isOwner]);

  /* Перезагрузка задач при смене фильтров */
  useEffect(() => {
    if (!loading && isMember && loadedTabs.has('tasks')) fetchTasks();
  }, [filterStatus, filterPriority, fetchTasks]);

  /* Перезагрузка заявок при смене фильтра */
  useEffect(() => {
    if (!loading && isOwner && loadedTabs.has('requests')) fetchJoinRequests();
  }, [reqFilterStatus, fetchJoinRequests]);

  /* Добавить участника */
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError('');
    try {
      await client.post(`/projects/${id}/members/`, {
        user_id: Number(memberForm.user_id),
        project_role: memberForm.project_role,
      });
      setMemberForm({ user_id: '', project_role: 'developer' });
      showSuccess('Участник добавлен');
      fetchProject();
    } catch (err) {
      showError(getErrorMessage(err));
      const resp = (err as { response?: { data?: Record<string, string[]> } }).response?.data;
      setMemberError(resp ? Object.values(resp).flat().join('. ') : 'Ошибка добавления');
    }
  };

  /* Удалить участника */
  const handleRemoveMember = async (userId: number) => {
    try {
      await client.delete(`/projects/${id}/members/${userId}/`);
      fetchProject();
    } catch (err) {
      const resp = (err as { response?: { data?: Record<string, string[]> } }).response?.data;
      setMemberError(resp ? Object.values(resp).flat().join('. ') : 'Ошибка удаления');
    }
  };

  /* Создать задачу */
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError('');
    try {
      const payload: Record<string, string> = { title: taskForm.title, priority: taskForm.priority };
      if (taskForm.description) payload.description = taskForm.description;
      if (taskForm.deadline) payload.deadline = taskForm.deadline;
      await client.post(`/projects/${id}/tasks/`, payload);
      setShowTaskForm(false);
      setTaskForm({ title: '', description: '', priority: 'medium', deadline: '' });
      showSuccess('Задача создана');
      fetchTasks();
    } catch (err) {
      showError(getErrorMessage(err));
      const resp = (err as { response?: { data?: Record<string, string[]> } }).response?.data;
      setTaskError(resp ? Object.values(resp).flat().join('. ') : 'Ошибка создания задачи');
    }
  };

  /* Создать источник */
  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setSourceError('');
    try {
      const payload: Record<string, unknown> = { title: sourceForm.title };
      if (sourceForm.authors) payload.authors = sourceForm.authors;
      if (sourceForm.year) payload.year = Number(sourceForm.year);
      if (sourceForm.url) payload.url = sourceForm.url;
      if (sourceForm.description) payload.description = sourceForm.description;
      if (sourceForm.tags) payload.tags = sourceForm.tags.split(',').map((t) => t.trim());
      await client.post(`/projects/${id}/literature/sources/`, payload);
      setShowSourceForm(false);
      setSourceForm({ title: '', authors: '', year: '', url: '', description: '', tags: '' });
      showSuccess('Источник добавлен');
      fetchSources();
    } catch {
      setSourceError('Ошибка создания источника');
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    try {
      await client.delete(`/projects/${id}/literature/sources/${sourceId}/`);
      fetchSources();
    } catch { /* ignore */ }
  };

  /* Загрузить файл */
  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFileError('');
    const form = e.target as HTMLFormElement;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) { setFileError('Выберите файл'); return; }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', fileDesc);
    try {
      await client.post(`/projects/${id}/literature/files/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFileDesc('');
      form.reset();
      showSuccess('Файл загружен');
      fetchFiles();
    } catch {
      setFileError('Ошибка загрузки файла');
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await client.delete(`/projects/${id}/literature/files/${fileId}/`);
      fetchFiles();
    } catch { /* ignore */ }
  };

  /* Рассмотрение заявки */
  const handleReviewRequest = async (reqId: number, action: 'approved' | 'rejected', assignedRole?: string) => {
    try {
      const payload: Record<string, string> = { action };
      if (assignedRole) payload.assigned_role = assignedRole;
      await client.patch(`/projects/${id}/join-requests/${reqId}/`, payload);
      showSuccess(action === 'approved' ? 'Заявка одобрена' : 'Заявка отклонена');
      fetchJoinRequests();
      fetchProject();
    } catch { /* ignore */ }
  };

  if (loading) return <Loader />;

  /* ═══ НЕ УЧАСТНИК — краткая информация ═══ */
  if (!isMember && projectCatalog) {
    return (
      <div className="container">
        <h1 className="page-title">{projectCatalog.title}</h1>
        <div className={`card ${styles.info}`}>
          <div className={styles.infoItem}><span>Область:</span> {projectCatalog.area}</div>
          <div className={styles.infoItem}><span>Статус:</span> {projectCatalog.status === 'in_progress' ? 'В процессе' : 'Завершён'}</div>
          <div className={styles.infoItem}><span>Начало:</span> {projectCatalog.start_date}</div>
          <div className={styles.infoItem}><span>Окончание:</span> {projectCatalog.end_date}</div>
          <div className={styles.infoItem}><span>Участников:</span> {projectCatalog.members_count}</div>
          {projectCatalog.goal && <div className={styles.infoItem} style={{ gridColumn: '1 / -1' }}><span>Цель:</span> {projectCatalog.goal}</div>}
          {projectCatalog.description && <div className={styles.infoItem} style={{ gridColumn: '1 / -1' }}><span>Описание:</span> {projectCatalog.description}</div>}
        </div>
        <div style={{ marginTop: 16 }}>
          {projectCatalog.has_pending_request ? (
            <span className={styles.badgePending}>Заявка на рассмотрении</span>
          ) : (
            <button className="btn btn-primary" onClick={() => setShowJoinModal(true)}>
              Подать заявку
            </button>
          )}
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

  /* ═══ УЧАСТНИК — полная информация ═══ */
  return (
    <div className="container">
      <h1 className="page-title">{project.title}</h1>

      {/* Информация о проекте */}
      <div className={`card ${styles.info}`}>
        <div className={styles.infoItem}><span>Область:</span> {project.area}</div>
        <div className={styles.infoItem}><span>Статус:</span> {project.status === 'in_progress' ? 'В процессе' : 'Завершён'}</div>
        <div className={styles.infoItem}><span>Начало:</span> {project.start_date}</div>
        <div className={styles.infoItem}><span>Окончание:</span> {project.end_date}</div>
        {project.goal && <div className={styles.infoItem} style={{ gridColumn: '1 / -1' }}><span>Цель:</span> {project.goal}</div>}
        {project.description && <div className={styles.infoItem} style={{ gridColumn: '1 / -1' }}><span>Описание:</span> {project.description}</div>}
      </div>

      {/* Участники */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Участники</div>
        <div className={styles.memberList}>
          {project.memberships.map((m) => (
            <div key={m.id} className={styles.memberChip}>
              {m.user.full_name} ({ROLE_LABELS[m.project_role] || m.project_role})
              {isOwner && m.user.id !== project.owner.id && (
                <button className={styles.removeBtn} onClick={() => handleRemoveMember(m.user.id)}>×</button>
              )}
            </div>
          ))}
        </div>

        {isOwner && (
          <form onSubmit={handleAddMember} style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>ID пользователя</label>
              <input type="number" value={memberForm.user_id} onChange={(e) => setMemberForm({ ...memberForm, user_id: e.target.value })} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Роль</label>
              <select value={memberForm.project_role} onChange={(e) => setMemberForm({ ...memberForm, project_role: e.target.value })}>
                <option value="analyst">Аналитик</option>
                <option value="developer">Разработчик</option>
                <option value="tester">Тестировщик</option>
                <option value="designer">Дизайнер</option>
                <option value="researcher">Исследователь</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary">Добавить</button>
          </form>
        )}
        {memberError && <p className="error-msg">{memberError}</p>}
      </div>

      {/* Вкладки */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'tasks' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Задачи
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'literature' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('literature')}
        >
          Библиотека
        </button>
        {isOwner && (
          <button
            className={`${styles.tab} ${activeTab === 'requests' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            Заявки
          </button>
        )}
      </div>

      {/* Вкладка: Задачи */}
      {activeTab === 'tasks' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Задачи
            <button className="btn btn-primary" onClick={() => setShowTaskForm(!showTaskForm)}>
              {showTaskForm ? 'Отмена' : 'Создать задачу'}
            </button>
          </div>

          {showTaskForm && (
            <form className="card" onSubmit={handleCreateTask} style={{ marginBottom: 16 }}>
              <div className="form-group"><label>Название</label><input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required /></div>
              <div className="form-group"><label>Описание</label><textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Приоритет</label>
                  <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                    <option value="low">Низкий</option>
                    <option value="medium">Средний</option>
                    <option value="high">Высокий</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}><label>Дедлайн</label><input type="date" value={taskForm.deadline} onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })} /></div>
              </div>
              {taskError && <p className="error-msg">{taskError}</p>}
              <button type="submit" className="btn btn-primary">Создать</button>
            </form>
          )}

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

          {isTabLoading('tasks') ? (
            <SkeletonTable rows={5} cols={5} />
          ) : (
            <table>
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
                {tasks.map((t) => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/tasks/${t.id}`)}>
                    <td>{t.title}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td>{PRIORITY_LABELS[t.priority] || t.priority}</td>
                    <td>{t.assignee?.full_name || '—'}</td>
                    <td>{t.deadline || '—'}</td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center' }}>Нет задач</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Вкладка: Библиотека */}
      {activeTab === 'literature' && (
        <>
          {/* Литературные источники (MongoDB) */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              Литературные источники
              <button className="btn btn-primary" onClick={() => setShowSourceForm(!showSourceForm)}>
                {showSourceForm ? 'Отмена' : 'Добавить источник'}
              </button>
            </div>

            {showSourceForm && (
              <form className="card" onSubmit={handleCreateSource} style={{ marginBottom: 16 }}>
                <div className="form-group"><label>Название</label><input value={sourceForm.title} onChange={(e) => setSourceForm({ ...sourceForm, title: e.target.value })} required /></div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="form-group" style={{ flex: 2 }}><label>Авторы</label><input value={sourceForm.authors} onChange={(e) => setSourceForm({ ...sourceForm, authors: e.target.value })} /></div>
                  <div className="form-group" style={{ flex: 1 }}><label>Год</label><input type="number" value={sourceForm.year} onChange={(e) => setSourceForm({ ...sourceForm, year: e.target.value })} /></div>
                </div>
                <div className="form-group"><label>URL</label><input value={sourceForm.url} onChange={(e) => setSourceForm({ ...sourceForm, url: e.target.value })} /></div>
                <div className="form-group"><label>Описание</label><textarea value={sourceForm.description} onChange={(e) => setSourceForm({ ...sourceForm, description: e.target.value })} /></div>
                <div className="form-group"><label>Теги (через запятую)</label><input value={sourceForm.tags} onChange={(e) => setSourceForm({ ...sourceForm, tags: e.target.value })} /></div>
                {sourceError && <p className="error-msg">{sourceError}</p>}
                <button type="submit" className="btn btn-primary">Добавить</button>
              </form>
            )}

            {isTabLoading('literature') ? (
              <SkeletonTable rows={4} cols={5} />
            ) : (
              <table>
                <thead>
                  <tr><th>Название</th><th>Авторы</th><th>Год</th><th>Теги</th><th></th></tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.id}>
                      <td>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}</td>
                      <td>{s.authors || '—'}</td>
                      <td>{s.year || '—'}</td>
                      <td>{s.tags?.join(', ') || '—'}</td>
                      <td><button className={styles.removeBtn} onClick={() => handleDeleteSource(s.id)}>×</button></td>
                    </tr>
                  ))}
                  {sources.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center' }}>Нет источников</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Файлы (MongoDB) */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Файлы и документы</div>
            <form onSubmit={handleUploadFile} style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label>Файл</label>
                <input type="file" required />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label>Описание</label>
                <input value={fileDesc} onChange={(e) => setFileDesc(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary">Загрузить</button>
            </form>
            {fileError && <p className="error-msg">{fileError}</p>}

            {isTabLoading('literature') ? (
              <SkeletonTable rows={3} cols={5} />
            ) : (
              <table>
                <thead>
                  <tr><th>Имя файла</th><th>Тип</th><th>Размер</th><th>Описание</th><th></th></tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.id}>
                      <td>{f.filename}</td>
                      <td>{f.content_type}</td>
                      <td>{(f.size / 1024).toFixed(1)} КБ</td>
                      <td>{f.description || '—'}</td>
                      <td><button className={styles.removeBtn} onClick={() => handleDeleteFile(f.id)}>×</button></td>
                    </tr>
                  ))}
                  {files.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center' }}>Нет файлов</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Вкладка: Заявки (только для владельца) */}
      {activeTab === 'requests' && isOwner && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Заявки на вступление</div>
          <div className={styles.filters}>
            <select value={reqFilterStatus} onChange={(e) => setReqFilterStatus(e.target.value)}>
              <option value="">Все</option>
              <option value="pending">На рассмотрении</option>
              <option value="approved">Одобренные</option>
              <option value="rejected">Отклонённые</option>
            </select>
          </div>

          {isTabLoading('requests') ? (
            <SkeletonTable rows={3} cols={6} />
          ) : (
            <table>
              <thead>
                <tr><th>ФИО</th><th>Желаемая роль</th><th>Сообщение</th><th>Дата</th><th>Статус</th><th></th></tr>
              </thead>
              <tbody>
                {joinRequests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.user.full_name}</td>
                    <td>{ROLE_LABELS[r.desired_role] || r.desired_role}</td>
                    <td>{r.message || '—'}</td>
                    <td>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td>{STATUS_LABELS[r.status] || r.status}</td>
                    <td>
                      {r.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm btn-primary" onClick={() => handleReviewRequest(r.id, 'approved')}>
                            Одобрить
                          </button>
                          <button className="btn btn-sm" onClick={() => handleReviewRequest(r.id, 'rejected')}>
                            Отклонить
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {joinRequests.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center' }}>Нет заявок</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
