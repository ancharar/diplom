import { Card, CardContent, Typography, Chip, IconButton, Divider } from '@mui/material';
import {
  Visibility as ViewIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { Report } from '../types';

interface ReportCardProps {
  report: Report;
  showProject?: boolean;
  onView?: () => void;
}

const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
  switch (status) {
    case 'submitted':
    case 'reviewed':
      return 'success';
    case 'pending':
    case 'draft':
      return 'warning';
    case 'rejected':
      return 'error';
    default:
      return 'default';
  }
};

const getStatusIcon = (status: string, isOverdue: boolean) => {
  if (isOverdue && status === 'pending') {
    return <WarningIcon style={{ color: '#f44336', fontSize: 16 }} />;
  }
  if (status === 'submitted' || status === 'reviewed') {
    return <CheckCircleIcon style={{ color: '#4caf50', fontSize: 16 }} />;
  }
  return <PendingIcon style={{ color: '#ff9800', fontSize: 16 }} />;
};

const getStatusDisplay = (status: string) => {
  switch (status) {
    case 'pending': return 'Ожидает заполнения';
    case 'draft': return 'Черновик';
    case 'submitted': return 'На проверке';
    case 'reviewed': return 'Проверен';
    case 'rejected': return 'Отправлен на доработку';
    default: return status;
  }
};

export default function ReportCard({ report, showProject = false, onView }: ReportCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onView) {
      onView();
    } else {
      navigate(`/reports/${report.id}`);
    }
  };

  const isOverdue = report.is_overdue && report.status === 'pending';

  const cardStyle: React.CSSProperties = {
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    borderLeft: isOverdue ? '4px solid #f44336' : 'none',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  };

  const periodStyle: React.CSSProperties = {
    marginBottom: 12,
  };

  const dividerStyle: React.CSSProperties = {
    margin: '8px 0',
  };

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  };

  const infoGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: 16,
  };

  const infoItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  };

  const commentStyle: React.CSSProperties = {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#ffebee',
    borderRadius: 4,
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)';
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = '';
  };

  return (
    <Card 
      style={cardStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <CardContent>
        <div style={headerStyle}>
          <Typography variant="h6" component="div" style={{ fontSize: '1rem', fontWeight: 600 }}>
            {report.template_title}
          </Typography>
          <Chip 
            icon={getStatusIcon(report.status, report.is_overdue)}
            label={getStatusDisplay(report.status)} 
            size="small" 
            color={getStatusColor(report.status)}
          />
        </div>

        {showProject && (
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Проект: {report.template_title.split(' - ')[0]}
          </Typography>
        )}

        <Typography variant="body2" color="textSecondary" style={periodStyle}>
          {report.period_start} — {report.period_end}
        </Typography>

        <Divider style={dividerStyle} />

        <div style={footerStyle}>
          <div style={infoGroupStyle}>
            <div style={infoItemStyle}>
              <ScheduleIcon style={{ fontSize: 14, color: '#8aa4ac' }} />
              <Typography variant="caption" color="textSecondary">
                Дедлайн: {new Date(report.deadline).toLocaleDateString()}
              </Typography>
            </div>
            <div style={infoItemStyle}>
              <PersonIcon style={{ fontSize: 14, color: '#8aa4ac' }} />
              <Typography variant="caption" color="textSecondary">
                {report.user.full_name}
              </Typography>
            </div>
          </div>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleClick(); }}>
            <ViewIcon fontSize="small" />
          </IconButton>
        </div>

        {report.review_comment && report.status === 'rejected' && (
          <div style={commentStyle}>
            <Typography variant="caption" style={{ color: '#f44336' }}>
              Комментарий: {report.review_comment}
            </Typography>
          </div>
        )}
      </CardContent>
    </Card>
  );
}