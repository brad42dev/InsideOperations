import { api, queryString, type ApiResult } from './client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckpointValidation {
  mode: 'limit' | 'alarm'
  min?: number
  max?: number
  hh?: number
  h?: number
  l?: number
  ll?: number
}

export interface CheckpointMediaRequirements {
  photo?: 'optional' | 'required' | 'required_on_alarm'
  comments?: 'optional' | 'required' | 'required_on_alarm'
}

export interface CheckpointBarcodeGate {
  /** Expected barcode value (exact match). If omitted, any scan unlocks. */
  expected_value?: string
}

export interface CheckpointGpsGate {
  lat: number
  lng: number
  /** Required proximity in metres before data entry is enabled (default 50) */
  radius_metres: number
}

export interface Checkpoint {
  index: number
  title: string
  description?: string
  data_type: 'text' | 'numeric' | 'boolean' | 'dropdown' | 'multi_field'
  required: boolean
  unit?: string
  /** OPC UA point ID for automatic value capture during round execution */
  opc_point_id?: string
  validation?: CheckpointValidation
  options?: string[]
  fields?: Array<{ name: string; type: string }>
  media_requirements?: CheckpointMediaRequirements
  /** Barcode entry gate — must scan barcode before data entry is enabled */
  barcode_gate?: CheckpointBarcodeGate
  /** GPS entry gate — must be within radius of configured location */
  gps_gate?: CheckpointGpsGate
}

export interface RoundTemplate {
  id: string
  name: string
  description?: string
  version: number
  checkpoints: Checkpoint[]
  is_active: boolean
  created_by: string
  created_at: string
}

export interface RoundSchedule {
  id: string
  template_id: string
  template_name?: string
  recurrence_type: 'per_shift' | 'daily' | 'interval' | 'weekly' | 'custom'
  recurrence_config: Record<string, unknown>
  is_active: boolean
}

export interface RoundInstance {
  id: string
  template_id: string
  template_name?: string
  status: 'pending' | 'in_progress' | 'completed' | 'missed' | 'transferred'
  locked_to_user?: string
  started_at?: string
  completed_at?: string
  due_by?: string
  created_at: string
}

export interface RoundResponse {
  id: string
  instance_id: string
  checkpoint_index: number
  response_type: string
  response_value: unknown
  calculated_value?: number
  is_out_of_range: boolean
  alarm_triggered: boolean
  created_by: string
  created_at: string
}

export interface RoundInstanceDetail extends RoundInstance {
  template?: RoundTemplate
  responses: RoundResponse[]
}

export interface RoundHistoryEntry {
  id: string
  template_id: string
  template_name: string
  status: string
  started_at?: string
  completed_at?: string
  due_by?: string
  created_at: string
  response_count: number
  out_of_range_count: number
}

export interface ResponseItem {
  checkpoint_index: number
  response_type: string
  response_value: unknown
  gps_latitude?: number
  gps_longitude?: number
  barcode_scanned?: string
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const roundsApi = {
  // Templates
  listTemplates: (params?: { is_active?: boolean }): Promise<ApiResult<RoundTemplate[]>> =>
    api.get<RoundTemplate[]>(`/api/rounds/templates${queryString(params)}`),

  getTemplate: (id: string): Promise<ApiResult<RoundTemplate>> =>
    api.get<RoundTemplate>(`/api/rounds/templates/${id}`),

  createTemplate: (data: {
    name: string
    description?: string
    checkpoints: Checkpoint[]
  }): Promise<ApiResult<RoundTemplate>> =>
    api.post<RoundTemplate>('/api/rounds/templates', data),

  updateTemplate: (
    id: string,
    data: { name: string; description?: string; checkpoints: Checkpoint[] },
  ): Promise<ApiResult<RoundTemplate>> =>
    api.put<RoundTemplate>(`/api/rounds/templates/${id}`, data),

  // Schedules
  listSchedules: (): Promise<ApiResult<RoundSchedule[]>> =>
    api.get<RoundSchedule[]>('/api/rounds/schedules'),

  createSchedule: (data: {
    template_id: string
    recurrence_type: string
    recurrence_config: Record<string, unknown>
  }): Promise<ApiResult<RoundSchedule>> =>
    api.post<RoundSchedule>('/api/rounds/schedules', data),

  updateSchedule: (
    id: string,
    data: {
      recurrence_type?: string
      recurrence_config?: Record<string, unknown>
      is_active?: boolean
    },
  ): Promise<ApiResult<RoundSchedule>> =>
    api.put<RoundSchedule>(`/api/rounds/schedules/${id}`, data),

  // Instances
  listInstances: (params?: {
    status?: string
    from?: string
    to?: string
  }): Promise<ApiResult<RoundInstance[]>> =>
    api.get<RoundInstance[]>(`/api/rounds/instances${queryString(params)}`),

  getInstance: (id: string): Promise<ApiResult<RoundInstanceDetail>> =>
    api.get<RoundInstanceDetail>(`/api/rounds/instances/${id}`),

  startInstance: (id: string): Promise<ApiResult<RoundInstance>> =>
    api.post<RoundInstance>(`/api/rounds/instances/${id}/start`, {}),

  saveResponses: (id: string, responses: ResponseItem[]): Promise<ApiResult<{ saved: number }>> =>
    api.post<{ saved: number }>(`/api/rounds/instances/${id}/responses`, { responses }),

  completeInstance: (id: string): Promise<ApiResult<RoundInstance>> =>
    api.post<RoundInstance>(`/api/rounds/instances/${id}/complete`, {}),

  // History
  getHistory: (params?: {
    template_id?: string
    from?: string
    to?: string
  }): Promise<ApiResult<RoundHistoryEntry[]>> =>
    api.get<RoundHistoryEntry[]>(`/api/rounds/history${queryString(params)}`),
}
