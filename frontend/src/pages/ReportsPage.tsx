import { useEffect, useState } from 'react';
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
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { reportApi } from '../api/reportsApi';
import { useToast } from '../contexts/ToastContext';
import type { Report, ReportTemplate, ReportSummary, ReportQuestion } from '../types';
import styles from '../styles/Reports.module.scss';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} style={{ padding: 24 }} {...other}>
      {value === index && children}
    </div>
  );
}

// Тип для формы шаблона
interface TemplateFormData {
  title: string;
  description: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'manual';
  deadline_days: number;
  questions: ReportQuestion[];
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
    questions: [{ id: 'q1', label: '', type: 'textarea', required: true }],
  });

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
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleGenerateReports = async () => {
    if (!projectId) return;
    try {
      const response = await reportApi.generateReports(Number(projectId));
      showSuccess(response.data.message);
      loadData();
    } catch (err) {
      console.error('Ошибка создания отчетов:', err);
      showError('Ошибка создания отчетов');
    }
  };

  const handleSaveTemplate = async () => {
    if (!projectId) return;
    try {
      // Преобразуем данные для отправки на сервер
      const templateData: Partial<ReportTemplate> = {
        title: templateForm.title,
        description: templateForm.description,
        frequency: templateForm.frequency,
        deadline_days: templateForm.deadline_days,
        questions: templateForm.questions.map(q => ({
          id: q.id,
          label: q.label,
          type: q.type,
          required: q.required || false,
          options: q.options,
        })),
      };

      if (editingTemplate) {
        await reportApi.updateTemplate(Number(projectId), editingTemplate.id, templateData);
        showSuccess('Шаблон обновлен');
      } else {
        await reportApi.createTemplate(Number(projectId), templateData);
        showSuccess('Шаблон создан');
      }
      setOpenTemplateDialog(false);
      setEditingTemplate(null);
      setTemplateForm({
        title: '',
        description: '',
        frequency: 'weekly',
        deadline_days: 3,
        questions: [{ id: 'q1', label: '', type: 'textarea', required: true }],
      });
      loadData();
    } catch (err) {
      console.error('Ошибка сохранения шаблона:', err);
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
    } catch (err) {
      console.error('Ошибка удаления шаблона:', err);
      showError('Ошибка удаления шаблона');
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Отчеты</h1>
          <p className={styles.subtitle}>Управление отчетностью по проекту</p>
        </div>
        <div className={styles.headerActions}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleGenerateReports}
          >
            Создать отчеты
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenTemplateDialog(true)}
          >
            Создать шаблон
          </Button>
        </div>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <Card>
            <CardContent>
              <Typography variant="h4">{summary.total_reports}</Typography>
              <Typography variant="body2" color="textSecondary">Всего отчетов</Typography>
            </CardContent>
          </Card>
          <Card style={{ backgroundColor: '#e8f5e9' }}>
            <CardContent>
              <Typography variant="h4">{summary.submitted_reports}</Typography>
              <Typography variant="body2" color="textSecondary">Сдано</Typography>
            </CardContent>
          </Card>
          <Card style={{ backgroundColor: '#fff3e0' }}>
            <CardContent>
              <Typography variant="h4">{summary.pending_reports}</Typography>
              <Typography variant="body2" color="textSecondary">Ожидают</Typography>
            </CardContent>
          </Card>
          <Card style={{ backgroundColor: '#ffebee' }}>
            <CardContent>
              <Typography variant="h4">{summary.overdue_reports}</Typography>
              <Typography variant="body2" color="textSecondary">Просрочено</Typography>
            </CardContent>
          </Card>
        </div>
      )}

      <div style={{ borderBottom: '1px solid #e0e0e0', marginTop: 24 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
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
              <Paper key={template.id} className={styles.templateCard}>
                <div className={styles.templateHeader}>
                  <div>
                    <Typography variant="h6">{template.title}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {template.description || 'Нет описания'}
                    </Typography>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Chip 
                      label={template.frequency === 'weekly' ? 'Еженедельный' : template.frequency === 'monthly' ? 'Ежемесячный' : 'По требованию'} 
                      size="small" 
                    />
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        setEditingTemplate(template);
                        setTemplateForm({
                          title: template.title,
                          description: template.description,
                          frequency: template.frequency,
                          deadline_days: template.deadline_days,
                          questions: template.questions,
                        });
                        setOpenTemplateDialog(true);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDeleteTemplate(template.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </div>
                </div>
                <div className={styles.templateMeta}>
                  <span>📅 Дедлайн: {template.deadline_days} дня на заполнение</span>
                  <span>📋 Вопросов: {template.questions.length}</span>
                </div>
              </Paper>
            ))
          )}
        </div>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Участник</TableCell>
                <TableCell>Период</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Дедлайн</TableCell>
                <TableCell>Дата сдачи</TableCell>
                <TableCell>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id} className={report.is_overdue ? styles.overdueRow : ''}>
                  <TableCell>{report.user.full_name}</TableCell>
                  <TableCell>{report.period_start} — {report.period_end}</TableCell>
                  <TableCell>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                  <TableCell>{report.submitted_at ? new Date(report.submitted_at).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => navigate(`/reports/${report.id}`)}>
                      <ViewIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {reports.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">Нет отчетов</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Paper className={styles.statsPaper}>
          <Typography variant="h6" gutterBottom>Общая статистика</Typography>
          <div className={styles.statsProgress}>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${summary?.completion_rate || 0}%` }}
              />
            </div>
            <Typography variant="body2">Выполнено: {summary?.completion_rate || 0}%</Typography>
          </div>

          <Typography variant="h6" gutterBottom style={{ marginTop: 24 }}>Статистика по участникам</Typography>
          <TableContainer>
            <Table size="small">
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

      {/* Диалог создания/редактирования шаблона */}
      <Dialog open={openTemplateDialog} onClose={() => setOpenTemplateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingTemplate ? 'Редактировать шаблон' : 'Создать шаблон'}</DialogTitle>
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
              onChange={(e) => setTemplateForm({ ...templateForm, frequency: e.target.value as 'weekly' | 'monthly' | 'quarterly' | 'manual' })}
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
            onChange={(e) => setTemplateForm({ ...templateForm, deadline_days: Number(e.target.value) })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTemplateDialog(false)}>Отмена</Button>
          <Button onClick={handleSaveTemplate} variant="contained">Сохранить</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}