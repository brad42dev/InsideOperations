import { api, queryString, type ApiResult } from './client'
import type { PaginatedResult } from './client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportTemplate {
  id: string
  name: string
  description: string | null
  category: string | null
  is_system_template: boolean
  template_config: Record<string, unknown>
  default_params: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ReportJob {
  id: string
  template_id: string | null
  template_name?: string
  requested_by: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  format: string
  params: Record<string, unknown>
  file_size_bytes: number | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  expires_at: string | null
  created_at: string
}

export interface ReportSchedule {
  id: string
  template_id: string
  template_name?: string
  name: string
  cron_expression: string
  format: string
  params: Record<string, unknown>
  recipient_user_ids: string[]
  recipient_emails: string[]
  enabled: boolean
  last_run_at: string | null
  next_run_at: string | null
  created_at: string
}

export interface ExportPreset {
  id: string
  template_id: string
  template_name?: string
  name: string
  params: Record<string, unknown>
  created_at: string
}

export interface CreateTemplateBody {
  name: string
  description?: string
  category?: string
  template_config: Record<string, unknown>
  default_params?: Record<string, unknown>
}

export interface UpdateTemplateBody {
  name?: string
  description?: string
  category?: string
  template_config?: Record<string, unknown>
  default_params?: Record<string, unknown>
}

export interface GenerateReportBody {
  template_id: string
  format: string
  params: Record<string, unknown>
  notify_email?: boolean
}

export interface GenerateReportResponse {
  job_id: string
}

export interface CreateScheduleBody {
  template_id: string
  name: string
  cron_expression: string
  format: string
  params?: Record<string, unknown>
  recipient_user_ids?: string[]
  recipient_emails?: string[]
  enabled?: boolean
}

export interface UpdateScheduleBody {
  name?: string
  cron_expression?: string
  format?: string
  params?: Record<string, unknown>
  recipient_user_ids?: string[]
  recipient_emails?: string[]
  enabled?: boolean
}

export interface CreatePresetBody {
  template_id: string
  name: string
  params: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export const reportsApi = {
  // ---- Templates -----------------------------------------------------------

  listTemplates: (params?: {
    q?: string
    category?: string
    is_system?: boolean
    page?: number
    limit?: number
  }): Promise<ApiResult<PaginatedResult<ReportTemplate>>> =>
    api.get<PaginatedResult<ReportTemplate>>(`/api/reports/templates${queryString(params)}`),

  getTemplate: (id: string): Promise<ApiResult<ReportTemplate>> =>
    api.get<ReportTemplate>(`/api/reports/templates/${id}`),

  createTemplate: (body: CreateTemplateBody): Promise<ApiResult<ReportTemplate>> =>
    api.post<ReportTemplate>('/api/reports/templates', body),

  updateTemplate: (id: string, body: UpdateTemplateBody): Promise<ApiResult<ReportTemplate>> =>
    api.put<ReportTemplate>(`/api/reports/templates/${id}`, body),

  deleteTemplate: (id: string): Promise<ApiResult<void>> =>
    api.delete<void>(`/api/reports/templates/${id}`),

  // ---- Generation ----------------------------------------------------------

  generate: (body: GenerateReportBody): Promise<ApiResult<GenerateReportResponse>> =>
    api.post<GenerateReportResponse>('/api/reports/generate', body),

  getJobStatus: (id: string): Promise<ApiResult<ReportJob>> =>
    api.get<ReportJob>(`/api/reports/${id}/status`),

  getDownloadUrl: (id: string): string =>
    `${API_BASE}/api/reports/${id}/download`,

  // ---- History / Exports ---------------------------------------------------

  listHistory: (params?: {
    page?: number
    limit?: number
  }): Promise<ApiResult<PaginatedResult<ReportJob>>> =>
    api.get<PaginatedResult<ReportJob>>(`/api/reports/history${queryString(params)}`),

  listMyExports: (params?: {
    page?: number
    limit?: number
  }): Promise<ApiResult<PaginatedResult<ReportJob>>> =>
    api.get<PaginatedResult<ReportJob>>(`/api/reports/exports${queryString(params)}`),

  // ---- Schedules -----------------------------------------------------------

  listSchedules: (params?: {
    page?: number
    limit?: number
  }): Promise<ApiResult<PaginatedResult<ReportSchedule>>> =>
    api.get<PaginatedResult<ReportSchedule>>(`/api/reports/schedules${queryString(params)}`),

  createSchedule: (body: CreateScheduleBody): Promise<ApiResult<ReportSchedule>> =>
    api.post<ReportSchedule>('/api/reports/schedules', body),

  updateSchedule: (id: string, body: UpdateScheduleBody): Promise<ApiResult<ReportSchedule>> =>
    api.put<ReportSchedule>(`/api/reports/schedules/${id}`, body),

  deleteSchedule: (id: string): Promise<ApiResult<void>> =>
    api.delete<void>(`/api/reports/schedules/${id}`),

  // ---- Presets -------------------------------------------------------------

  listPresets: (templateId: string): Promise<ApiResult<ExportPreset[]>> =>
    api.get<ExportPreset[]>(`/api/reports/templates/${templateId}/presets`),

  createPreset: (body: CreatePresetBody): Promise<ApiResult<ExportPreset>> =>
    api.post<ExportPreset>('/api/reports/presets', body),

  deletePreset: (id: string): Promise<ApiResult<void>> =>
    api.delete<void>(`/api/reports/presets/${id}`),
}
