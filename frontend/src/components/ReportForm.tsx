import { useState } from 'react';
import {
  Paper,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import type { Report, ReportQuestion } from '../types';

interface ReportFormProps {
  report: Report;
  onSubmit: (answers: Record<string, string>) => Promise<void>;
  isSubmitting?: boolean;
  readOnly?: boolean;
}

// Расширенный тип для отчета с данными шаблона
interface ReportWithTemplate extends Omit<Report, 'template'> {
  template: {
    id: number;
    title: string;
    questions: ReportQuestion[];
  };
}

export default function ReportForm({ report, onSubmit, isSubmitting = false, readOnly = false }: ReportFormProps) {
  // Приводим тип, так как реальные данные приходят с шаблоном
  const extendedReport = report as unknown as ReportWithTemplate;
  
  const [answers, setAnswers] = useState<Record<string, string>>(report.answers || {});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const questions = extendedReport.template?.questions || [];

    questions.forEach((question: ReportQuestion) => {
      if (question.required && !answers[question.id]?.trim()) {
        newErrors[question.id] = 'Это поле обязательно для заполнения';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      const newErrors = { ...errors };
      delete newErrors[questionId];
      setErrors(newErrors);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit(answers);
  };

  const renderField = (question: ReportQuestion) => {
    const value = answers[question.id] || '';
    const error = errors[question.id];

    switch (question.type) {
      case 'textarea':
        return (
          <TextField
            fullWidth
            multiline
            rows={3}
            label={question.label}
            value={value}
            onChange={(e) => handleChange(question.id, e.target.value)}
            error={!!error}
            helperText={error}
            disabled={readOnly}
            required={question.required}
            placeholder="Введите ответ..."
            variant="outlined"
            margin="normal"
          />
        );
      case 'select':
        return (
          <FormControl fullWidth error={!!error} margin="normal">
            <InputLabel>{question.label}</InputLabel>
            <Select
              value={value}
              onChange={(e) => handleChange(question.id, e.target.value as string)}
              label={question.label}
              disabled={readOnly}
            >
              {(question.options || []).map((option: string) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </Select>
            {error && <Typography variant="caption" color="error">{error}</Typography>}
          </FormControl>
        );
      case 'number':
        return (
          <TextField
            fullWidth
            type="number"
            label={question.label}
            value={value}
            onChange={(e) => handleChange(question.id, e.target.value)}
            error={!!error}
            helperText={error}
            disabled={readOnly}
            required={question.required}
            variant="outlined"
            margin="normal"
          />
        );
      case 'date':
        return (
          <TextField
            fullWidth
            type="date"
            label={question.label}
            value={value}
            onChange={(e) => handleChange(question.id, e.target.value)}
            error={!!error}
            helperText={error}
            disabled={readOnly}
            required={question.required}
            variant="outlined"
            margin="normal"
          />
        );
      default:
        return (
          <TextField
            fullWidth
            label={question.label}
            value={value}
            onChange={(e) => handleChange(question.id, e.target.value)}
            error={!!error}
            helperText={error}
            disabled={readOnly}
            required={question.required}
            placeholder="Введите ответ..."
            variant="outlined"
            margin="normal"
          />
        );
    }
  };

  const questions = extendedReport.template?.questions || [];

  return (
    <Paper style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Typography variant="h6" gutterBottom>
          {report.template_title}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Период: {report.period_start} — {report.period_end}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Дедлайн: {new Date(report.deadline).toLocaleString()}
        </Typography>
        <Divider style={{ marginTop: 16 }} />
      </div>

      {report.status === 'rejected' && report.review_comment && (
        <Alert severity="error" style={{ marginBottom: 24 }}>
          <strong>Отчет отправлен на доработку:</strong> {report.review_comment}
        </Alert>
      )}

      <div>
        {questions.map((question: ReportQuestion, index: number) => (
          <div key={question.id} style={{ marginBottom: 16 }}>
            <Typography variant="subtitle2" gutterBottom>
              {index + 1}. {question.label}
              {question.required && <span style={{ color: '#f44336', marginLeft: 4 }}>*</span>}
            </Typography>
            {renderField(question)}
          </div>
        ))}
      </div>

      {!readOnly && report.status !== 'submitted' && report.status !== 'reviewed' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : <SendIcon />}
          >
            {isSubmitting ? 'Отправка...' : 'Сдать отчет на проверку'}
          </Button>
        </div>
      )}

      {readOnly && report.status === 'reviewed' && (
        <Alert severity="success" style={{ marginTop: 24 }}>
          <strong>Отчет проверен и одобрен!</strong>
          {report.review_comment && <div style={{ marginTop: 8 }}>Комментарий: {report.review_comment}</div>}
        </Alert>
      )}
    </Paper>
  );
}