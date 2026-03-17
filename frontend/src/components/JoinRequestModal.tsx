import { useState } from 'react';
import client from '../api/client';
import styles from '../styles/Modal.module.scss';

interface Props {
  projectId: number;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLE_OPTIONS = [
  { value: 'developer', label: 'Разработчик' },
  { value: 'analyst', label: 'Аналитик' },
  { value: 'tester', label: 'Тестировщик' },
  { value: 'designer', label: 'Дизайнер' },
  { value: 'researcher', label: 'Исследователь' },
];

export default function JoinRequestModal({ projectId, onClose, onSuccess }: Props) {
  const [desiredRole, setDesiredRole] = useState('developer');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await client.post(`/projects/${projectId}/join-requests/`, {
        desired_role: desiredRole,
        message,
      });
      onSuccess();
    } catch (err) {
      const resp = (err as { response?: { data?: string | string[] | Record<string, string[]> } }).response?.data;
      if (typeof resp === 'string') setError(resp);
      else if (Array.isArray(resp)) setError(resp.join('. '));
      else if (resp) setError(Object.values(resp).flat().join('. '));
      else setError('Ошибка отправки заявки');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Подать заявку</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Желаемая роль</label>
            <select value={desiredRole} onChange={(e) => setDesiredRole(e.target.value)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Сообщение (необязательно)</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Отправка…' : 'Отправить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
