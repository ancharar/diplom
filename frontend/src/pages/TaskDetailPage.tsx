import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import Loader from '../components/Loader';
import StatusBadge from '../components/StatusBadge';
import type { HistoryEntry, Task, User } from '../types';
import styles from '../styles/TaskDetail.module.scss';

interface Attachment {
  id: number;
  attachment_type: 'file' | 'link';
  file_name: string;
  file_size: number | null;
  url: string;
  description: string;
  uploaded_by: User;
  created_at: string;
}

interface TaskDetailPageProps {
  user: User | null;
}

interface ProjectMember {
  id: number;
  user?: User;
  full_name?: string;
  email?: string;
  project_role?: string;
}

interface ProjectDetailResponse {
  id: number;
  members?: ProjectMember[];
  participants?: ProjectMember[];
  users?: User[];
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#8aa4ac',
  medium: '#f59e0b',
  high: '#e74c3c',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  on_discussion: 'На обсуждении',
  approved: 'Утверждена',
  in_progress: 'В процессе',
  complete: 'Завершена',
  testing: 'Тестирование',
  to_review: 'На проверке',
  ready_to_merge: 'Готово к слиянию',
  closed: 'Закрыта',
  disapproved: 'Отклонена',
};

const FIELD_LABELS: Record<string, string> = {
  status: 'Статус',
  priority: 'Приоритет',
  assignee: 'Исполнитель',
  assignee_id: 'Исполнитель',
  title: 'Название',
  description: 'Описание',
  deadline: 'Дедлайн',
};

function getErrorMessage(err: unknown, fallback: string) {
  const data = (
    err as {
      response?: {
        data?: unknown;
      };
    }
  ).response?.data;

  if (!data) return fallback;

  if (typeof data === 'string') {
    if (data.trim().startsWith('<!DOCTYPE html>')) {
      return fallback;
    }
    return data;
  }

  if (typeof data === 'object') {
    return Object.values(data as Record<string, string[] | string>)
      .flat()
      .join('. ');
  }

  return fallback;
}

function getProjectId(task: Task) {
  const project = task.project as number | { id: number } | null;

  if (typeof project === 'object' && project !== null) {
    return project.id;
  }

  return project;
}

function normalizeProjectMembers(data: unknown) {
  const rawMembers = Array.isArray(data)
    ? data
    : (data as ProjectDetailResponse).members ||
      (data as ProjectDetailResponse).participants ||
      (data as ProjectDetailResponse).users ||
      [];

  return rawMembers
    .map((item) => {
      const member = item as ProjectMember | User;

      if ('user' in member && member.user) {
        return {
          id: member.user.id,
          full_name: member.user.full_name || member.user.email,
        };
      }

      return {
        id: member.id,
        full_name: member.full_name || member.email || `Пользователь #${member.id}`,
      };
    })
    .filter((member) => Boolean(member.id));
}

