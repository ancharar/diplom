import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import type { GostBlock, GostTemplate } from '../types';
import styles from '../styles/GostConstructor.module.scss';

const SOURCE_TYPE_LABELS: Record<string, string> = {
  journal_article: 'Статья в журнале',
  book: 'Книга',
  collection_article: 'Статья в сборнике',
  electronic_resource: 'Электронный ресурс',
  newspaper_article: 'Статья в газете',
  dissertation: 'Диссертация',
  gost_standard: 'ГОСТ, стандарты, приказы',
  conference_theses: 'Тезисы докладов',
};

const FIELD_OPTIONS = [
  { key: 'authors', label: 'Авторы' },
  { key: 'title', label: 'Название' },
  { key: 'journal', label: 'Журнал' },
  { key: 'year', label: 'Год' },
  { key: 'volume', label: 'Том' },
  { key: 'issue', label: 'Выпуск' },
  { key: 'pages', label: 'Страницы' },
  { key: 'url', label: 'URL' },
  { key: 'doi', label: 'DOI' },
  { key: 'publisher', label: 'Издательство' },
  { key: 'city', label: 'Город' },
  { key: 'total_pages', label: 'Кол-во страниц' },
  { key: 'access_date', label: 'Дата обращения' },
];

const SEPARATOR_OPTIONS = [
  { key: 'dot', label: '. ' },
  { key: 'comma', label: ', ' },
  { key: 'dash', label: ' \u2013 ' },
  { key: 'dot_dash', label: '. \u2013 ' },
  { key: 'slash', label: ' / ' },
  { key: 'double_slash', label: ' // ' },
  { key: 'colon', label: ' : ' },
  { key: 'number_sign', label: '\u2116 ' },
  { key: 'volume_sign', label: '\u0422. ' },
  { key: 'pages_sign_ru', label: '\u0421. ' },
  { key: 'pages_sign_en', label: 'P. ' },
  { key: 'et_al', label: '[\u0438 \u0434\u0440.]' },
  { key: 'url_prefix', label: '\u2013 URL: ' },
  { key: 'electronic_suffix', label: 'Электронный' },
  { key: 'direct_suffix', label: 'Непосредственный' },
  { key: 'access_date_wrap', label: '(дата обращения: ...)' },
];

