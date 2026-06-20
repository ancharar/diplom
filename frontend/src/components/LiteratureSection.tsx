import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';
import client from '../api/client';
import { SkeletonTable } from '../components/Skeleton';
import { useToast } from '../contexts/ToastContext';
import type { LiteratureSource, ArxivResult } from '../types';
import styles from '../styles/LiteratureSection.module.scss';

interface LiteratureSectionProps {
  projectId?: string;
  projectArea?: string;
}

type LiteratureFilter = 'all' | 'journal_article' | 'book' | 'collection_article' | 'electronic_resource' | 'newspaper_article' | 'dissertation' | 'gost_standard' | 'conference_theses' | 'arxiv';

interface UserData {
  id: number;
}

interface ProjectOwnerData {
  id?: number;
  owner?: number | { id?: number };
  owner_id?: number;
  created_by?: number | { id?: number };
  created_by_id?: number;
}

const emptySourceForm = {
  title: '',
  authors: '',
  year: '',
  url: '',
  description: '',
  tags: '',
  source_type: '',
  journal: '',
  volume: '',
  issue: '',
  pages: '',
  doi: '',
  publisher: '',
  city: '',
  total_pages: '',
  access_date: '',
};

const getSourceTypeLabel = (type?: string) => {
  switch (type) {
    case 'journal_article': return 'Статья';
    case 'book': return 'Книга';
    case 'collection_article': return 'Статья в сборнике';
    case 'electronic_resource': return 'Электронный ресурс';
    case 'newspaper_article': return 'Газета';
    case 'dissertation': return 'Диссертация';
    case 'gost_standard': return 'ГОСТ/Приказ';
    case 'conference_theses': return 'Тезисы';
    default: return 'Источник';
  }
};

const isArxivSource = (source: LiteratureSource) => {
  const url = source.url?.toLowerCase() || '';
  const tags = source.tags?.map((tag) => tag.toLowerCase()) || [];
  return url.includes('arxiv.org') || tags.some((tag) => tag.includes('arxiv'));
};

const getProjectOwnerId = (project: ProjectOwnerData) => {
  if (typeof project.owner === 'number') return project.owner;
  if (typeof project.owner === 'object') return project.owner?.id;
  if (typeof project.owner_id === 'number') return project.owner_id;
  if (typeof project.created_by === 'number') return project.created_by;
  if (typeof project.created_by === 'object') return project.created_by?.id;
  if (typeof project.created_by_id === 'number') return project.created_by_id;
  return undefined;
};

