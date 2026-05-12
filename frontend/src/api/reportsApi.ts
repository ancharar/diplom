import client from './client';
import type { Report, ReportTemplate, ReportSummary } from '../types';

// Тип для данных при сдаче отчета
interface ReportSubmitData {
  answers: Record<string, string>;
  tasks_data?: Record<string, unknown>;
  report_tasks?: Array<{
    task_id: number;
    status_after?: string;
    time_spent?: number;
    comment?: string;
  }>;
}

// Тип для данных при проверке отчета
interface ReportReviewData {
  status: 'reviewed' | 'rejected';
  review_comment?: string;
}

export const reportApi = {
  // Шаблоны отчетов
  getTemplates: (projectId: number) =>
    client.get<ReportTemplate[]>(`/reports/projects/${projectId}/report-templates/`),
  
  createTemplate: (projectId: number, data: Partial<ReportTemplate>) =>
    client.post<ReportTemplate>(`/reports/projects/${projectId}/report-templates/`, data),
  
  updateTemplate: (projectId: number, templateId: number, data: Partial<ReportTemplate>) =>
    client.patch<ReportTemplate>(`/reports/projects/${projectId}/report-templates/${templateId}/`, data),
  
  deleteTemplate: (projectId: number, templateId: number) =>
    client.delete(`/reports/projects/${projectId}/report-templates/${templateId}/`),
  
  // Отчеты
  getReports: (projectId: number, params?: { user_id?: number; status?: string }) =>
    client.get<Report[]>(`/reports/projects/${projectId}/reports/`, { params }),
  
  getMyReports: (projectId?: number) =>
    client.get<Report[]>('/reports/my/', { params: { project_id: projectId } }),
  
  getReport: (reportId: number) =>
    client.get<Report>(`/reports/${reportId}/`),
  
  submitReport: (reportId: number, data: ReportSubmitData) =>
    client.post<Report>(`/reports/${reportId}/submit/`, data),
  
  reviewReport: (reportId: number, data: ReportReviewData) =>
    client.post<Report>(`/reports/${reportId}/review/`, data),
  
  generateReports: (projectId: number, templateId?: number) =>
    client.post<{ message: string; created_count: number }>(
      `/reports/projects/${projectId}/reports/generate/`, 
      { template_id: templateId }
    ),
  
  getSummary: (projectId: number) =>
    client.get<ReportSummary>(`/reports/projects/${projectId}/reports/summary/`),
  
  collectTasks: (reportId: number) =>
    client.get<{
      completed: unknown[];
      in_progress: unknown[];
      overdue: unknown[];
      total_count: number;
      completed_count: number;
      in_progress_count: number;
      overdue_count: number;
    }>(`/reports/${reportId}/collect-tasks/`),
};

export default reportApi;