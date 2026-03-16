import { api, queryString, type ApiResult } from './client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Investigation {
  id: string
  name: string
  status: 'active' | 'closed' | 'cancelled'
  anchor_point_id?: string
  anchor_alarm_id?: string
  created_by: string
  created_at: string
  updated_at: string
  closed_at?: string
  stages?: InvestigationStage[]
}

export interface InvestigationStage {
  id: string
  investigation_id: string
  name: string
  sort_order: number
  time_range_start: string
  time_range_end: string
  evidence?: EvidenceItem[]
}

export type EvidenceType =
  | 'trend'
  | 'point_detail'
  | 'alarm_list'
  | 'value_table'
  | 'graphic_snapshot'
  | 'correlation'
  | 'log_entries'
  | 'round_entries'
  | 'calculated_series'
  | 'annotation'

export interface EvidenceItem {
  id: string
  stage_id: string
  evidence_type: EvidenceType
  config: Record<string, unknown>
  sort_order: number
}

export interface CorrelationResult {
  point_id_a: string
  point_id_b: string
  pearson: number
  spearman: number
  max_cross_corr: number
  lag_ms: number
}

export interface ThresholdExceedance {
  start: string
  end: string
  peak_value: number
  duration_seconds: number
}

export interface InvestigationPoint {
  point_id: string
  status: 'included' | 'suggested' | 'removed'
  removal_reason?: string
  point_name?: string
  point_tag?: string
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const forensicsApi = {
  listInvestigations: (params?: {
    status?: string
  }): Promise<ApiResult<Investigation[]>> =>
    api.get<Investigation[]>(`/api/forensics/investigations${queryString(params)}`),

  getInvestigation: (id: string): Promise<ApiResult<Investigation>> =>
    api.get<Investigation>(`/api/forensics/investigations/${id}`),

  createInvestigation: (data: {
    name: string
    anchor_point_id?: string
    anchor_alarm_id?: string
  }): Promise<ApiResult<Investigation>> =>
    api.post<Investigation>('/api/forensics/investigations', data),

  updateInvestigation: (
    id: string,
    data: { name: string },
  ): Promise<ApiResult<Investigation>> =>
    api.put<Investigation>(`/api/forensics/investigations/${id}`, data),

  closeInvestigation: (id: string): Promise<ApiResult<Investigation>> =>
    api.post<Investigation>(`/api/forensics/investigations/${id}/close`, {}),

  cancelInvestigation: (id: string): Promise<ApiResult<Investigation>> =>
    api.post<Investigation>(`/api/forensics/investigations/${id}/cancel`, {}),

  deleteInvestigation: (id: string): Promise<ApiResult<void>> =>
    api.delete<void>(`/api/forensics/investigations/${id}`),

  addStage: (
    id: string,
    data: {
      name: string
      time_range_start: string
      time_range_end: string
      sort_order?: number
    },
  ): Promise<ApiResult<InvestigationStage>> =>
    api.post<InvestigationStage>(`/api/forensics/investigations/${id}/stages`, data),

  updateStage: (
    id: string,
    stageId: string,
    data: Partial<InvestigationStage>,
  ): Promise<ApiResult<InvestigationStage>> =>
    api.put<InvestigationStage>(
      `/api/forensics/investigations/${id}/stages/${stageId}`,
      data,
    ),

  deleteStage: (id: string, stageId: string): Promise<ApiResult<void>> =>
    api.delete<void>(`/api/forensics/investigations/${id}/stages/${stageId}`),

  addEvidence: (
    id: string,
    stageId: string,
    data: {
      evidence_type: string
      config: Record<string, unknown>
      sort_order?: number
    },
  ): Promise<ApiResult<EvidenceItem>> =>
    api.post<EvidenceItem>(
      `/api/forensics/investigations/${id}/stages/${stageId}/evidence`,
      data,
    ),

  updateEvidence: (
    id: string,
    stageId: string,
    evidenceId: string,
    config: Record<string, unknown>,
  ): Promise<ApiResult<EvidenceItem>> =>
    api.put<EvidenceItem>(
      `/api/forensics/investigations/${id}/stages/${stageId}/evidence/${evidenceId}`,
      { config },
    ),

  deleteEvidence: (
    id: string,
    stageId: string,
    evidenceId: string,
  ): Promise<ApiResult<void>> =>
    api.delete<void>(
      `/api/forensics/investigations/${id}/stages/${stageId}/evidence/${evidenceId}`,
    ),

  listPoints: (id: string): Promise<ApiResult<InvestigationPoint[]>> =>
    api.get<InvestigationPoint[]>(`/api/forensics/investigations/${id}/points`),

  addPoints: (id: string, pointIds: string[]): Promise<ApiResult<void>> =>
    api.post<void>(`/api/forensics/investigations/${id}/points`, { point_ids: pointIds }),

  removePoint: (id: string, pointId: string, reason?: string): Promise<ApiResult<void>> =>
    api.post<void>(`/api/forensics/investigations/${id}/points/${pointId}/remove`, {
      reason,
    }),

  runCorrelation: (data: {
    point_ids: string[]
    start: string
    end: string
    bucket_interval?: string
  }): Promise<
    ApiResult<{
      correlations: CorrelationResult[]
      change_points: unknown[]
      spikes: unknown[]
    }>
  > => api.post(`/api/forensics/correlate`, data),

  thresholdSearch: (data: {
    point_id: string
    operator: string
    threshold: number
    lookback_days?: number
  }): Promise<ApiResult<ThresholdExceedance[]>> =>
    api.post<ThresholdExceedance[]>('/api/forensics/threshold-search', data),

  alarmSearch: (data: {
    point_id: string
    start?: string
    end?: string
  }): Promise<ApiResult<unknown[]>> =>
    api.post<unknown[]>('/api/forensics/alarm-search', data),
}
