import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { reportApi } from '../api/reportsApi';
import type { Report } from '../types';
import styles from '../styles/Reports.module.scss';

export default function MyReportsPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  const loadReports = async () => {
    setLoading(true);
    try {
      const response = await reportApi.getMyReports();
      setReports(response.data);
    } catch (error) {
      console.error('Ошибка загрузки отчетов:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

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

  const filteredReports = reports.filter(report => {
    if (tabValue === 0) return report.status === 'pending' || report.status === 'draft';
    if (tabValue === 1) return report.status === 'submitted' || report.status === 'reviewed';
    if (tabValue === 2) return report.status === 'rejected';
    return true;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Мои отчеты</h1>
          <p className={styles.subtitle}>Отслеживание ваших отчетов по проектам</p>
        </div>
      </div>

      <div style={{ borderBottom: '1px solid #e0e0e0', marginBottom: 16 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="Требуют заполнения" />
          <Tab label="На проверке / Проверены" />
          <Tab label="На доработке" />
        </Tabs>
      </div>

      {filteredReports.length === 0 ? (
        <Alert severity="info">
          Нет отчетов в этом разделе
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Проект</TableCell>
                <TableCell>Отчет</TableCell>
                <TableCell>Период</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Дедлайн</TableCell>
                <TableCell>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredReports.map((report) => (
                <TableRow key={report.id} className={report.is_overdue && report.status === 'pending' ? styles.overdueRow : ''}>
                  <TableCell>{report.template_title.split(' - ')[0]}</TableCell>
                  <TableCell>{report.template_title}</TableCell>
                  <TableCell>{report.period_start} — {report.period_end}</TableCell>
                  <TableCell>
                    <Chip 
                      label={getStatusDisplay(report.status)} 
                      size="small" 
                      color={getStatusColor(report.status)}
                    />
                  </TableCell>
                  <TableCell className={report.is_overdue && report.status === 'pending' ? styles.overdueDate : ''}>
                    {new Date(report.deadline).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => navigate(`/reports/${report.id}`)}>
                      <ViewIcon />
                    </IconButton>
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