export default function GostConstructorPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<GostTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [sourceType, setSourceType] = useState('journal_article');
  const [blocks, setBlocks] = useState<GostBlock[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    try {
      const { data } = await client.get<GostTemplate[]>(
        `/projects/${projectId}/literature/gost-templates/`,
      );
      setTemplates(data);
    } catch {
      setError('Ошибка загрузки шаблонов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [projectId]);

  const addBlock = (type: 'field' | 'separator', key: string) => {
    setBlocks((prev) => [...prev, { type, key }]);
  };

  const removeBlock = (index: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (blocks.length === 0) {
      setError('Добавьте хотя бы один блок');
      return;
    }
    setError('');
    try {
      if (editingId) {
        await client.put(
          `/projects/${projectId}/literature/gost-templates/${editingId}/`,
          { source_type: sourceType, blocks },
        );
      } else {
        await client.post(
          `/projects/${projectId}/literature/gost-templates/`,
          { source_type: sourceType, blocks },
        );
      }
      setBlocks([]);
      setEditingId(null);
      setSourceType('journal_article');
      fetchTemplates();
    } catch {
      setError('Ошибка сохранения шаблона');
    }
  };

  const handleEdit = (t: GostTemplate) => {
    setEditingId(t.id);
    setSourceType(t.source_type);
    setBlocks(t.blocks);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить ГОСТ-шаблон?')) return;
    try {
      await client.delete(
        `/projects/${projectId}/literature/gost-templates/${id}/`,
      );
      fetchTemplates();
    } catch {
      setError('Ошибка удаления');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setBlocks([]);
    setSourceType('journal_article');
  };

  // Preview
  const previewText = blocks.map((b) => {
    if (b.type === 'field') {
      const opt = FIELD_OPTIONS.find((f) => f.key === b.key);
      return `[${opt?.label || b.key}]`;
    }
    const sep = SEPARATOR_OPTIONS.find((s) => s.key === b.key);
    return sep?.label || b.key;
  }).join('');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <button
            className="btn btn-outline"
            onClick={() => navigate(`/projects/${projectId}`)}
            style={{ marginBottom: 12 }}
          >
            ← Назад к проекту
          </button>
          <h1 className={styles.title}>Конструктор ГОСТ</h1>
          <p className={styles.subtitle}>
            Настройка шаблонов библиографических ссылок
          </p>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Конструктор */}
      <div className={styles.constructorCard}>
        <h3 className={styles.cardTitle}>
          {editingId ? 'Редактирование шаблона' : 'Новый шаблон'}
        </h3>

        <div style={{ marginBottom: 16 }}>
          <select
            className={styles.typeSelect}
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
          >
            {Object.entries(SOURCE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className={styles.blockList}>
          {blocks.length === 0 && (
            <span style={{ color: '#8aa4ac', fontSize: 13 }}>
              Добавьте блоки шаблона ниже
            </span>
          )}
          {blocks.map((b, i) => (
            <span
              key={i}
              className={`${styles.blockItem} ${
                b.type === 'field' ? styles.blockField : styles.blockSeparator
              }`}
            >
              {b.type === 'field'
                ? FIELD_OPTIONS.find((f) => f.key === b.key)?.label || b.key
                : SEPARATOR_OPTIONS.find((s) => s.key === b.key)?.label || b.key}
              <button
                className={styles.removeBlock}
                onClick={() => removeBlock(i)}
              >
                x
              </button>
            </span>
          ))}
        </div>

        <div className={styles.addBlockSection}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#17323b' }}>
            Поля:
          </span>
          <div className={styles.addBlockGroup}>
            {FIELD_OPTIONS.map((f) => (
              <button
                key={f.key}
                className={`${styles.addBlockBtn} ${styles.addFieldBtn}`}
                onClick={() => addBlock('field', f.key)}
              >
                + {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.addBlockSection} style={{ marginTop: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#17323b' }}>
            Разделители:
          </span>
          <div className={styles.addBlockGroup}>
            {SEPARATOR_OPTIONS.map((s) => (
              <button
                key={s.key}
                className={`${styles.addBlockBtn} ${styles.addSepBtn}`}
                onClick={() => addBlock('separator', s.key)}
              >
                + {s.label}
              </button>
            ))}
          </div>
        </div>

        {blocks.length > 0 && (
          <div className={styles.previewSection}>
            <div className={styles.previewLabel}>Предпросмотр формата:</div>
            <div className={styles.previewText}>{previewText}</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-primary" onClick={handleSave}>
            {editingId ? 'Обновить' : 'Сохранить'}
          </button>
          {editingId && (
            <button className="btn btn-outline" onClick={handleCancel}>
              Отмена
            </button>
          )}
        </div>
      </div>

      {/* Список существующих шаблонов */}
      <h3 className={styles.cardTitle}>Существующие шаблоны</h3>
      {loading ? (
        <p>Загрузка...</p>
      ) : templates.length === 0 ? (
        <div className={styles.emptyState}>
          Нет ГОСТ-шаблонов. Создайте первый выше.
        </div>
      ) : (
        <div className={styles.templateList}>
          {templates.map((t) => (
            <div key={t.id} className={styles.templateItem}>
              <div>
                <div className={styles.templateType}>
                  {SOURCE_TYPE_LABELS[t.source_type] || t.source_type}
                </div>
                <div className={styles.templateBlocks}>
                  Блоков: {t.blocks.length}
                </div>
              </div>
              <div className={styles.templateActions}>
                <button
                  className={styles.editBtn}
                  onClick={() => handleEdit(t)}
                >
                  Редактировать
                </button>
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(t.id)}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
