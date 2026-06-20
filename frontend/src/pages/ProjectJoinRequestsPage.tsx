import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useToast } from '../contexts/ToastContext';
import type { JoinRequest } from '../types';
import styles from '../styles/ProjectJoinRequests.module.scss';

const ROLE_LABELS: Record<string, string> = {
  analyst: 'Аналитик',
  developer: 'Разработчик',
  tester: 'Тестировщик',
  designer: 'Дизайнер',
  researcher: 'Исследователь',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'На рассмотрении',
  approved: 'Одобрена',
  rejected: 'Отклонена',
};

const STATUS_CLASSES: Record<string, string> = {
  pending: styles.statusPending,
  approved: styles.statusApproved,
  rejected: styles.statusRejected,
};

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

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loader}>Загрузка заявок...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button
          className={styles.backButton}
          onClick={() => navigate(`/projects/${id}`)}
        >
          ← Назад к проекту
        </button>
      </div>

      <div className={styles.filtersWrapper}>
        <select 
          className={styles.filterSelect} 
          value={filterStatus} 
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="pending">На рассмотрении</option>
          <option value="approved">Одобренные</option>
          <option value="rejected">Отклонённые</option>
        </select>
      </div>

      {requests.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyStateIcon}>📋</span>
          <div className={styles.emptyStateTitle}>Нет заявок</div>
          <div className={styles.emptyStateText}>
            Заявки на вступление в проект отсутствуют
          </div>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
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
                    <div className={styles.userInfo}>
                      <span className={styles.userName}>{req.user?.full_name || `ID: ${req.user?.id}`}</span>
                      <span className={styles.userEmail}>{req.user?.email}</span>
                    </div>
                  </td>
                  <td>{ROLE_LABELS[req.desired_role] || req.desired_role}</td>
                  <td>{req.message || '—'}</td>
                  <td>{new Date(req.created_at).toLocaleDateString()}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${STATUS_CLASSES[req.status] || styles.statusPending}`}>
                      {STATUS_LABELS[req.status] || req.status}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionsWrapper}>
                      {req.status === 'pending' && (
                        <>
                          <button
                            className={styles.approveBtn}
                            onClick={() => handleReview(req.id, 'approved', req.desired_role)}
                          >
                            Одобрить
                          </button>
                          <button
                            className={styles.rejectBtn}
                            onClick={() => handleReview(req.id, 'rejected')}
                          >
                            Отклонить
                          </button>
                        </>
                      )}
                      {req.status === 'rejected' && (
                        <span className={styles.statusRejectedText}>Отклонена</span>
                      )}
                      {req.status === 'approved' && (
                        <span className={styles.statusApprovedText}>Участник добавлен</span>
                      )}
                    </div>
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