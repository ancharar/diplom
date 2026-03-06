import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import Loader from '../components/Loader';
import type { Project, User } from '../types';
import styles from '../styles/Projects.module.scss';

interface ProjectsPageProps {
  user: User | null;
}

export default function ProjectsPage({ user }: ProjectsPageProps) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', area: '', description: '', goal: '', start_date: '', end_date: '' });
  const [error, setError] = useState('');

  const fetchProjects = async () => {
    try {
      const { data } = await client.get<Project[]>('/projects/');
      setProjects(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await client.post('/projects/', form);
      setShowForm(false);
      setForm({ title: '', area: '', description: '', goal: '', start_date: '', end_date: '' });
      fetchProjects();
    } catch (err) {
      const resp = (err as { response?: { data?: Record<string, string[]> } }).response?.data;
      setError(resp ? Object.values(resp).flat().join('. ') : 'Ошибка создания');
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="container">
      <div className={styles.header}>
        <h1 className="page-title">Проекты</h1>
        {user?.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Отмена' : 'Создать проект'}
          </button>
        )}
      </div>

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
    </div>
  );
}
