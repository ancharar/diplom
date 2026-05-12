import { Paper, Typography, Chip, LinearProgress } from '@mui/material';
import type { ReportSummary as ReportSummaryType } from '../types';

interface ReportSummaryProps {
  summary: ReportSummaryType;
  title?: string;
}

export default function ReportSummary({ summary, title = 'Статистика отчетов' }: ReportSummaryProps) {
  const statsCards = [
    {
      title: 'Всего отчетов',
      value: summary.total_reports,
      icon: '📊',
      color: '#1976d2',
      bgcolor: '#e3f2fd',
    },
    {
      title: 'Сдано',
      value: summary.submitted_reports,
      icon: '✅',
      color: '#4caf50',
      bgcolor: '#e8f5e9',
    },
    {
      title: 'Ожидают',
      value: summary.pending_reports,
      icon: '⏳',
      color: '#ff9800',
      bgcolor: '#fff3e0',
    },
    {
      title: 'Просрочено',
      value: summary.overdue_reports,
      icon: '⚠️',
      color: '#f44336',
      bgcolor: '#ffebee',
    },
  ];

  const cardStyle: React.CSSProperties = {
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
  };

  const iconStyle: React.CSSProperties = {
    fontSize: 32,
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>📈</span>
        <Typography variant="h6">{title}</Typography>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {statsCards.map((card) => (
          <Paper
            key={card.title}
            style={{ ...cardStyle, backgroundColor: card.bgcolor }}
          >
            <div>
              <Typography variant="body2" style={{ color: '#666' }}>
                {card.title}
              </Typography>
              <Typography variant="h4" style={{ color: card.color, fontWeight: 'bold' }}>
                {card.value}
              </Typography>
            </div>
            <span style={{ ...iconStyle, color: card.color }}>{card.icon}</span>
          </Paper>
        ))}
      </div>

      <Paper style={{ padding: 16, marginBottom: 24 }}>
        <Typography variant="subtitle2" gutterBottom>
          Общий прогресс
        </Typography>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <LinearProgress 
              variant="determinate" 
              value={summary.completion_rate} 
              style={{ height: 10, borderRadius: 5 }}
            />
          </div>
          <Typography variant="body2" style={{ fontWeight: 'bold' }}>
            {summary.completion_rate}%
          </Typography>
        </div>
      </Paper>

      <Paper style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: 12, textAlign: 'left' }}>Участник</th>
              <th style={{ padding: 12, textAlign: 'center' }}>Всего</th>
              <th style={{ padding: 12, textAlign: 'center' }}>Сдано</th>
              <th style={{ padding: 12, textAlign: 'center' }}>Ожидает</th>
              <th style={{ padding: 12, textAlign: 'center' }}>Просрочено</th>
              <th style={{ padding: 12, textAlign: 'center' }}>%</th>
            </tr>
          </thead>
          <tbody>
            {summary.user_stats.map((stat) => (
              <tr key={stat.user_id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: 12 }}>{stat.full_name}</td>
                <td style={{ padding: 12, textAlign: 'center' }}>{stat.total}</td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <Chip label={stat.submitted} size="small" color="success" />
                </td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <Chip label={stat.pending} size="small" color="warning" />
                </td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  {stat.overdue > 0 ? (
                    <Chip label={stat.overdue} size="small" color="error" />
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <LinearProgress
                      variant="determinate"
                      value={stat.completion_rate}
                      style={{ width: 60, height: 6, borderRadius: 3 }}
                    />
                    <Typography variant="body2">{stat.completion_rate}%</Typography>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Paper>
    </div>
  );
}