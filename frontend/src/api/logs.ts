import {
  api,
  queryString,
  type ApiResult,
  type PaginatedResult,
} from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogTemplate {
  id: string;
  name: string;
  description?: string;
  version: number;
  segment_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LogSegment {
  id: string;
  name: string;
  segment_type: "wysiwyg" | "field_table" | "field_list" | "point_data";
  content_config: Record<string, unknown>;
  is_reusable: boolean;
}

export interface LogInstance {
  id: string;
  template_id: string;
  template_name?: string;
  status: "draft" | "in_progress" | "submitted" | "reviewed";
  team_name?: string;
  created_at: string;
  completed_at?: string;
}

export interface LogEntry {
  id: string;
  instance_id: string;
  segment_id: string;
  content: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface LogAttachment {
  id: string;
  filename: string;
  file_path: string;
  media_type: string;
  created_at: string;
}

export interface LogInstanceDetail extends LogInstance {
  entries: LogEntry[];
  attachments?: LogAttachment[];
}

export interface SearchResult extends LogEntry {
  template_name?: string;
  instance_status?: string;
}

export interface LogSchedule {
  id: string;
  template_id: string;
  template_name?: string;
  recurrence_type: "per_shift" | "time_window" | "per_team";
  interval_hours?: number;
  team_name?: string;
  is_active: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const logsApi = {
  listTemplates: (params?: {
    is_active?: boolean;
  }): Promise<ApiResult<PaginatedResult<LogTemplate>>> =>
    api.get<PaginatedResult<LogTemplate>>(
      `/api/logs/templates${queryString(params)}`,
    ),

  createTemplate: (data: {
    name: string;
    description?: string;
    segment_ids: string[];
    is_active?: boolean;
  }): Promise<ApiResult<LogTemplate>> =>
    api.post<LogTemplate>("/api/logs/templates", data),

  updateTemplate: (
    id: string,
    data: {
      name: string;
      description?: string;
      segment_ids: string[];
      is_active?: boolean;
    },
  ): Promise<ApiResult<LogTemplate>> =>
    api.put<LogTemplate>(`/api/logs/templates/${id}`, data),

  deleteTemplate: (id: string): Promise<ApiResult<void>> =>
    api.delete<void>(`/api/logs/templates/${id}`),

  listSegments: (): Promise<ApiResult<LogSegment[]>> =>
    api.get<LogSegment[]>("/api/logs/segments"),

  createSegment: (data: {
    name: string;
    segment_type: string;
    content_config: Record<string, unknown>;
    is_reusable?: boolean;
  }): Promise<ApiResult<LogSegment>> =>
    api.post<LogSegment>("/api/logs/segments", data),

  createInstance: (data: {
    template_id: string;
    team_name?: string;
  }): Promise<ApiResult<LogInstance>> =>
    api.post<LogInstance>("/api/logs/instances", data),

  listInstances: (params?: {
    status?: string;
    shift_id?: string;
    template_id?: string;
    from?: string;
    to?: string;
  }): Promise<ApiResult<LogInstance[]>> =>
    api.get<LogInstance[]>(`/api/logs/instances${queryString(params)}`),

  getInstance: (id: string): Promise<ApiResult<LogInstanceDetail>> =>
    api.get<LogInstanceDetail>(`/api/logs/instances/${id}`),

  updateInstance: (
    id: string,
    data: {
      status?: string;
      content_updates?: Array<{
        segment_id: string;
        content: Record<string, unknown>;
      }>;
    },
  ): Promise<ApiResult<LogInstanceDetail>> =>
    api.put<LogInstanceDetail>(`/api/logs/instances/${id}`, data),

  submitInstance: (id: string): Promise<ApiResult<LogInstance>> =>
    api.post<LogInstance>(`/api/logs/instances/${id}/submit`, {}),

  // NOTE: template_id filter requires backend support on GET /api/logs/search
  search: (params: {
    q?: string;
    shift_id?: string;
    status?: string;
    from?: string;
    to?: string;
    template_id?: string;
    author?: string;
  }): Promise<ApiResult<SearchResult[]>> =>
    api.get<SearchResult[]>(`/api/logs/search${queryString(params)}`),

  uploadAttachment: (
    instanceId: string,
    file: File,
  ): Promise<
    ApiResult<{
      id: string;
      filename: string;
      file_path: string;
      media_type: string;
    }>
  > => {
    const form = new FormData();
    form.append("file", file);
    return api.postForm(`/api/logs/instances/${instanceId}/attachments`, form);
  },

  listSchedules: (): Promise<ApiResult<LogSchedule[]>> =>
    api.get<LogSchedule[]>("/api/logs/schedules"),

  createSchedule: (data: {
    template_id: string;
    recurrence_type: "per_shift" | "time_window" | "per_team";
    interval_hours?: number;
    team_name?: string;
    is_active?: boolean;
  }): Promise<ApiResult<LogSchedule>> =>
    api.post<LogSchedule>("/api/logs/schedules", data),

  updateSchedule: (
    id: string,
    data: {
      template_id?: string;
      recurrence_type?: "per_shift" | "time_window" | "per_team";
      interval_hours?: number;
      team_name?: string;
      is_active?: boolean;
    },
  ): Promise<ApiResult<LogSchedule>> =>
    api.put<LogSchedule>(`/api/logs/schedules/${id}`, data),

  deleteSchedule: (id: string): Promise<ApiResult<void>> =>
    api.delete<void>(`/api/logs/schedules/${id}`),
};
