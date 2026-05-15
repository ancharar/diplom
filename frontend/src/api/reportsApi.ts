import client from './client';
import type { Report, ReportTemplate, ReportSummary } from '../types';

interface ReportReviewData {
  status: 'reviewed' | 'rejected';
  review_comment?: string;
}

export const reportApi = {
  // Шаблоны отчетов
  getTemplates: (projectId: number) =>
    client.get<ReportTemplate[]>(
      `/reports/projects/${projectId}/report-templates/`,
    ),

  createTemplate: (projectId: number, data: FormData | Partial<ReportTemplate>) =>
    client.post<ReportTemplate>(
      `/reports/projects/${projectId}/report-templates/`,
      data,
      data instanceof FormData
        ? { headers: { 'Content-Type': 'multipart/form-data' } }
        : undefined,
    ),

  updateTemplate: (
    projectId: number,
    templateId: number,
    data: FormData | Partial<ReportTemplate>,
  ) =>
    client.patch<ReportTemplate>(
      `/reports/projects/${projectId}/report-templates/${templateId}/`,
      data,
      data instanceof FormData
        ? { headers: { 'Content-Type': 'multipart/form-data' } }
        : undefined,
    ),

  deleteTemplate: (projectId: number, templateId: number) =>
    client.delete(
      `/reports/projects/${projectId}/report-templates/${templateId}/`,
    ),

  downloadTemplate: (projectId: number, templateId: number) =>
    client.get(
      `/reports/projects/${projectId}/report-templates/${templateId}/download/`,
      { responseType: 'blob' },
    ),

  // Отчеты
  getReports: (
    projectId: number,
    params?: { user_id?: number; status?: string },
  ) =>
    client.get<Report[]>(
      `/reports/projects/${projectId}/reports/`,
      { params },
    ),

  getMyReports: (projectId?: number) =>
    client.get<Report[]>(
      '/reports/reports/my/',
      { params: { project_id: projectId } },
    ),

  getReport: (reportId: number) =>
    client.get<Report>(`/reports/reports/${reportId}/`),

  uploadReport: (reportId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return client.post<Report>(
      `/reports/reports/${reportId}/upload/`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },

  downloadReport: (reportId: number) =>
    client.get(
      `/reports/reports/${reportId}/download/`,
      { responseType: 'blob' },
    ),

  reviewReport: (reportId: number, data: ReportReviewData) =>
    client.post<Report>(
      `/reports/reports/${reportId}/review/`,
      data,
    ),

  generateReports: (
    projectId: number,
    templateId?: number,
  ) =>
    client.post<{ message: string; created_count: number }>(
      `/reports/projects/${projectId}/reports/generate/`,
      { template_id: templateId },
    ),

  getSummary: (projectId: number) =>
    client.get<ReportSummary>(
      `/reports/projects/${projectId}/reports/summary/`,
    ),

  collectTasks: (reportId: number) =>
    client.get<{
      completed: unknown[];
      in_progress: unknown[];
      overdue: unknown[];
      total_count: number;
      completed_count: number;
      in_progress_count: number;
      overdue_count: number;
    }>(`/reports/reports/${reportId}/collect-tasks/`),
};

export default reportApi;
