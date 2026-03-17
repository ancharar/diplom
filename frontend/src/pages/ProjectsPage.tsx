import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import Loader from '../components/Loader';
import JoinRequestModal from '../components/JoinRequestModal';
import type { Project, ProjectCatalog, User } from '../types';
import styles from '../styles/Projects.module.scss';

interface ProjectsPageProps {
  user: User | null;
}

export default function ProjectsPage({ user }: ProjectsPageProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'my' | 'catalog'>('my');
  const [projects, setProjects] = useState<Project[]>([]);
  const [catalog, setCatalog] = useState<ProjectCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', area: '', description: '', goal: '', start_date: '', end_date: '' });
  const [error, setError] = useState('');

  /* Модалка заявки */
  const [joinProjectId, setJoinProjectId] = useState<number | null>(null);

  const fetchProjects = async () => {
    try {
      const { data } = await client.get<Project[]>('/projects/');
      setProjects(data);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const { data } = await client.get<ProjectCatalog[]>('/projects/catalog/');
      setCatalog(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchProjects();
    fetchCatalog();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await client.post('/projects/', form);
      setShowForm(false);
      setForm({ title: '', area: '', description: '', goal: '', start_date: '', end_date: '' });
      fetchProjects();
      fetchCatalog();
    } catch (err) {
      const resp = (err as { response?: { data?: Record<string, string[]> } }).response?.data;
      setError(resp ? Object.values(resp).flat().join('. ') : 'Ошибка создания');
    }
  };

  const handleCancelRequest = async (projectId: number) => {
    try {
      /* Найдём pending-заявку через мои заявки */
      const { data } = await client.get<{ id: number; project: number; status: string }[]>('/users/me/join-requests/');
      const req = data.find((r) => r.project === projectId && r.status === 'pending');
      if (req) {
        await client.delete(`/users/me/join-requests/${req.id}/`);
        fetchCatalog();
      }
    } catch { /* ignore */ }
  };

  if (loading) return <Loader />;

  return (
    <div className="container">
      <div className={styles.header}>
        <h1 className="page-title">Проекты</h1>
        {user?.role === 'admin' && tab === 'my' && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Отмена' : 'Создать проект'}
          </button>
        )}
      </div>

      {/* Вкладки */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'my' ? styles.tabActive : ''}`} onClick={() => setTab('my')}>
          Мои проекты
        </button>
        <button className={`${styles.tab} ${tab === 'catalog' ? styles.tabActive : ''}`} onClick={() => setTab('catalog')}>
          Каталог проектов
        </button>
      </div>

      {/* Мои проекты */}
      {tab === 'my' && (
        <>
          {showForm && (
            <form className="card" onSubmit={handleCreate} style={{ marginBottom: 20 }}>
              <div className="form-group"><label>Название</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="form-group"><label>Область</label><input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} required /></div>
              <div className="form-group"><label>Описание</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="form-group"><label>Цель</label><textarea value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}><label>Дата начала</label><input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required /></div>
                <div className="form-group" style={{ flex: 1 }}><label>Дата окончания</label><input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required /></div>
              </div>
              {error && <p className="error-msg">{error}</p>}
              <button type="submit" className="btn btn-primary">Создать</button>
            </form>
          )}
          <div className={styles.grid}>
            {projects.map((p) => (
              <div key={p.id} className={styles.projectCard} onClick={() => navigate(`/projects/${p.id}`)}>
                <div className={styles.projectTitle}>{p.title}</div>
                <div className={styles.projectMeta}>
                  {p.start_date} — {p.end_date} | {p.status === 'in_progress' ? 'В процессе' : 'Завершён'}
                </div>
                <span className={styles.projectArea}>{p.area}</span>
              </div>
            ))}
            {projects.length === 0 && <p>Нет проектов</p>}
          </div>
        </>
      )}

      {/* Каталог */}
      {tab === 'catalog' && (
        <div className={styles.grid}>
          {catalog.map((p) => (
            <div key={p.id} className={styles.projectCard}>
              <div className={styles.projectTitle} style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>
                {p.title}
              </div>
              <div className={styles.projectMeta}>
                {p.area} | Участников: {p.members_count}
              </div>
              {p.description && (
                <div className={styles.projectMeta} style={{ marginTop: 4 }}>
                  {p.description.length > 150 ? p.description.slice(0, 150) + '…' : p.description}
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                {p.is_member ? (
                  <span className={styles.badgeMember}>Вы участник</span>
                ) : p.has_pending_request ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={styles.badgePending}>Заявка отправлена</span>
                    <button className="btn btn-sm" onClick={() => handleCancelRequest(p.id)}>Отозвать</button>
                  </span>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={() => setJoinProjectId(p.id)}>
                    Подать заявку
                  </button>
                )}
              </div>
            </div>
          ))}
          {catalog.length === 0 && <p>Нет проектов</p>}
        </div>
      )}

      {/* Модалка подачи заявки */}
      {joinProjectId !== null && (
        <JoinRequestModal
          projectId={joinProjectId}
          onClose={() => setJoinProjectId(null)}
          onSuccess={() => { setJoinProjectId(null); fetchCatalog(); }}
        />
      )}
    </div>
  );
}
