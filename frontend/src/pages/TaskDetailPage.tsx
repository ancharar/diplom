import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import Loader from '../components/Loader';
import StatusBadge from '../components/StatusBadge';
import type { Task, HistoryEntry, User } from '../types';
import styles from '../styles/TaskDetail.module.scss';

interface TaskDetailPageProps {
  user: User | null;
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  on_discussion: 'On discussion',
  approved: 'Approved',
  in_progress: 'In progress',
  complete: 'Complete',
  testing: 'Testing',
  to_review: 'To review',
  ready_to_merge: 'Ready to merge',
  closed: 'Closed',
  disapproved: 'Disapproved',
};

export default function TaskDetailPage({ user }: TaskDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', deadline: '' });
  const [error, setError] = useState('');

  const fetchTask = async () => {
    const { data } = await client.get<Task>(`/tasks/${id}/`);
    setTask(data);
    setForm({
      title: data.title,
      description: data.description || '',
      priority: data.priority,
      deadline: data.deadline || '',
    });
  };

  const fetchHistory = async () => {
    const { data } = await client.get<HistoryEntry[]>(`/tasks/${id}/history/`);
    setHistory(data);
  };

  useEffect(() => {
    Promise.all([fetchTask(), fetchHistory()]).finally(() => setLoading(false));
  }, [id]);

  /* Обновить задачу */
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload: Record<string, string> = { title: form.title, priority: form.priority };
      if (form.description) payload.description = form.description;
      if (form.deadline) payload.deadline = form.deadline;
      await client.patch(`/tasks/${id}/`, payload);
      setEditMode(false);
      fetchTask();
      fetchHistory();
    } catch (err) {
      const resp = (err as { response?: { data?: Record<string, string[]> } }).response?.data;
      setError(resp ? Object.values(resp).flat().join('. ') : 'Ошибка обновления');
    }
  };

  /* Сменить статус */
  const handleTransition = async (newStatus: string) => {
    setError('');
    try {
      await client.post(`/tasks/${id}/transition/`, { status: newStatus });
      fetchTask();
      fetchHistory();
    } catch (err) {
      const resp = (err as { response?: { data?: Record<string, string[]> } }).response?.data;
      setError(resp ? Object.values(resp).flat().join('. ') : 'Ошибка перехода');
    }
  };

  if (loading) return <Loader />;
  if (!task) return <p>Задача не найдена</p>;

  // ROLE_DISABLED: убрана проверка user?.role === 'admin'
  const canEdit = user?.id === task.created_by.id;

  return (
    <div className="container">
      <h1 className="page-title">Задача #{task.id}</h1>

      <div className={styles.grid}>
        {/* Левая колонка: информация о задаче */}
        <div className="card">
          {editMode ? (
            <form onSubmit={handleUpdate}>
              <div className="form-group"><label>Название</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="form-group"><label>Описание</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Приоритет</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">Низкий</option>
                    <option value="medium">Средний</option>
                    <option value="high">Высокий</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}><label>Дедлайн</label><input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
              </div>
              {error && <p className="error-msg">{error}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary">Сохранить</button>
                <button type="button" className="btn" onClick={() => setEditMode(false)}>Отмена</button>
              </div>
            </form>
          ) : (
            <>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Название</div>
                {task.title}
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Описание</div>
                {task.description || '—'}
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Статус</div>
                <StatusBadge status={task.status} />
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Приоритет</div>
                {PRIORITY_LABELS[task.priority] || task.priority}
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Исполнитель</div>
                {task.assignee?.full_name || '—'}
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Автор</div>
                {task.created_by.full_name}
              </div>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Дедлайн</div>
                {task.deadline || '—'}
              </div>
              {canEdit && (
                <button className="btn btn-primary" onClick={() => setEditMode(true)} style={{ marginTop: 8 }}>Редактировать</button>
              )}
              {error && <p className="error-msg">{error}</p>}
            </>
          )}

          {/* Кнопки перехода статуса */}
          {task.allowed_transitions.length > 0 && (
            <div className={styles.transitions}>
              {task.allowed_transitions.map((s) => (
                <button key={s} className="btn" onClick={() => handleTransition(s)}>
                  → {STATUS_LABELS[s] || s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Правая колонка: история */}
        <div className="card">
          <h3>История изменений</h3>
          {history.length === 0 && <p>Нет записей</p>}
          {history.map((h) => (
            <div key={h.id} className={styles.historyItem}>
              <div className="date">{new Date(h.changed_at).toLocaleString()}</div>
              <div className="change">
                <strong>{h.field_name}</strong>: {h.old_value || '—'}
                <span className={styles.arrow}>→</span>
                {h.new_value || '—'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#636e72' }}>{h.changed_by.full_name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