export default function TaskDetailPage({ user }: TaskDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [task, setTask] = useState<Task | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [projectMembers, setProjectMembers] = useState<
    { id: number; full_name: string }[]
  >([]);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachDesc, setAttachDesc] = useState('');
  const [attachLoading, setAttachLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    deadline: '',
    assignee_id: '',
  });

  const loadProjectMembers = useCallback(async (projectId: number) => {
    try {
      const { data } = await client.get<ProjectMember[]>(
        `/projects/${projectId}/members/`,
      );
      setProjectMembers(normalizeProjectMembers(data));
    } catch {
      try {
        const { data } = await client.get<ProjectDetailResponse>(
          `/projects/${projectId}/`,
        );
        setProjectMembers(normalizeProjectMembers(data));
      } catch {
        setProjectMembers([]);
      }
    }
  }, []);

  const fillTaskData = useCallback(
    async (taskData: Task, historyData: HistoryEntry[]) => {
      setTask(taskData);

      setForm({
        title: taskData.title,
        description: taskData.description || '',
        priority: taskData.priority,
        deadline: taskData.deadline || '',
        assignee_id: taskData.assignee?.id?.toString() || '',
      });

      setHistory(historyData);

      const projectId = getProjectId(taskData);

      if (projectId) {
        await loadProjectMembers(projectId);
      }
    },
    [loadProjectMembers],
  );

  const fetchAttachments = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await client.get<Attachment[]>(`/tasks/${id}/attachments/`);
      setAttachments(data);
    } catch { /* ignore */ }
  }, [id]);

  const loadData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError('');

    try {
      const [taskRes, historyRes] = await Promise.all([
        client.get<Task>(`/tasks/${id}/`),
        client.get<HistoryEntry[]>(`/tasks/${id}/history/`),
      ]);

      await fillTaskData(taskRes.data, historyRes.data);
      await fetchAttachments();
    } catch (err) {
      console.error('Ошибка загрузки данных задачи:', err);
      setError('Ошибка загрузки задачи');
    } finally {
      setLoading(false);
    }
  }, [id, fillTaskData, fetchAttachments]);

  const refreshData = useCallback(async () => {
    if (!id) return;

    try {
      const [taskRes, historyRes] = await Promise.all([
        client.get<Task>(`/tasks/${id}/`),
        client.get<HistoryEntry[]>(`/tasks/${id}/history/`),
      ]);

      await fillTaskData(taskRes.data, historyRes.data);
    } catch (err) {
      console.error('Ошибка обновления данных задачи:', err);
    }
  }, [id, fillTaskData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const newAssigneeId = form.assignee_id ? Number(form.assignee_id) : null;
      
      const payload: Record<string, string | number | null> = {
        title: form.title,
        priority: form.priority,
        description: form.description,
        deadline: form.deadline || '',
        assignee_id: newAssigneeId,
      };

      await client.patch(`/tasks/${id}/`, payload);

      setEditMode(false);
      await refreshData();
    } catch (err) {
      console.error('Ошибка обновления:', err);
      setError(getErrorMessage(err, 'Ошибка обновления'));
    }
  };

  // ✅ ИСПРАВЛЕНО: post → patch
  const handleTransition = async (newStatus: string) => {
    setError('');

    try {
      await client.patch(`/tasks/${id}/status/`, {
        status: newStatus,
      });

      await refreshData();
    } catch (err) {
      setError(getErrorMessage(err, 'Ошибка перехода статуса'));
    }
  };

  const handleAttachUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attachFile || !id) return;
    setAttachLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', attachFile);
      fd.append('attachment_type', 'file');
      if (attachDesc) fd.append('description', attachDesc);
      await client.post(`/tasks/${id}/attachments/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAttachFile(null);
      setAttachDesc('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchAttachments();
    } catch (err) {
      setError(getErrorMessage(err, 'Ошибка загрузки файла'));
    } finally {
      setAttachLoading(false);
    }
  };

  const handleAttachDelete = async (attId: number) => {
    if (!id) return;
    try {
      await client.delete(`/tasks/${id}/attachments/${attId}/`);
      await fetchAttachments();
    } catch (err) {
      setError(getErrorMessage(err, 'Ошибка удаления вложения'));
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  };

  if (loading) return <Loader />;

  if (!task) {
    return <div className={styles.notFound}>Задача не найдена</div>;
  }

  const canEdit = user?.id === task.created_by.id;
  const canUpload = canEdit || (task.assignee?.id === user?.id);

  const isOverdue =
    task.deadline &&
    new Date(task.deadline) < new Date() &&
    task.status !== 'closed' &&
    task.status !== 'complete';

  return (
    <div className={styles.container}>
      <div className={styles.topActions}>
        <button
          className="btn btn-outline"
          onClick={() => {
            if (task) {
              const projectId = getProjectId(task);
              if (projectId) navigate(`/projects/${projectId}`);
            }
          }}
        >
          ← Назад к проекту
        </button>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          {editMode ? (
            <form onSubmit={handleUpdate} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Название</label>
                <input
                  className={styles.input}
                  value={form.title}
                  onChange={(e) =>
                    setForm({ ...form, title: e.target.value })
                  }
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Описание</label>
                <textarea
                  className={styles.textarea}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>

              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Приоритет</label>
                  <select
                    className={styles.select}
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: e.target.value })
                    }
                  >
                    <option value="low">Низкий</option>
                    <option value="medium">Средний</option>
                    <option value="high">Высокий</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Дедлайн</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={form.deadline}
                    onChange={(e) =>
                      setForm({ ...form, deadline: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Исполнитель</label>
                <select
                  className={styles.select}
                  value={form.assignee_id}
                  onChange={(e) =>
                    setForm({ ...form, assignee_id: e.target.value })
                  }
                >
                  <option value="">Не назначен</option>
                  {projectMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {projectMembers.length === 0 && (
                <div className={styles.errorMsg}>
                  Участники проекта не загружены
                </div>
              )}

              {error && <div className={styles.errorMsg}>{error}</div>}

              <div className={styles.formActions}>
                <button type="submit" className={styles.saveBtn}>
                  Сохранить
                </button>

                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setEditMode(false)}
                >
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Название</div>
                <div className={styles.fieldValue}>{task.title}</div>
              </div>

              <div className={styles.field}>
                <div className={styles.fieldLabel}>Описание</div>
                <div className={styles.fieldValue}>
                  {task.description || '—'}
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.fieldLabel}>Статус</div>
                <div className={styles.fieldValue}>
                  <StatusBadge status={task.status} />
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.fieldLabel}>Приоритет</div>
                <div className={styles.fieldValue}>
                  <span
                    className={styles.priorityBadge}
                    style={{
                      backgroundColor:
                        (PRIORITY_COLORS[task.priority] || '#8aa4ac') + '20',
                      color: PRIORITY_COLORS[task.priority] || '#8aa4ac',
                    }}
                  >
                    {PRIORITY_LABELS[task.priority] || task.priority}
                  </span>
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.fieldLabel}>Исполнитель</div>
                <div className={styles.fieldValue}>
                  {task.assignee?.full_name || '—'}
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.fieldLabel}>Автор</div>
                <div className={styles.fieldValue}>
                  {task.created_by.full_name}
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.fieldLabel}>Дедлайн</div>
                <div className={styles.fieldValue}>
                  {task.deadline ? (
                    <span className={isOverdue ? styles.overdue : ''}>
                      {task.deadline}
                    </span>
                  ) : (
                    '—'
                  )}
                </div>
              </div>

              {canEdit && (
                <button
                  className={styles.editBtn}
                  onClick={() => setEditMode(true)}
                >
                  Редактировать задачу
                </button>
              )}

              {error && <div className={styles.errorMsg}>{error}</div>}
            </>
          )}

          {task.allowed_transitions && task.allowed_transitions.length > 0 && (
            <div className={styles.transitions}>
              <div className={styles.transitionsLabel}>Изменить статус:</div>

              <div className={styles.transitionsButtons}>
                {task.allowed_transitions.map((status) => (
                  <button
                    key={status}
                    className={styles.transitionBtn}
                    onClick={() => handleTransition(status)}
                  >
                    → {STATUS_LABELS[status] || status}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.card}>
          <h3 className={styles.historyTitle}>Вложения</h3>

          {attachments.length === 0 ? (
            <div className={styles.emptyHistory}>Нет вложений</div>
          ) : (
            <div className={styles.attachList}>
              {attachments.map((a) => (
                <div key={a.id} className={styles.attachItem}>
                  <div className={styles.attachInfo}>
                    <span className={styles.attachName}>{a.file_name || a.url}</span>
                    {a.file_size && (
                      <span className={styles.attachSize}>{formatSize(a.file_size)}</span>
                    )}
                    {a.description && (
                      <span className={styles.attachDesc}>{a.description}</span>
                    )}
                  </div>
                  <div className={styles.attachActions}>
                    {a.attachment_type === 'file' && (
                      <a
                        href={`/api/v1/tasks/${id}/attachments/${a.id}/download/`}
                        className={styles.downloadBtn}
                        download
                      >
                        ↓
                      </a>
                    )}
                    {(canEdit || user?.id === a.uploaded_by?.id) && (
                      <button
                        className={styles.deleteAttachBtn}
                        onClick={() => handleAttachDelete(a.id)}
                        title="Удалить"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {canUpload && (
            <form onSubmit={handleAttachUpload} className={styles.attachForm}>
              <input
                ref={fileInputRef}
                type="file"
                className={styles.fileInput}
                onChange={(e) => setAttachFile(e.target.files?.[0] ?? null)}
                accept=".pdf,.doc,.docx,.txt,.xlsx,.pptx"
              />
              <input
                type="text"
                className={styles.input}
                placeholder="Описание (необязательно)"
                value={attachDesc}
                onChange={(e) => setAttachDesc(e.target.value)}
              />
              <button
                type="submit"
                className={styles.saveBtn}
                disabled={!attachFile || attachLoading}
              >
                {attachLoading ? 'Загрузка...' : 'Загрузить'}
              </button>
            </form>
          )}
        </div>

        <div className={styles.card}>
          <h3 className={styles.historyTitle}>История изменений</h3>

          {history.length === 0 ? (
            <div className={styles.emptyHistory}>Нет записей</div>
          ) : (
            <div className={styles.historyList}>
              {history.map((h) => (
                <div key={h.id} className={styles.historyItem}>
                  <div className={styles.historyDate}>
                    {new Date(h.changed_at).toLocaleString()}
                  </div>

                  <div className={styles.historyChange}>
                    <strong>
                      {FIELD_LABELS[h.field_name] || h.field_name}
                    </strong>

                    <div className={styles.historyValues}>
                      <span className={styles.oldValue}>
                        {h.old_value || '—'}
                      </span>

                      <span className={styles.arrow}>→</span>

                      <span className={styles.newValue}>
                        {h.new_value || '—'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.historyAuthor}>
                    {h.changed_by.full_name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}