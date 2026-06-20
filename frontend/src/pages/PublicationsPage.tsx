import { useEffect, useState } from 'react';
import client from '../api/client';
import type { Publication, ExtractedMetadata } from '../types';
import styles from '../styles/Publications.module.scss';

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
};

export default function PublicationsPage() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Extract
  const [extractUrl, setExtractUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [metadata, setMetadata] = useState<ExtractedMetadata | null>(null);

  // Edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    title: '', authors: '', year: '', journal: '',
    volume: '', issue: '', pages: '', url: '', doi: '',
  });

  const fetchPublications = async () => {
    try {
      const { data } = await client.get<Publication[]>('/publications/');
      setPublications(data || []); 
    } catch {
      setError('Ошибка загрузки публикаций');
      setPublications([]); 
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublications();
  }, []);

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extractUrl.trim()) return;
    setExtracting(true);
    setError('');
    setMetadata(null);
    try {
      const { data } = await client.post<ExtractedMetadata>(
        '/publications/extract/', { url: extractUrl },
      );
      setMetadata(data);
    } catch {
      setError('Ошибка извлечения метаданных');
    } finally {
      setExtracting(false);
    }
  };

  const handleSaveExtracted = async () => {
    if (!metadata) return;
    try {
      await client.post('/publications/', {
        title: metadata.title,
        authors: metadata.authors,
        year: metadata.year,
        journal: metadata.journal,
        volume: metadata.volume,
        issue: metadata.issue,
        pages: metadata.pages,
        url: metadata.url,
        doi: metadata.doi,
        raw_url: metadata.raw_url,
        extraction_confidence: metadata.extraction_confidence,
      });
      setMetadata(null);
      setExtractUrl('');
      fetchPublications();
    } catch {
      setError('Ошибка сохранения публикации');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await client.delete(`/publications/${id}/`);
      fetchPublications();
    } catch {
      setError('Ошибка удаления');
    }
  };

  const handleEdit = (pub: Publication) => {
    setEditingId(pub.id);
    setEditForm({
      title: pub.title,
      authors: pub.authors?.join(', ') || '',
      year: pub.year?.toString() || '',
      journal: pub.journal || '',
      volume: pub.volume || '',
      issue: pub.issue || '',
      pages: pub.pages || '',
      url: pub.url || '',
      doi: pub.doi || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      await client.put(`/publications/${editingId}/`, {
        title: editForm.title,
        authors: editForm.authors.split(',').map((a) => a.trim()).filter(Boolean),
        year: editForm.year ? parseInt(editForm.year) : null,
        journal: editForm.journal,
        volume: editForm.volume,
        issue: editForm.issue,
        pages: editForm.pages,
        url: editForm.url,
        doi: editForm.doi,
      });
      setEditingId(null);
      fetchPublications();
    } catch {
      setError('Ошибка обновления');
    }
  };

  // ✅ безопасная проверка длины
  const hasPublications = publications && publications.length > 0;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Мои публикации</h1>
            <p className={styles.subtitle}>Управление списком научных публикаций</p>
          </div>
        </div>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Секция извлечения метаданных */}
      <div className={styles.extractSection}>
        <h3 className={styles.extractTitle}>Добавить публикацию по URL</h3>
        <form onSubmit={handleExtract} className={styles.extractForm}>
          <input
            type="url"
            placeholder="Вставьте URL статьи (DOI, arXiv, журнал)"
            value={extractUrl}
            onChange={(e) => setExtractUrl(e.target.value)}
            required
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={extracting}
          >
            {extracting ? 'Извлечение...' : 'Извлечь метаданные'}
          </button>
        </form>

        {metadata && (
          <div className={styles.metadataPreview}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong>Извлеченные данные</strong>
              <span className={`${styles.confidenceBadge} ${
                styles[`confidence${metadata.extraction_confidence.charAt(0).toUpperCase() + metadata.extraction_confidence.slice(1)}`]
              }`}>
                Уверенность: {CONFIDENCE_LABEL[metadata.extraction_confidence]}
              </span>
            </div>
            {metadata.title && (
              <div className={styles.metadataField}>
                <span>Название:</span>
                <span>{metadata.title}</span>
              </div>
            )}
            {metadata.authors && metadata.authors.length > 0 && (
              <div className={styles.metadataField}>
                <span>Авторы:</span>
                <span>{metadata.authors.join(', ')}</span>
              </div>
            )}
            {metadata.year && (
              <div className={styles.metadataField}>
                <span>Год:</span>
                <span>{metadata.year}</span>
              </div>
            )}
            {metadata.journal && (
              <div className={styles.metadataField}>
                <span>Журнал:</span>
                <span>{metadata.journal}</span>
              </div>
            )}
            {metadata.doi && (
              <div className={styles.metadataField}>
                <span>DOI:</span>
                <span>{metadata.doi}</span>
              </div>
            )}
            <div className={styles.metadataActions}>
              <button className="btn btn-primary" onClick={handleSaveExtracted}>
                Сохранить
              </button>
              <button className="btn btn-outline" onClick={() => setMetadata(null)}>
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Список публикаций */}
      {!hasPublications ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateTitle}>Нет публикаций</div>
          <div className={styles.emptyStateText}>
            Добавьте публикацию по URL выше
          </div>
        </div>
      ) : (
        <div className={styles.pubList}>
          {publications.map((pub) => (
            <div key={pub.id} className={styles.pubCard}>
              {editingId === pub.id ? (
                <div className={styles.editForm}>
                  <input
                    placeholder="Название"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  />
                  <input
                    placeholder="Авторы (через запятую)"
                    value={editForm.authors}
                    onChange={(e) => setEditForm({ ...editForm, authors: e.target.value })}
                  />
                  <div className={styles.formRow}>
                    <input
                      placeholder="Год"
                      type="number"
                      value={editForm.year}
                      onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                    />
                    <input
                      placeholder="Журнал"
                      value={editForm.journal}
                      onChange={(e) => setEditForm({ ...editForm, journal: e.target.value })}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <input
                      placeholder="Том"
                      value={editForm.volume}
                      onChange={(e) => setEditForm({ ...editForm, volume: e.target.value })}
                    />
                    <input
                      placeholder="Выпуск"
                      value={editForm.issue}
                      onChange={(e) => setEditForm({ ...editForm, issue: e.target.value })}
                    />
                    <input
                      placeholder="Страницы"
                      value={editForm.pages}
                      onChange={(e) => setEditForm({ ...editForm, pages: e.target.value })}
                    />
                  </div>
                  <input
                    placeholder="DOI"
                    value={editForm.doi}
                    onChange={(e) => setEditForm({ ...editForm, doi: e.target.value })}
                  />
                  <div className={styles.formActions}>
                    <button className="btn btn-primary" onClick={handleSaveEdit}>
                      Сохранить
                    </button>
                    <button className="btn btn-outline" onClick={() => setEditingId(null)}>
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.pubHeader}>
                    <div>
                      <div className={styles.pubTitle}>
                        {pub.url ? (
                          <a href={pub.url} target="_blank" rel="noreferrer">
                            {pub.title || 'Без названия'}
                          </a>
                        ) : (
                          pub.title || 'Без названия'
                        )}
                      </div>
                      {pub.authors && pub.authors.length > 0 && (
                        <div className={styles.pubAuthors}>
                          {pub.authors.join(', ')}
                        </div>
                      )}
                    </div>
                    <div className={styles.pubActions}>
                      <button className={styles.editBtn} onClick={() => handleEdit(pub)}>
                        Редактировать
                      </button>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(pub.id)}>
                        Удалить
                      </button>
                    </div>
                  </div>
                  <div className={styles.pubMeta}>
                    {pub.year && <span>Год: {pub.year}</span>}
                    {pub.journal && <span>Журнал: {pub.journal}</span>}
                    {pub.doi && <span>DOI: {pub.doi}</span>}
                    {pub.volume && <span>Т. {pub.volume}</span>}
                    {pub.issue && <span>Вып. {pub.issue}</span>}
                    {pub.pages && <span>С. {pub.pages}</span>}
                    {pub.extraction_confidence && (
                      <span className={`${styles.confidenceBadge} ${
                        styles[`confidence${pub.extraction_confidence.charAt(0).toUpperCase() + pub.extraction_confidence.slice(1)}`]
                      }`}>
                        {CONFIDENCE_LABEL[pub.extraction_confidence]}
                      </span>
                    )}
                  </div>
                  {pub.gost_string && (
                    <div className={styles.pubGost}>{pub.gost_string}</div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}