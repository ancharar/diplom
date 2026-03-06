export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'member';
  is_active: boolean;
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

export interface VKPublication {
  id: number;
  project: number;
  author: User;
  title: string;
  content: string;
  vk_post_id: number | null;
  owner_id: number;
  status: 'draft' | 'published' | 'failed';
  published_at: string | null;
  error_message: string;
  created_at: string;
}
