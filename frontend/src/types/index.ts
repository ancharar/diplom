// frontend/src/types/index.ts

export interface User {
  id: number;
  email: string;
  full_name: string;

  // анкета
  university?: string;
  position?: string;
  bio?: string;
  interests?: string[];
  avatar_url?: string;

  is_active: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_blocked?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  is_blocked: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: User;
  tokens: {
    access: string;
    refresh: string;
  };
}

export interface ProjectMembership {
  id: number;
  user: User;
  project_role: string;
  joined_at: string;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  area: string;
  status: 'in_progress' | 'completed';
  goal: string;
  owner: User;
  memberships: ProjectMembership[];
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  project: number;
  assignee: User | null;
  created_by: User;
  status: string;
  priority: 'low' | 'medium' | 'high';
  deadline: string | null;
  allowed_transitions: string[];
  created_at: string;
  updated_at: string;
}

export interface HistoryEntry {
  id: number;
  field_name: string;
  old_value: string;
  new_value: string;
  changed_by: User;
  changed_at: string;
}

export interface LiteratureSource {
  id: string;
  project_id: number;

  title: string;
  authors: string;
  year: number | null;

  url: string;
  description: string;
  tags: string[];

  type?: 'manual' | 'publication';
  source_type?: string;
  doi?: string;
  source?: string;
  gost_string?: string;

  added_by: number;
  created_at: string;
  updated_at: string;
}

export interface ArxivResult {
  arxiv_id: string;
  title: string;
  authors: string;
  year: number | null;
  summary: string;
  url: string;
  pdf_url: string;
  categories: string[];
}

export interface ProjectFile {
  id: string;
  project_id: number;
  filename: string;
  content_type: string;
  size: number;
  description: string;
  uploaded_by: number;
  uploaded_at: string;
}

export interface ProjectCatalog {
  id: number;
  title: string;
  description: string;
  goal: string;
  area: string;
  status: string;
  start_date: string;
  end_date: string;
  members_count: number;
  is_member: boolean;
  has_pending_request: boolean;
}

export interface JoinRequest {
  id: number;
  user: User;
  project: number;
  desired_role: string;
  assigned_role: string | null;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: User | null;
  reviewed_at: string | null;
  created_at: string;
}

// ============================================
// ТИПЫ ДЛЯ ОТЧЕТОВ
// ============================================

export interface ReportQuestion {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'number';
  options?: string[];
  required?: boolean;
}

export interface ReportTemplate {
  id: number;
  project: number;
  title: string;
  description: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'manual';
  deadline_days: number;
  questions: ReportQuestion[];
  template_file: string | null;
  has_template_file: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReportTask {
  id: number;
  task: Task;
  status_before: string;
  status_after: string;
  time_spent: number | null;
  comment: string;
}

export interface ReportTasksData {
  completed: Task[];
  in_progress: Task[];
  overdue: Task[];
  total_count: number;
  completed_count: number;
  in_progress_count: number;
  overdue_count: number;
}

export interface Report {
  id: number;
  template: number;
  template_title: string;
  template_frequency: string;
  user: User;
  period_start: string;
  period_end: string;
  deadline: string;
  answers: Record<string, string>;
  submitted_file: string | null;
  has_submitted_file: boolean;
  status: 'pending' | 'draft' | 'submitted' | 'reviewed' | 'rejected';
  status_display: string;
  is_overdue: boolean;
  submitted_at: string | null;
  reviewed_by: User | null;
  reviewed_at: string | null;
  review_comment: string;
  tasks_data: ReportTasksData;
  report_tasks: ReportTask[];
  created_at: string;
  updated_at: string;
}

export interface ReportUserStats {
  user_id: number;
  full_name: string;
  total: number;
  submitted: number;
  pending: number;
  overdue: number;
  completion_rate: number;
}

export interface ReportSummary {
  total_reports: number;
  submitted_reports: number;
  pending_reports: number;
  overdue_reports: number;
  completion_rate: number;
  user_stats: ReportUserStats[];
}

export interface Notification {
  id: number;
  notification_type: 'project_invitation' | 'task_assigned' | 'report_required' | 'report_reminder';
  title: string;
  message: string;
  is_read: boolean;
  project?: { id: number; title: string } | null;
  task?: { id: number; title: string } | null;
  invitation?: { id: number; status: string } | null;
  created_at: string;
}

// ============================================
// ТИПЫ ДЛЯ ПУБЛИКАЦИЙ
// ============================================

export interface Publication {
  id: number;
  title: string;
  authors: string[];
  year: number | null;
  journal: string;
  volume: string;
  issue: string;
  pages: string;
  url: string;
  doi: string;
  raw_url: string;
  gost_string: string;
  extraction_confidence: 'high' | 'medium' | 'low';
  created_at: string;
  updated_at: string;
}

export interface ExtractedMetadata {
  title: string;
  authors: string[];
  year: number | null;
  journal: string;
  volume: string;
  issue: string;
  pages: string;
  url: string;
  doi: string;
  raw_url: string;
  extraction_confidence: 'high' | 'medium' | 'low';
}

// ============================================
// ТИПЫ ДЛЯ ГОСТ-ШАБЛОНОВ
// ============================================

export interface GostBlock {
  type: 'field' | 'separator';
  key: string;
}

export interface GostTemplate {
  id: string;
  project_id: number;
  source_type: string;
  blocks: GostBlock[];
  created_by: number;
  created_at: string;
  updated_at: string;
}