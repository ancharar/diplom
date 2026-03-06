import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import Loader from '../components/Loader';
import StatusBadge from '../components/StatusBadge';
import type { Project, Task, User } from '../types';
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

export default function ProjectDetailPage({ user }: ProjectDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  /* Форма добавления участника */
  const [memberForm, setMemberForm] = useState({ user_id: '', project_role: 'developer' });
  const [memberError, setMemberError] = useState('');

  /* Форма создания задачи */
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium', deadline: '' });
  const [taskError, setTaskError] = useState('');

  const isOwner = project?.owner.id === user?.id;

  const fetchProject = async () => {
    const { data } = await client.get<Project>(`/projects/${id}/`);
    setProject(data);
  };

  const fetchTasks = async () => {
    const params: Record<string, string> = {};
    if (filterStatus) params.status = filterStatus;
    if (filterPriority) params.priority = filterPriority;
    const { data } = await client.get<Task[]>(`/projects/${id}/tasks/`, { params });
    setTasks(data);
  };

  useEffect(() => {
    Promise.all([fetchProject(), fetchTasks()]).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading) fetchTasks();
  }, [filterStatus, filterPriority]);

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
      fetchProject();
    } catch (err) {
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
      fetchTasks();
    } catch (err) {
      const resp = (err as { response?: { data?: Record<string, string[]> } }).response?.data;
      setTaskError(resp ? Object.values(resp).flat().join('. ') : 'Ошибка создания задачи');
    }
  };

  if (loading) return <Loader />;
  if (!project) return <p>Проект не найден</p>;

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

      {/* Задачи */}
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
            <option value="new">New</option>
            <option value="on_discussion">On discussion</option>
            <option value="approved">Approved</option>
            <option value="in_progress">In progress</option>
            <option value="complete">Complete</option>
            <option value="testing">Testing</option>
            <option value="to_review">To review</option>
            <option value="ready_to_merge">Ready to merge</option>
            <option value="closed">Closed</option>
            <option value="disapproved">Disapproved</option>
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="">Все приоритеты</option>
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
          </select>
        </div>

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
      </div>
    </div>
  );
}
