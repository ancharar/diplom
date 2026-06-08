import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Warning as WarningIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { reportApi } from '../api/reportsApi';
import { useToast } from '../contexts/ToastContext';
import type { Report, ReportTemplate, ReportSummary } from '../types';
import styles from '../styles/Reports.module.scss';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div role="tabpanel" hidden={value !== index} className={styles.tabPanel} {...other}>
      {value === index && children}
    </div>
  );
}

interface TemplateFormData {
  title: string;
  description: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'manual';
  deadline_days: number;
}

export default function ReportsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [tabValue, setTabValue] = useState(0);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [openTemplateDialog, setOpenTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateFormData>({
    title: '',
    description: '',
    frequency: 'weekly',
    deadline_days: 3,
  });
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const templateFileRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    if (!projectId) return;

    setLoading(true);

    try {
      const [templatesRes, reportsRes, summaryRes] = await Promise.all([
        reportApi.getTemplates(Number(projectId)),
        reportApi.getReports(Number(projectId)),
        reportApi.getSummary(Number(projectId)),
      ]);

      setTemplates(templatesRes.data);
      setReports(reportsRes.data);
      setSummary(summaryRes.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleBackToProject = () => {
    if (!projectId) return;

    navigate(`/projects/${projectId}`);
  };

  const handleGenerateReports = async () => {
    if (!projectId) return;

    try {
      const response = await reportApi.generateReports(Number(projectId));
      showSuccess(response.data.message);
      loadData();
    } catch {
      showError('Ошибка создания отчетов');
    }
  };

  const handleSaveTemplate = async () => {
    if (!projectId) return;

    try {
      const formData = new FormData();

      formData.append('title', templateForm.title);
      formData.append('description', templateForm.description);
      formData.append('frequency', templateForm.frequency);
      formData.append('deadline_days', String(templateForm.deadline_days));

      if (templateFile) {
        formData.append('template_file', templateFile);
      }

      if (editingTemplate) {
        await reportApi.updateTemplate(
          Number(projectId),
          editingTemplate.id,
          formData,
        );

        showSuccess('Шаблон обновлен');
      } else {
        await reportApi.createTemplate(Number(projectId), formData);
        showSuccess('Шаблон создан');
      }

      setOpenTemplateDialog(false);
      setEditingTemplate(null);
      setTemplateFile(null);
      setTemplateForm({
        title: '',
        description: '',
        frequency: 'weekly',
        deadline_days: 3,
      });

      loadData();
    } catch {
      showError('Ошибка сохранения шаблона');
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm('Удалить шаблон? Все связанные отчеты также будут удалены.')) return;
    if (!projectId) return;

    try {
      await reportApi.deleteTemplate(Number(projectId), templateId);
      showSuccess('Шаблон удален');
      loadData();
    } catch {
      showError('Ошибка удаления шаблона');
    }
  };

  const handleDownloadTemplate = async (templateId: number, title: string) => {
    if (!projectId) return;

    try {
      const response = await reportApi.downloadTemplate(
        Number(projectId),
        templateId,
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');

      link.href = url;
      link.setAttribute('download', `${title}.docx`);

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch {
      showError('Ошибка скачивания шаблона');
    }
  };

  const handleDownloadReport = async (reportId: number) => {
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

  const handleReviewReport = async (reportId: number, action: 'reviewed' | 'rejected') => {
    const comment = action === 'rejected'
      ? window.prompt('Укажите причину возврата:') || ''
      : '';

    try {
      await reportApi.reviewReport(reportId, {
        status: action,
        review_comment: comment,
      });

      showSuccess(action === 'reviewed' ? 'Отчет принят' : 'Отчет отправлен на доработку');
      loadData();
    } catch {
      showError('Ошибка проверки отчета');
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

  const getStatusIcon = (status: string, isOverdue: boolean) => {
    if (isOverdue && status === 'pending') {
      return <WarningIcon style={{ color: '#f44336', fontSize: 16 }} />;
    }

    if (status === 'submitted' || status === 'reviewed') {
      return <CheckCircleIcon style={{ color: '#4caf50', fontSize: 16 }} />;
    }

    return <PendingIcon style={{ color: '#ff9800', fontSize: 16 }} />;
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
        <button
          type="button"
          className="btn btn-outline"
          onClick={handleBackToProject}
        >
          ← Назад к проекту
        </button>

        <div className={styles.headerActions}>
          <Button
            className={styles.outlineButton}
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleGenerateReports}
          >
            Создать отчеты
          </Button>

          <Button
            className={styles.primaryButton}
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenTemplateDialog(true)}
          >
            Создать шаблон
          </Button>
        </div>
      </div>

      {summary && (
        <div className={styles.summaryGrid}>
          <Card className={styles.summaryCard}>
            <CardContent>
              <Typography className={styles.summaryValue} variant="h4">
                {summary.total_reports}
              </Typography>
              <Typography className={styles.summaryLabel} variant="body2">
                Всего отчетов
              </Typography>
            </CardContent>
          </Card>

          <Card className={`${styles.summaryCard} ${styles.summarySubmitted}`}>
            <CardContent>
              <Typography className={styles.summaryValue} variant="h4">
                {summary.submitted_reports}
              </Typography>
              <Typography className={styles.summaryLabel} variant="body2">
                Сдано
              </Typography>
            </CardContent>
          </Card>

          <Card className={`${styles.summaryCard} ${styles.summaryPending}`}>
            <CardContent>
              <Typography className={styles.summaryValue} variant="h4">
                {summary.pending_reports}
              </Typography>
              <Typography className={styles.summaryLabel} variant="body2">
                Ожидают
              </Typography>
            </CardContent>
          </Card>

          <Card className={`${styles.summaryCard} ${styles.summaryOverdue}`}>
            <CardContent>
              <Typography className={styles.summaryValue} variant="h4">
                {summary.overdue_reports}
              </Typography>
              <Typography className={styles.summaryLabel} variant="body2">
                Просрочено
              </Typography>
            </CardContent>
          </Card>
        </div>
      )}

      <div className={styles.tabsWrapper}>
        <Tabs className={styles.tabs} value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="Шаблоны отчетов" />
          <Tab label="Отчеты участников" />
          <Tab label="Статистика" />
        </Tabs>
      </div>

      <TabPanel value={tabValue} index={0}>
        <div className={styles.templatesList}>
          {templates.length === 0 ? (
            <Alert severity="info">Нет созданных шаблонов. Создайте первый шаблон отчета.</Alert>
          ) : (
            templates.map((template) => (
              <Paper key={template.id} className={styles.templateCard} elevation={0}>
                <div className={styles.templateHeader}>
                  <div>
                    <Typography className={styles.templateTitle} variant="h6">
                      {template.title}
                    </Typography>
                    <Typography className={styles.templateDescription} variant="body2">
                      {template.description || 'Нет описания'}
                    </Typography>
                  </div>

                  <div className={styles.templateActions}>
                    <Chip
                      label={
                        template.frequency === 'weekly' ? 'Еженедельный'
                        : template.frequency === 'monthly' ? 'Ежемесячный'
                        : 'По требованию'
                      }
                      size="small"
                    />

                    {template.has_template_file && (
                      <IconButton
                        size="small"
                        title="Скачать шаблон .docx"
                        onClick={() => handleDownloadTemplate(template.id, template.title)}
                      >
                        <DownloadIcon />
                      </IconButton>
                    )}

                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditingTemplate(template);
                        setTemplateForm({
                          title: template.title,
                          description: template.description,
                          frequency: template.frequency,
                          deadline_days: template.deadline_days,
                        });
                        setOpenTemplateDialog(true);
                      }}
                    >
                      <EditIcon />
                    </IconButton>

                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteTemplate(template.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </div>
                </div>

                <div className={styles.templateMeta}>
                  <span>Дедлайн: {template.deadline_days} дня на заполнение</span>
                  <span>{template.has_template_file ? '📎 Файл шаблона загружен' : 'Файл шаблона не загружен'}</span>
                </div>
              </Paper>
            ))
          )}
        </div>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <TableContainer className={styles.tableContainer} component={Paper}>
          <Table className={styles.reportTable}>
            <TableHead>
              <TableRow>
                <TableCell>Участник</TableCell>
                <TableCell>Период</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Дедлайн</TableCell>
                <TableCell>Файл</TableCell>
                <TableCell>Действия</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {reports.map((report) => (
                <TableRow
                  key={report.id}
                  className={report.is_overdue ? styles.overdueRow : ''}
                >
                  <TableCell>{report.user.full_name}</TableCell>
                  <TableCell>{report.period_start} — {report.period_end}</TableCell>
                  <TableCell>
                    <div className={styles.statusCell}>
                      {getStatusIcon(report.status, report.is_overdue)}
                      <Chip
                        label={report.status_display}
                        size="small"
                        color={getStatusColor(report.status)}
                      />
                    </div>
                  </TableCell>
                  <TableCell className={report.is_overdue ? styles.overdueDate : ''}>
                    {new Date(report.deadline).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {report.has_submitted_file ? (
                      <IconButton
                        size="small"
                        title="Скачать отчет"
                        onClick={() => handleDownloadReport(report.id)}
                      >
                        <DownloadIcon />
                      </IconButton>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className={styles.tableActions}>
                      {report.status === 'submitted' && (
                        <>
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            onClick={() => handleReviewReport(report.id, 'reviewed')}
                          >
                            Принять
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleReviewReport(report.id, 'rejected')}
                          >
                            Вернуть
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {reports.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    Нет отчетов
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Paper className={styles.statsPaper} elevation={0}>
          <Typography className={styles.statsTitle} variant="h6" gutterBottom>
            Общая статистика
          </Typography>

          <div className={styles.statsProgress}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${summary?.completion_rate || 0}%` }}
              />
            </div>
            <Typography variant="body2">
              Выполнено: {summary?.completion_rate || 0}%
            </Typography>
          </div>

          <Typography variant="h6" className={styles.statsSubtitle} gutterBottom>
            Статистика по участникам
          </Typography>

          <TableContainer>
            <Table className={styles.statsTable} size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Участник</TableCell>
                  <TableCell align="center">Всего</TableCell>
                  <TableCell align="center">Сдано</TableCell>
                  <TableCell align="center">Ожидает</TableCell>
                  <TableCell align="center">Просрочено</TableCell>
                  <TableCell align="center">% выполнения</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {summary?.user_stats.map((stat) => (
                  <TableRow key={stat.user_id}>
                    <TableCell>{stat.full_name}</TableCell>
                    <TableCell align="center">{stat.total}</TableCell>
                    <TableCell align="center">{stat.submitted}</TableCell>
                    <TableCell align="center">{stat.pending}</TableCell>
                    <TableCell align="center">{stat.overdue}</TableCell>
                    <TableCell align="center">{stat.completion_rate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </TabPanel>

      <Dialog
        open={openTemplateDialog}
        onClose={() => setOpenTemplateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingTemplate ? 'Редактировать шаблон' : 'Создать шаблон'}
        </DialogTitle>

        <DialogContent>
          <TextField
            label="Название шаблона"
            fullWidth
            margin="normal"
            value={templateForm.title}
            onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
            required
          />

          <TextField
            label="Описание"
            fullWidth
            margin="normal"
            multiline
            rows={2}
            value={templateForm.description}
            onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>Периодичность</InputLabel>
            <Select
              value={templateForm.frequency}
              onChange={(e) => setTemplateForm({
                ...templateForm,
                frequency: e.target.value as TemplateFormData['frequency'],
              })}
            >
              <MenuItem value="weekly">Еженедельно</MenuItem>
              <MenuItem value="monthly">Ежемесячно</MenuItem>
              <MenuItem value="quarterly">Ежеквартально</MenuItem>
              <MenuItem value="manual">По требованию</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Дней на заполнение"
            type="number"
            fullWidth
            margin="normal"
            value={templateForm.deadline_days}
            onChange={(e) => setTemplateForm({
              ...templateForm,
              deadline_days: Number(e.target.value),
            })}
          />

          <div className={styles.fileUploadBlock}>
            <Typography className={styles.fileUploadLabel} variant="body2">
              Файл шаблона (.docx)
            </Typography>
            <input
              type="file"
              accept=".docx"
              ref={templateFileRef}
              onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
            />
            {editingTemplate?.has_template_file && !templateFile && (
              <Typography variant="body2" className={styles.fileUploadHint}>
                Файл шаблона уже загружен
              </Typography>
            )}
          </div>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => {
            setOpenTemplateDialog(false);
            setEditingTemplate(null);
            setTemplateFile(null);
          }}>
            Отмена
          </Button>
          <Button onClick={handleSaveTemplate} variant="contained">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}