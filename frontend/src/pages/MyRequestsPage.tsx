import { useEffect, useState } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from '@mui/material';
import client from '../api/client';
import type { JoinRequest } from '../types';
import styles from '../styles/MyRequests.module.scss';

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

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const { data } = await client.get<JoinRequest[]>('/users/me/join-requests/');
      setRequests(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleCancel = async (reqId: number) => {
    if (!confirm('Отозвать заявку?')) return;
    try {
      await client.delete(`/users/me/join-requests/${reqId}/`);
      fetchRequests();
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className={styles.loader}>
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
      </div>

      {requests.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>📋</div>
          <div className={styles.emptyStateTitle}>Нет заявок</div>
          <div className={styles.emptyStateText}>
            Вы пока не подавали заявок на участие в проектах
          </div>
        </div>
      ) : (
        <TableContainer component={Paper} className={styles.tableContainer}>
          <Table className={styles.requestTable}>
            <TableHead>
              <TableRow>
                <TableCell>Проект</TableCell>
                <TableCell>Желаемая роль</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Дата подачи</TableCell>
                <TableCell>Рассмотрел</TableCell>
                <TableCell>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>Проект #{r.project}</TableCell>
                  <TableCell>{ROLE_LABELS[r.desired_role] || r.desired_role}</TableCell>
                  <TableCell>
                    <span className={`${styles.statusBadge} ${STATUS_CLASSES[r.status] || styles.statusPending}`}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </TableCell>
                  <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{r.reviewed_by?.full_name || '—'}</TableCell>
                  <TableCell>
                    {r.status === 'pending' && (
                      <button 
                        className={styles.cancelButton} 
                        onClick={() => handleCancel(r.id)}
                      >
                        Отозвать
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}