export default function LiteratureSection({ projectId, projectArea }: LiteratureSectionProps) {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [sources, setSources] = useState<LiteratureSource[]>([]);
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [sourceForm, setSourceForm] = useState(emptySourceForm);
  const [sourceError, setSourceError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<LiteratureFilter>('all');

  const [gostEditing, setGostEditing] = useState<Set<string>>(new Set());
  const [gostDraft, setGostDraft] = useState<Record<string, string>>({});

  const [arxivQuery, setArxivQuery] = useState('');
  const [arxivResults, setArxivResults] = useState<ArxivResult[]>([]);
  const [arxivSourceTypes, setArxivSourceTypes] = useState<Record<string, string>>({});
  const [arxivLoading, setArxivLoading] = useState(false);
  const [arxivError, setArxivError] = useState('');
  const [arxivSaving, setArxivSaving] = useState<Set<string>>(new Set());

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [projectOwnerId, setProjectOwnerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const isOwner = Boolean(
    currentUserId !== null && projectOwnerId !== null && currentUserId === projectOwnerId
  );

  const fetchSources = async () => {
    if (!projectId) return;
    try {
      const { data } = await client.get<LiteratureSource[]>(`/projects/${projectId}/literature/sources/`);
      setSources(data);
    } catch {
      // ignore
    }
  };

  const fetchOwnerData = async () => {
    if (!projectId) return;
    try {
      const [meResponse, projectResponse] = await Promise.all([
        client.get<UserData>('/users/me/'),
        client.get<ProjectOwnerData>(`/projects/${projectId}/`),
      ]);
      setCurrentUserId(meResponse.data.id);
      setProjectOwnerId(getProjectOwnerId(projectResponse.data) ?? null);
    } catch {
      setCurrentUserId(null);
      setProjectOwnerId(null);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([fetchSources(), fetchOwnerData()]).finally(() => setLoading(false));
  }, [projectId]);

  const stats = useMemo(() => {
    const articles = sources.filter((s) => s.source_type === 'journal_article').length;
    const books = sources.filter((s) => s.source_type === 'book').length;
    const arxiv = sources.filter(isArxivSource).length;
    return { total: sources.length, articles, books, arxiv };
  }, [sources]);

  const filteredSources = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sources.filter((source) => {
      const matchesSearch = !query
        || source.title?.toLowerCase().includes(query)
        || source.authors?.toLowerCase().includes(query)
        || source.description?.toLowerCase().includes(query)
        || source.tags?.some((tag) => tag.toLowerCase().includes(query));
      const matchesFilter = activeFilter === 'all'
        || (activeFilter === 'arxiv' && isArxivSource(source))
        || source.source_type === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [sources, searchQuery, activeFilter]);

  const handleCreateSource = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    setSourceError('');
    try {
      const payload: Record<string, unknown> = { title: sourceForm.title };
      if (sourceForm.authors) payload.authors = sourceForm.authors;
      if (sourceForm.year) payload.year = Number(sourceForm.year);
      if (sourceForm.url) payload.url = sourceForm.url;
      if (sourceForm.description) payload.description = sourceForm.description;
      if (sourceForm.tags) payload.tags = sourceForm.tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (sourceForm.source_type) payload.source_type = sourceForm.source_type;
      if (sourceForm.journal) payload.journal = sourceForm.journal;
      if (sourceForm.volume) payload.volume = sourceForm.volume;
      if (sourceForm.issue) payload.issue = sourceForm.issue;
      if (sourceForm.pages) payload.pages = sourceForm.pages;
      if (sourceForm.doi) payload.doi = sourceForm.doi;
      if (sourceForm.publisher) payload.publisher = sourceForm.publisher;
      if (sourceForm.city) payload.city = sourceForm.city;
      if (sourceForm.total_pages) payload.total_pages = sourceForm.total_pages;
      if (sourceForm.access_date) payload.access_date = sourceForm.access_date;

      await client.post(`/projects/${projectId}/literature/sources/`, payload);
      setShowSourceForm(false);
      setSourceForm(emptySourceForm);
      showSuccess('Источник добавлен');
      fetchSources();
    } catch {
      setSourceError('Ошибка создания источника');
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!projectId) return;
    try {
      await client.delete(`/projects/${projectId}/literature/sources/${sourceId}/`);
      showSuccess('Источник удален');
      fetchSources();
    } catch {
      showError('Ошибка удаления источника');
    }
  };

  const handleGostEdit = (source: LiteratureSource) => {
    setGostDraft((prev) => ({ ...prev, [source.id]: source.gost_string ?? '' }));
    setGostEditing((prev) => new Set(prev).add(source.id));
  };

  const handleGostCancel = (sourceId: string) => {
    setGostEditing((prev) => {
      const next = new Set(prev);
      next.delete(sourceId);
      return next;
    });
  };

  const handleGostSave = async (sourceId: string) => {
    if (!projectId) return;
    try {
      await client.patch(`/projects/${projectId}/literature/sources/${sourceId}/`, {
        gost_string: gostDraft[sourceId],
      });
      setGostEditing((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
      showSuccess('ГОСТ сохранен');
      fetchSources();
    } catch {
      showError('Ошибка сохранения ГОСТ');
    }
  };

  const handleCopyGost = async (gost?: string | null) => {
    if (!gost) return;
    try {
      await navigator.clipboard.writeText(gost);
      showSuccess('ГОСТ скопирован');
    } catch {
      showError('Не удалось скопировать ГОСТ');
    }
  };

  const handleArxivSearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!projectId) return;
    const q = arxivQuery.trim();
    if (!q) return;

    setArxivLoading(true);
    setArxivError('');
    setArxivResults([]);

    try {
      const { data } = await client.get<{ results: ArxivResult[] }>(
        `/projects/${projectId}/literature/arxiv-search/`,
        { params: { q, max_results: 10 } }
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
    if (!projectId) return;
    setArxivSaving((prev) => new Set(prev).add(result.arxiv_id));
    try {
      const payload = {
        title: result.title,
        authors: result.authors,
        year: result.year,
        url: result.url,
        description: result.summary.length > 500 ? `${result.summary.substring(0, 497)}...` : result.summary,
        tags: [...result.categories, 'arXiv'],
        source_type: arxivSourceTypes[result.arxiv_id] || 'journal_article',
      };
      await client.post(`/projects/${projectId}/literature/sources/`, payload);
      showSuccess('Статья сохранена в источники');
      fetchSources();
    } catch {
      showError('Ошибка сохранения статьи');
    } finally {
      setArxivSaving((prev) => {
        const next = new Set(prev);
        next.delete(result.arxiv_id);
        return next;
      });
    }
  };

  return (
    <div className={styles.literatureSection}>
      {/* Header с кнопками - разделены на левую и правую части */}
      <div className={styles.pageHeader}>
        <div className={styles.pageActions}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => projectId && navigate(`/projects/${projectId}`)}
          >
            ← Назад к проекту
          </button>
        </div>

        <div className={styles.pageActionsRight}>
          {isOwner && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => projectId && navigate(`/projects/${projectId}/gost`)}
            >
              Конструктор ГОСТ
            </button>
          )}
        </div>
      </div>

      {/* Статистика */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.total}</span>
          <span className={styles.statLabel}>Всего источников</span>
        </div>
        <div className={`${styles.statCard} ${styles.statArticles}`}>
          <span className={styles.statValue}>{stats.articles}</span>
          <span className={styles.statLabel}>Статьи</span>
        </div>
        <div className={`${styles.statCard} ${styles.statBooks}`}>
          <span className={styles.statValue}>{stats.books}</span>
          <span className={styles.statLabel}>Книги</span>
        </div>
        <div className={`${styles.statCard} ${styles.statArxiv}`}>
          <span className={styles.statValue}>{stats.arxiv}</span>
          <span className={styles.statLabel}>Источники с arXiv</span>
        </div>
      </div>

      {/* Панель поиска и фильтров */}
      <div className={styles.toolbarCard}>
        <div className={styles.searchRow}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Поиск по названию, автору или тегам"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button type="button" className={styles.clearSearchBtn} onClick={() => setSearchQuery('')}>
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setShowSourceForm(!showSourceForm)}
          >
            {showSourceForm ? 'Отмена' : '+ Добавить источник'}
          </button>
        </div>

        <div className={styles.filterTabs}>
          {[
            { key: 'all', label: 'Все' },
            { key: 'journal_article', label: 'Статьи' },
            { key: 'book', label: 'Книги' },
            { key: 'collection_article', label: 'В сборнике' },
            { key: 'electronic_resource', label: 'Электронные ресурсы' },
            { key: 'newspaper_article', label: 'Газеты' },
            { key: 'dissertation', label: 'Диссертации' },
            { key: 'gost_standard', label: 'ГОСТы / Приказы' },
            { key: 'conference_theses', label: 'Тезисы' },
            { key: 'arxiv', label: 'arXiv' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`${styles.filterTab} ${activeFilter === key ? styles.filterTabActive : ''}`}
              onClick={() => setActiveFilter(key as LiteratureFilter)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Форма добавления источника */}
      {showSourceForm && (
        <form className={styles.sourceForm} onSubmit={handleCreateSource}>
          <select
            value={sourceForm.source_type}
            onChange={(e) => setSourceForm({ ...sourceForm, source_type: e.target.value })}
          >
            <option value="">Тип источника (для ГОСТ)</option>
            <option value="journal_article">Статья в журнале</option>
            <option value="book">Книга</option>
            <option value="collection_article">Статья в сборнике</option>
            <option value="electronic_resource">Электронный ресурс</option>
            <option value="newspaper_article">Статья в газете</option>
            <option value="dissertation">Диссертация</option>
            <option value="gost_standard">ГОСТ, стандарты, приказы</option>
            <option value="conference_theses">Тезисы докладов</option>
          </select>
          <input
            placeholder="Название *"
            value={sourceForm.title}
            onChange={(e) => setSourceForm({ ...sourceForm, title: e.target.value })}
            required
          />
          <input
            placeholder="Авторы"
            value={sourceForm.authors}
            onChange={(e) => setSourceForm({ ...sourceForm, authors: e.target.value })}
          />
          <input
            type="number"
            placeholder="Год"
            value={sourceForm.year}
            onChange={(e) => setSourceForm({ ...sourceForm, year: e.target.value })}
          />
          <input
            placeholder="Журнал"
            value={sourceForm.journal}
            onChange={(e) => setSourceForm({ ...sourceForm, journal: e.target.value })}
          />
          <div className={styles.formGridThree}>
            <input
              placeholder="Том"
              value={sourceForm.volume}
              onChange={(e) => setSourceForm({ ...sourceForm, volume: e.target.value })}
            />
            <input
              placeholder="Выпуск / №"
              value={sourceForm.issue}
              onChange={(e) => setSourceForm({ ...sourceForm, issue: e.target.value })}
            />
            <input
              placeholder="Страницы (41–52)"
              value={sourceForm.pages}
              onChange={(e) => setSourceForm({ ...sourceForm, pages: e.target.value })}
            />
          </div>
          <div className={styles.formGridTwo}>
            <input
              placeholder="Издательство"
              value={sourceForm.publisher}
              onChange={(e) => setSourceForm({ ...sourceForm, publisher: e.target.value })}
            />
            <input
              placeholder="Город издания"
              value={sourceForm.city}
              onChange={(e) => setSourceForm({ ...sourceForm, city: e.target.value })}
            />
          </div>
          <div className={styles.formGridTwo}>
            <input
              placeholder="Кол-во страниц"
              value={sourceForm.total_pages}
              onChange={(e) => setSourceForm({ ...sourceForm, total_pages: e.target.value })}
            />
            <input
              placeholder="DOI"
              value={sourceForm.doi}
              onChange={(e) => setSourceForm({ ...sourceForm, doi: e.target.value })}
            />
          </div>
          <input
            className={styles.fullField}
            placeholder="URL"
            value={sourceForm.url}
            onChange={(e) => setSourceForm({ ...sourceForm, url: e.target.value })}
          />
          <input
            className={styles.fullField}
            placeholder="Дата обращения (для эл. ресурсов)"
            value={sourceForm.access_date}
            onChange={(e) => setSourceForm({ ...sourceForm, access_date: e.target.value })}
          />
          <textarea
            className={styles.fullField}
            placeholder="Описание"
            value={sourceForm.description}
            onChange={(e) => setSourceForm({ ...sourceForm, description: e.target.value })}
          />
          <input
            className={styles.fullField}
            placeholder="Теги (через запятую)"
            value={sourceForm.tags}
            onChange={(e) => setSourceForm({ ...sourceForm, tags: e.target.value })}
          />
          {sourceError && <p className={styles.errorMsg}>{sourceError}</p>}
          <button type="submit" className={styles.submitBtn}>Добавить</button>
        </form>
      )}

      {/* Список источников */}
      <section className={styles.sourcesSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h3>Литературные источники</h3>
            <p>Список источников, используемых в проекте</p>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : filteredSources.length > 0 ? (
          <div className={styles.sourceGrid}>
            {filteredSources.map((source) => (
              <article key={source.id} className={styles.sourceCard}>
                <div className={styles.sourceCardHeader}>
                  <span className={styles.sourceType}>
                    {isArxivSource(source) ? 'arXiv' : getSourceTypeLabel(source.source_type)}
                  </span>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => handleDeleteSource(source.id)}
                  >
                    ×
                  </button>
                </div>

                <h4 className={styles.sourceTitle}>
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                  ) : source.title}
                </h4>

                <div className={styles.sourceMeta}>
                  <span>{source.authors || 'Авторы не указаны'}</span>
                  <span>{source.year || 'Год не указан'}</span>
                </div>

                {source.description && (
                  <p className={styles.sourceDescription}>{source.description}</p>
                )}

                {source.tags && source.tags.length > 0 && (
                  <div className={styles.tagsList}>
                    {source.tags.map((tag) => (
                      <span key={tag} className={styles.tag}>{tag}</span>
                    ))}
                  </div>
                )}

                {(source.gost_string || gostEditing.has(source.id)) && (
                  <div className={styles.gostBlock}>
                    <div className={styles.gostBlockHeader}>ГОСТ</div>
                    {gostEditing.has(source.id) ? (
                      <div className={styles.gostEditor}>
                        <textarea
                          value={gostDraft[source.id] ?? ''}
                          onChange={(e) => setGostDraft((prev) => ({
                            ...prev,
                            [source.id]: e.target.value,
                          }))}
                          className={styles.gostTextarea}
                        />
                        <div className={styles.gostEditorActions}>
                          <button
                            type="button"
                            className={styles.smallPrimaryBtn}
                            onClick={() => handleGostSave(source.id)}
                          >
                            Сохранить
                          </button>
                          <button
                            type="button"
                            className={styles.smallOutlineBtn}
                            onClick={() => handleGostCancel(source.id)}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p>{source.gost_string}</p>
                    )}
                  </div>
                )}

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.smallOutlineBtn}
                    onClick={() => handleGostEdit(source)}
                  >
                    {source.gost_string ? 'Редактировать ГОСТ' : 'Добавить ГОСТ'}
                  </button>
                  {source.gost_string && (
                    <button
                      type="button"
                      className={styles.smallPrimaryBtn}
                      onClick={() => handleCopyGost(source.gost_string)}
                    >
                      Скопировать ГОСТ
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📚</div>
            <h3>Литературные источники отсутствуют</h3>
            <p>Добавьте первый источник или импортируйте статьи из arXiv</p>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={() => setShowSourceForm(true)}
            >
              Добавить источник
            </button>
          </div>
        )}
      </section>

      {/* Поиск на arXiv */}
      <section className={styles.arxivSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h3>Поиск научных статей на arXiv</h3>
            <p>Найдите статьи и добавьте их в проект одним кликом</p>
          </div>
        </div>

        <form onSubmit={handleArxivSearch} className={styles.arxivSearchForm}>
          <input
            className={styles.arxivInput}
            type="text"
            placeholder="Например: machine learning, NLP, transformers"
            value={arxivQuery}
            onChange={(e) => setArxivQuery(e.target.value)}
          />
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={arxivLoading || !arxivQuery.trim()}
          >
            {arxivLoading ? 'Поиск...' : 'Найти'}
          </button>
          {projectArea && !arxivQuery && (
            <button
              type="button"
              className={styles.outlineBtn}
              onClick={() => setArxivQuery(projectArea)}
            >
              Область проекта
            </button>
          )}
        </form>

        {arxivError && <p className={styles.errorMsg}>{arxivError}</p>}

        {arxivResults.length > 0 && (
          <div className={styles.arxivResults}>
            {arxivResults.map((result) => (
              <article key={result.arxiv_id} className={styles.arxivCard}>
                <div className={styles.arxivContent}>
                  <div className={styles.arxivInfo}>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.arxivTitle}
                    >
                      {result.title}
                    </a>
                    <div className={styles.arxivMeta}>
                      {result.authors} {result.year && `(${result.year})`}
                    </div>
                    <p className={styles.arxivSummary}>
                      {result.summary.length > 300
                        ? `${result.summary.substring(0, 297)}...`
                        : result.summary}
                    </p>
                    {result.categories.length > 0 && (
                      <div className={styles.arxivTags}>
                        {result.categories.map((category) => (
                          <span key={category} className={styles.arxivTag}>{category}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.arxivActions}>
                    <select
                      value={arxivSourceTypes[result.arxiv_id] ?? 'journal_article'}
                      onChange={(e) => setArxivSourceTypes((prev) => ({
                        ...prev,
                        [result.arxiv_id]: e.target.value,
                      }))}
                      className={styles.arxivSelect}
                    >
                      <option value="journal_article">Статья в журнале</option>
                      <option value="book">Книга</option>
                      <option value="collection_article">Статья в сборнике</option>
                      <option value="electronic_resource">Электронный ресурс</option>
                      <option value="newspaper_article">Статья в газете</option>
                      <option value="dissertation">Диссертация</option>
                    </select>
                    <button
                      type="button"
                      className={styles.smallPrimaryBtn}
                      onClick={() => handleSaveArxivResult(result)}
                      disabled={arxivSaving.has(result.arxiv_id)}
                    >
                      {arxivSaving.has(result.arxiv_id) ? 'Сохранение...' : 'Добавить в проект'}
                    </button>
                    {result.pdf_url && (
                      <a
                        href={result.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.smallOutlineLink}
                      >
                        PDF
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}