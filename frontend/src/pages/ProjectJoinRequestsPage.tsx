// frontend/src/pages/ProjectJoinRequestsPage.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useToast } from '../contexts/ToastContext';
import type { JoinRequest } from '../types';
import styles from '../styles/ProjectDetail.module.scss';

export default function ProjectJoinRequestsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  const fetchRequests = async () => {
    try {
      const params: Record<string, string> = {};
      if (filterStatus) params.status = filterStatus;
      const { data } = await client.get(`/projects/${id}/join-requests/`, { params });
      setRequests(data);
    } catch {
      // Ошибка загрузки заявок (игнорируем, просто показываем пустой список)
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (reqId: number, action: 'approved' | 'rejected', assignedRole?: string) => {
    try {
      const payload: Record<string, string> = { action };
      if (assignedRole) payload.assigned_role = assignedRole;
      await client.patch(`/projects/${id}/join-requests/${reqId}/`, payload);
      showSuccess(action === 'approved' ? 'Заявка одобрена' : 'Заявка отклонена');
      fetchRequests();
    } catch {
      showError('Ошибка обработки заявки');
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [id, filterStatus]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'На рассмотрении';
      case 'approved': return 'Одобрена';
      case 'rejected': return 'Отклонена';
      default: return status;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return { background: '#fff3e0', color: '#ff9800' };
      case 'approved':
        return { background: '#e8f5e9', color: '#4caf50' };
      case 'rejected':
        return { background: '#ffebee', color: '#f44336' };
      default:
        return { background: '#f0f0f0', color: '#666' };
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className={styles.loading}>Загрузка заявок...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className={styles.topActions}>
        <button
          className={`btn btn-outline ${styles.actionBtn}`}
          onClick={() => navigate(`/projects/${id}`)}
        >
          ← Вернуться к проекту
        </button>
      </div>

      <div className={styles.topGrid} style={{ marginBottom: 24 }}>
        <div className={styles.infoCard}>
          <h1 className={styles.projectTitle}>Заявки на вступление</h1>
          <p className={styles.subtitle}>Управление заявками пользователей на участие в проекте</p>
        </div>
      </div>

      <div className={styles.tabHeader}>
        <div className={styles.filters}>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Все статусы</option>
            <option value="pending">На рассмотрении</option>
            <option value="approved">Одобренные</option>
            <option value="rejected">Отклонённые</option>
          </select>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Нет заявок на вступление</p>
        </div>
      ) : (
        <div className={styles.tabContent}>
          <table className={styles.requestTable}>
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Желаемая роль</th>
                <th>Сообщение</th>
                <th>Дата подачи</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id}>
                  <td>
                    <strong>{req.user?.full_name || `ID: ${req.user?.id}`}</strong>
                    <br />
                    <span style={{ fontSize: 12, color: '#8aa4ac' }}>{req.user?.email}</span>
                  </td>
                  <td>{req.desired_role}</td>
                  <td>{req.message || '—'}</td>
                  <td>{new Date(req.created_at).toLocaleDateString()}</td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        ...getStatusStyle(req.status),
                      }}
                    >
                      {getStatusLabel(req.status)}
                    </span>
                  </td>
                  <td>
                    {req.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleReview(req.id, 'approved', req.desired_role)}
                        >
                          Одобрить
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleReview(req.id, 'rejected')}
                        >
                          Отклонить
                        </button>
                      </div>
                    )}
                    {req.status === 'rejected' && (
                      <span style={{ fontSize: 12, color: '#8aa4ac' }}>Отклонена</span>
                    )}
                    {req.status === 'approved' && (
                      <span style={{ fontSize: 12, color: '#4caf50' }}>Участник добавлен</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}