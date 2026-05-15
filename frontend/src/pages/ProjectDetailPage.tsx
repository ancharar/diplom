import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import Loader from '../components/Loader';
import { SkeletonTable } from '../components/Skeleton';
import StatusBadge from '../components/StatusBadge';
import JoinRequestModal from '../components/JoinRequestModal';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorMessages';
import type { Project, ProjectCatalog, Task, User, LiteratureSource, ProjectFile, ArxivResult } from '../types';
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

type TabKey = 'allTasks' | 'myTasks' | 'literature';

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

  const [memberForm, setMemberForm] = useState({ user_id: '', project_role: 'developer' });
  const [memberError, setMemberError] = useState('');

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium', deadline: '', assignee_id: '' });
  const [taskError, setTaskError] = useState('');

  const [sources, setSources] = useState<LiteratureSource[]>([]);
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [sourceForm, setSourceForm] = useState({ title: '', authors: '', year: '', url: '', description: '', tags: '' });
  const [sourceError, setSourceError] = useState('');

  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [fileDesc, setFileDesc] = useState('');
  const [fileError, setFileError] = useState('');

  // arXiv поиск
  const [arxivQuery, setArxivQuery] = useState('');
  const [arxivResults, setArxivResults] = useState<ArxivResult[]>([]);
  const [arxivLoading, setArxivLoading] = useState(false);
  const [arxivError, setArxivError] = useState('');
  const [arxivSaving, setArxivSaving] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    fetchProject().finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (loading || !isMember) return;

    const loadTab = async (tab: TabKey) => {
      setTabLoading((prev) => new Set(prev).add(tab));
      try {
        if (tab === 'allTasks' && isOwner) {
          await fetchAllTasks();
        } else if (tab === 'myTasks') {
          await fetchMyTasks();
        } else if (tab === 'literature') {
          await Promise.all([fetchSources(), fetchFiles()]);
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

  const handleRemoveMember = async (userId: number) => {
    try {
      await client.delete(`/projects/${id}/members/${userId}/`);
      fetchProject();
    } catch (err) {
      const resp = (err as { response?: { data?: Record<string, string[]> } }).response?.data;
      setMemberError(resp ? Object.values(resp).flat().join('. ') : 'Ошибка удаления');
    }
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
      setShowTaskForm(false);
      setTaskForm({ title: '', description: '', priority: 'medium', deadline: '', assignee_id: '' });
      showSuccess('Задача создана');
      fetchAllTasks();
      fetchMyTasks();
    } catch (err) {
      showError(getErrorMessage(err));
      const resp = (err as { response?: { data?: Record<string, string[]> } }).response?.data;
      setTaskError(resp ? Object.values(resp).flat().join('. ') : 'Ошибка создания задачи');
    }
  };

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

  const handleArxivSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = arxivQuery.trim();
    if (!q) return;
    setArxivLoading(true);
    setArxivError('');
    setArxivResults([]);
    try {
      const { data } = await client.get<{ results: ArxivResult[] }>(
        `/projects/${id}/literature/arxiv-search/`,
        { params: { q, max_results: 10 } },
      );
      setArxivResults(data.results);
      if (data.results.length === 0) {
        setArxivError('По вашему запросу ничего не найдено');
      }
    } catch {
      setArxivError('Ошибка при поиске на arXiv');
    } finally {
      setArxivLoading(false);
    }
  };

  const handleSaveArxivResult = async (result: ArxivResult) => {
    setArxivSaving((prev) => new Set(prev).add(result.arxiv_id));
    try {
      const payload = {
        title: result.title,
        authors: result.authors,
        year: result.year,
        url: result.url,
        description: result.summary.length > 500
          ? result.summary.substring(0, 497) + '...'
          : result.summary,
        tags: result.categories,
      };
      await client.post(`/projects/${id}/literature/sources/`, payload);
      showSuccess('Статья сохранена в источники');
      fetchSources();
    } catch {
      showError('Ошибка сохранения статьи');
    } finally {
      setArxivSaving((prev) => {
        const s = new Set(prev);
        s.delete(result.arxiv_id);
        return s;
      });
    }
  };

  if (loading) return <Loader />;

  // Не участник
  if (!isMember && projectCatalog) {
    return (
      <div className="container">
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
              onClick={() => navigate(`/projects/${id}/gost`)}
            >
              Конструктор ГОСТ
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
                type="number"
                placeholder="ID пользователя"
                value={memberForm.user_id}
                onChange={(e) => setMemberForm({ ...memberForm, user_id: e.target.value })}
                required
              />
              <select value={memberForm.project_role} onChange={(e) => setMemberForm({ ...memberForm, project_role: e.target.value })}>
                <option value="analyst">Аналитик</option>
                <option value="developer">Разработчик</option>
                <option value="tester">Тестировщик</option>
                <option value="designer">Дизайнер</option>
                <option value="researcher">Исследователь</option>
              </select>
              <button type="submit" className="btn btn-primary">Добавить</button>
            </form>
          )}
          {memberError && <p className="error-msg">{memberError}</p>}
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
        <button
          className={`${styles.tab} ${activeTab === 'literature' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('literature')}
        >
          Литература проекта
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
                <button className="btn btn-primary" onClick={() => setShowTaskForm(!showTaskForm)}>
                  {showTaskForm ? 'Отмена' : '+ Создать задачу'}
                </button>
              </div>

              {showTaskForm && (
                <form className={styles.taskForm} onSubmit={handleCreateTask}>
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
                  <button type="submit" className="btn btn-primary">Создать</button>
                </form>
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
                    </tr>
                  </thead>
                  <tbody>
                    {allTasks.map((t) => (
                      <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/tasks/${t.id}`)}>
                        <td>{t.title}</td>
                        <td><StatusBadge status={t.status} /></td>
                        <td>{PRIORITY_LABELS[t.priority] || t.priority}</td>
                        <td>{t.assignee?.full_name || '—'}</td>
                        <td>{t.deadline || '—'}</td>
                      </tr>
                    ))}
                    {allTasks.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center' }}>Нет задач</td>
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

      {/* Вкладка: Литература */}
      {activeTab === 'literature' && (
        <div className={styles.tabContent}>
          <div className={styles.tabHeader}>
            <h3>Литературные источники</h3>
            <button className="btn btn-primary" onClick={() => setShowSourceForm(!showSourceForm)}>
              {showSourceForm ? 'Отмена' : '+ Добавить источник'}
            </button>
          </div>

          {showSourceForm && (
            <form className={styles.sourceForm} onSubmit={handleCreateSource}>
              <input placeholder="Название" value={sourceForm.title} onChange={(e) => setSourceForm({ ...sourceForm, title: e.target.value })} required />
              <input placeholder="Авторы" value={sourceForm.authors} onChange={(e) => setSourceForm({ ...sourceForm, authors: e.target.value })} />
              <input type="number" placeholder="Год" value={sourceForm.year} onChange={(e) => setSourceForm({ ...sourceForm, year: e.target.value })} />
              <input placeholder="URL" value={sourceForm.url} onChange={(e) => setSourceForm({ ...sourceForm, url: e.target.value })} />
              <textarea placeholder="Описание" value={sourceForm.description} onChange={(e) => setSourceForm({ ...sourceForm, description: e.target.value })} />
              <input placeholder="Теги (через запятую)" value={sourceForm.tags} onChange={(e) => setSourceForm({ ...sourceForm, tags: e.target.value })} />
              {sourceError && <p className="error-msg">{sourceError}</p>}
              <button type="submit" className="btn btn-primary">Добавить</button>
            </form>
          )}

          {isTabLoading('literature') ? (
            <SkeletonTable rows={4} cols={5} />
          ) : (
            <table className={styles.sourceTable}>
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Авторы</th>
                  <th>Год</th>
                  <th>Теги</th>
                  <th></th>
                </tr>
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
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center' }}>Нет источников</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* Поиск на arXiv */}
          <div className={styles.fileSection}>
            <h3>Поиск статей на arXiv</h3>
            <form onSubmit={handleArxivSearch} className={styles.uploadForm}>
              <input
                type="text"
                placeholder="Ключевые слова (например, machine learning)"
                value={arxivQuery}
                onChange={(e) => setArxivQuery(e.target.value)}
                style={{ flex: 3 }}
              />
              <button type="submit" className="btn btn-primary" disabled={arxivLoading || !arxivQuery.trim()}>
                {arxivLoading ? 'Поиск...' : 'Найти на arXiv'}
              </button>
              {projectFull?.area && !arxivQuery && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setArxivQuery(projectFull.area)}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Область проекта
                </button>
              )}
            </form>

            {arxivError && <p className="error-msg">{arxivError}</p>}

            {arxivResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                {arxivResults.map((r) => (
                  <div
                    key={r.arxiv_id}
                    style={{
                      background: '#f8faf8',
                      borderRadius: 16,
                      padding: 16,
                      border: '1px solid #e2efeb',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <a href={r.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 15, color: '#17323b' }}>
                          {r.title}
                        </a>
                        <div style={{ fontSize: 13, color: '#5f747c', marginTop: 4 }}>
                          {r.authors} {r.year && `(${r.year})`}
                        </div>
                        <div style={{ fontSize: 13, color: '#8aa4ac', marginTop: 8, lineHeight: 1.5 }}>
                          {r.summary.length > 300 ? r.summary.substring(0, 297) + '...' : r.summary}
                        </div>
                        {r.categories.length > 0 && (
                          <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {r.categories.map((cat) => (
                              <span
                                key={cat}
                                style={{
                                  background: 'rgba(31, 139, 117, 0.1)',
                                  color: '#1f8b75',
                                  padding: '2px 8px',
                                  borderRadius: 12,
                                  fontSize: 11,
                                }}
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleSaveArxivResult(r)}
                          disabled={arxivSaving.has(r.arxiv_id)}
                          style={{ fontSize: 13, padding: '6px 14px' }}
                        >
                          {arxivSaving.has(r.arxiv_id) ? 'Сохранение...' : 'Сохранить'}
                        </button>
                        {r.pdf_url && (
                          <a
                            href={r.pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-outline"
                            style={{ fontSize: 13, padding: '6px 14px', textAlign: 'center', textDecoration: 'none' }}
                          >
                            PDF
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.fileSection}>
            <h3>Файлы и документы</h3>
            <form onSubmit={handleUploadFile} className={styles.uploadForm}>
              <input type="file" required />
              <input placeholder="Описание" value={fileDesc} onChange={(e) => setFileDesc(e.target.value)} />
              <button type="submit" className="btn btn-primary">Загрузить</button>
            </form>
            {fileError && <p className="error-msg">{fileError}</p>}

            <table className={styles.fileTable}>
              <thead>
                <tr>
                  <th>Имя файла</th>
                  <th>Тип</th>
                  <th>Размер</th>
                  <th>Описание</th>
                  <th></th>
                </tr>
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
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center' }}>Нет файлов</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}