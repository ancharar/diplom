import { useEffect, useState } from 'react';
import client from '../api/client';
import Loader from '../components/Loader';
import type { JoinRequest, User } from '../types';

interface Props {
  user: User | null;
}

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

const STATUS_COLORS: Record<string, string> = {
  pending: '#b2bec3',
  approved: '#00b894',
  rejected: '#d63031',
};

export default function MyRequestsPage({ user }: Props) {
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

  if (loading) return <Loader />;

  return (
    <div className="container">
      <h1 className="page-title">Мои заявки</h1>
      <table>
        <thead>
          <tr>
            <th>Проект</th>
            <th>Желаемая роль</th>
            <th>Статус</th>
            <th>Дата подачи</th>
            <th>Рассмотрел</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td>Проект #{r.project}</td>
              <td>{ROLE_LABELS[r.desired_role] || r.desired_role}</td>
              <td>
                <span style={{
                  background: STATUS_COLORS[r.status] || '#b2bec3',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                }}>
                  {STATUS_LABELS[r.status] || r.status}
                </span>
              </td>
              <td>{new Date(r.created_at).toLocaleDateString()}</td>
              <td>{r.reviewed_by?.full_name || '—'}</td>
              <td>
                {r.status === 'pending' && (
                  <button className="btn btn-sm" onClick={() => handleCancel(r.id)}>Отозвать</button>
                )}
              </td>
            </tr>
          ))}
          {requests.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: 'center' }}>Нет заявок</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
