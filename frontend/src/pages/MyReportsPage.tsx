import { useEffect, useState, useRef } from 'react';
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
  Download as DownloadIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { reportApi } from '../api/reportsApi';
import { useToast } from '../contexts/ToastContext';
import type { Report } from '../types';
import styles from '../styles/MyReports.module.scss';

export default function MyReportsPage() {
  const { showSuccess, showError } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  const [uploadingReportId, setUploadingReportId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadReports = async () => {
    setLoading(true);
    try {
      const response = await reportApi.getMyReports();
      setReports(response.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleUpload = (reportId: number) => {
    setUploadingReportId(reportId);
    fileRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingReportId) return;

    if (!file.name.endsWith('.docx')) {
      showError('Допускаются только файлы .docx');
      return;
    }

    try {
      await reportApi.uploadReport(uploadingReportId, file);
      showSuccess('Отчет загружен');
      loadReports();
    } catch {
      showError('Ошибка загрузки отчета');
    } finally {
      setUploadingReportId(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDownload = async (reportId: number) => {
    try {
      const response = await reportApi.downloadReport(reportId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${reportId}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showError('Ошибка скачивания отчета');
    }
  };

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

  const filteredReports = reports.filter((report) => {
    if (tabValue === 0) return report.status === 'pending' || report.status === 'draft' || report.status === 'rejected';
    if (tabValue === 1) return report.status === 'submitted';
    if (tabValue === 2) return report.status === 'reviewed';
    return true;
  });

  if (loading) {
    return (
      <div className={styles.loader}>
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <input
        type="file"
        ref={fileRef}
        style={{ display: 'none' }}
        accept=".docx"
        onChange={handleFileSelected}
      />

      <div className={styles.header}>
      </div>

      <div className={styles.tabsWrapper}>
        <Tabs 
          className={styles.tabs}
          value={tabValue} 
          onChange={(_, v) => setTabValue(v)}
        >
          <Tab label="Требуют заполнения" />
          <Tab label="На проверке" />
          <Tab label="Проверены" />
        </Tabs>
      </div>

      {filteredReports.length === 0 ? (
        <Alert severity="info">
          Нет отчетов в этом разделе
        </Alert>
      ) : (
        <TableContainer component={Paper} className={styles.tableContainer}>
          <Table className={styles.reportTable}>
            <TableHead>
              <TableRow>
                <TableCell>Отчет</TableCell>
                <TableCell>Период</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Дедлайн</TableCell>
                <TableCell>Файл</TableCell>
                <TableCell>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredReports.map((report) => (
                <TableRow
                  key={report.id}
                  className={
                    report.is_overdue && report.status === 'pending'
                      ? styles.overdueRow
                      : ''
                  }
                >
                  <TableCell>{report.template_title}</TableCell>
                  <TableCell>
                    {report.period_start} — {report.period_end}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusDisplay(report.status)}
                      size="small"
                      color={getStatusColor(report.status)}
                    />
                  </TableCell>
                  <TableCell
                    className={
                      report.is_overdue && report.status === 'pending'
                        ? styles.overdueDate
                        : ''
                    }
                  >
                    {new Date(report.deadline).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {report.has_submitted_file ? (
                      <IconButton
                        size="small"
                        title="Скачать загруженный отчет"
                        onClick={() => handleDownload(report.id)}
                      >
                        <DownloadIcon />
                      </IconButton>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {(report.status === 'pending' ||
                      report.status === 'draft' ||
                      report.status === 'rejected') && (
                      <IconButton
                        size="small"
                        color="primary"
                        title="Загрузить отчет (.docx)"
                        onClick={() => handleUpload(report.id)}
                      >
                        <UploadIcon />
                      </IconButton>
                    )}
                    {report.review_comment && report.status === 'rejected' && (
                      <span
                        style={{
                          fontSize: 12,
                          color: '#f44336',
                          marginLeft: 8,
                        }}
                      >
                        {report.review_comment}
                      </span>
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