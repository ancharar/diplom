import { useEffect, useState } from 'react';
import client from '../api/client';
import Loader from '../components/Loader';
import type { Project, VKPublication, User } from '../types';
import styles from '../styles/VKPage.module.scss';

interface VKPageProps {
  user: User | null;
}

export default function VKPage({ user }: VKPageProps) {
  const [loading, setLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState('');

  const [projects, setProjects] = useState<Project[]>([]);
  const [publications, setPublications] = useState<VKPublication[]>([]);

  const [publishForm, setPublishForm] = useState({ project: '', title: '', content: '', owner_id: '' });
  const [publishError, setPublishError] = useState('');
  const [publishSuccess, setPublishSuccess] = useState('');

  const fetchData = async () => {
    try {
      const [projRes, pubRes] = await Promise.all([
        client.get<Project[]>('/projects/'),
        client.get<VKPublication[]>('/vk/publications/'),
      ]);
      setProjects(projRes.data);
      setPublications(pubRes.data);
    } finally {
      setLoading(false);
    }
  };

  const checkToken = async () => {
    try {
      /* Пробуем получить информацию — если 404 значит нет токена */
      await client.get('/vk/token/');
      setHasToken(true);
    } catch {
      setHasToken(false);
    }
  };

  useEffect(() => {
    fetchData();
    checkToken();
  }, []);

  /* Сохранить токен */
  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setTokenError('');
    try {
      await client.post('/vk/token/', { access_token: tokenInput });
      setTokenInput('');
      setHasToken(true);
    } catch (err) {
      const resp = (err as { response?: { data?: Record<string, string[]> } }).response?.data;
      setTokenError(resp ? Object.values(resp).flat().join('. ') : 'Ошибка сохранения');
    }
  };

  /* Удалить токен */
  const handleDeleteToken = async () => {
    try {
      await client.delete('/vk/token/');
      setHasToken(false);
    } catch {
      setTokenError('Ошибка удаления токена');
    }
  };

  /* Опубликовать */
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishError('');
    setPublishSuccess('');
    try {
      await client.post('/vk/publish/', {
        project: Number(publishForm.project),
        title: publishForm.title,
        content: publishForm.content,
        owner_id: Number(publishForm.owner_id),
      });
      setPublishSuccess('Пост опубликован!');
      setPublishForm({ project: '', title: '', content: '', owner_id: '' });
      const { data } = await client.get<VKPublication[]>('/vk/publications/');
      setPublications(data);
    } catch (err) {
      const resp = (err as { response?: { data?: Record<string, string | string[]> } }).response?.data;
      if (resp) {
        const messages = Object.values(resp).flat();
        setPublishError(messages.join('. '));
      } else {
        setPublishError('Ошибка публикации');
      }
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="container">
      <h1 className="page-title">VK-публикации</h1>

      <div className={styles.grid}>
        {/* Левая колонка: токен + форма публикации */}
        <div>
          {/* Управление токеном */}
          <div className={`card ${styles.section}`}>
            <div className={styles.sectionTitle}>VK-токен</div>
            <div className={`${styles.tokenStatus} ${hasToken ? styles.saved : styles.none}`}>
              {hasToken ? 'Токен сохранён' : 'Токен не установлен'}
            </div>
            {hasToken ? (
              <button className="btn" onClick={handleDeleteToken}>Удалить токен</button>
            ) : (
              <form onSubmit={handleSaveToken}>
                <div className="form-group">
                  <label>Access Token</label>
                  <input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} required placeholder="Вставьте VK access token" />
                </div>
                {tokenError && <p className="error-msg">{tokenError}</p>}
                <button type="submit" className="btn btn-primary">Сохранить</button>
              </form>
            )}
          </div>

          {/* Форма публикации */}
          <div className={`card ${styles.section}`}>
            <div className={styles.sectionTitle}>Новая публикация</div>
            <form onSubmit={handlePublish}>
              <div className="form-group">
                <label>Проект</label>
                <select value={publishForm.project} onChange={(e) => setPublishForm({ ...publishForm, project: e.target.value })} required>
                  <option value="">Выберите проект</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-group"><label>Заголовок</label><input value={publishForm.title} onChange={(e) => setPublishForm({ ...publishForm, title: e.target.value })} required /></div>
              <div className="form-group"><label>Содержание</label><textarea value={publishForm.content} onChange={(e) => setPublishForm({ ...publishForm, content: e.target.value })} required rows={4} /></div>
              <div className="form-group"><label>Owner ID (группа/пользователь VK)</label><input type="number" value={publishForm.owner_id} onChange={(e) => setPublishForm({ ...publishForm, owner_id: e.target.value })} required /></div>
              {publishError && <p className="error-msg">{publishError}</p>}
              {publishSuccess && <p style={{ color: '#155724', marginBottom: 8 }}>{publishSuccess}</p>}
              <button type="submit" className="btn btn-primary" disabled={!hasToken}>Опубликовать</button>
            </form>
          </div>
        </div>

        {/* Правая колонка: список публикаций */}
        <div className="card">
          <div className={styles.sectionTitle}>История публикаций</div>
          {publications.length === 0 && <p>Нет публикаций</p>}
          <table>
            <thead>
              <tr>
                <th>Заголовок</th>
                <th>Статус</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {publications.map((pub) => (
                <tr key={pub.id}>
                  <td>{pub.title}</td>
                  <td>
                    <span style={{
                      color: pub.status === 'published' ? '#155724' : pub.status === 'failed' ? '#721c24' : '#856404',
                      fontWeight: 600,
                    }}>
                      {pub.status === 'published' ? 'Опубликовано' : pub.status === 'failed' ? 'Ошибка' : 'Черновик'}
                    </span>
                  </td>
                  <td>{pub.published_at ? new Date(pub.published_at).toLocaleString() : new Date(pub.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
