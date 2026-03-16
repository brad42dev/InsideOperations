import { api, queryString, type ApiResult } from './client'

export interface PointSource {
  id: string
  name: string
  endpoint_url: string
  source_type: string
  security_policy: string
  security_mode: string
  username: string | null
  enabled: boolean
  status: string
  last_connected_at: string | null
  last_error_at: string | null
  last_error_message: string | null
  created_at: string
}

export interface CreatePointSourceRequest {
  name: string
  endpoint_url: string
  source_type: 'opc_ua'
  security_policy?: string
  security_mode?: string
  username?: string
  password?: string
}

export interface UpdatePointSourceRequest {
  name?: string
  endpoint_url?: string
  enabled?: boolean
  security_policy?: string
  security_mode?: string
  username?: string
  password?: string
}

/** Existing PointMeta shape used by the OPC sources listing */
export interface PointMeta {
  id: string
  tagname: string
  source_id: string
  display_name: string | null
  unit: string | null
  data_type: string | null
}

export interface HistoryRow {
  timestamp: string
  value: number | null
  quality?: string
  avg?: number | null
  min?: number | null
  max?: number | null
  count?: number | null
}

export interface HistoryResult {
  point_id: string
  resolution: string
  start: string
  end: string
  rows: HistoryRow[]
}

// ---------------------------------------------------------------------------
// New types for point detail panel / shared UI components
// ---------------------------------------------------------------------------

/** Rich point metadata returned by GET /api/points/:id */
export interface PointDetail {
  id: string
  name: string
  description: string | null
  engineering_unit: string | null
  data_type: string
  source_id: string
  source_name: string
}

/** Latest value snapshot from the archive */
export interface PointLatest {
  point_id: string
  value: number
  quality: string
  timestamp: string
}

/** Single history entry from the archive time-series */
export interface HistoryEntry {
  time: string
  value: number
  quality: string
}

// ---------------------------------------------------------------------------
// Existing API objects
// ---------------------------------------------------------------------------

export const pointSourcesApi = {
  list: () => api.get<PointSource[]>('/api/points/sources'),
  get: (id: string) => api.get<PointSource>(`/api/points/sources/${id}`),
  create: (req: CreatePointSourceRequest) => api.post<PointSource>('/api/points/sources', req),
  update: (id: string, req: UpdatePointSourceRequest) =>
    api.put<PointSource>(`/api/points/sources/${id}`, req),
  delete: (id: string) => api.delete(`/api/points/sources/${id}`),
  reconnect: (id: string) => api.post<void>(`/api/opc/sources/${id}/reconnect`, {}),
}

export const pointsApi = {
  list: (params?: { source_id?: string; search?: string; page?: number; limit?: number }) =>
    api.get<{ data: PointMeta[]; pagination: { total: number; page: number; pages: number } }>(
      `/api/points${queryString(params as Record<string, unknown>)}`,
    ),

  history: (
    pointId: string,
    params: { start: string; end: string; resolution?: string; limit?: number },
  ) =>
    api.get<HistoryResult>(
      `/api/archive/history/points/${pointId}${queryString(params as Record<string, unknown>)}`,
    ),

  // -- New methods for shared UI components ---------------------------------

  /** GET /api/points/:id — rich point metadata */
  getMeta: (pointId: string): Promise<ApiResult<PointDetail>> =>
    api.get<PointDetail>(`/api/points/${pointId}`),

  /** GET /api/archive/history/points/:id/latest */
  getLatest: (pointId: string): Promise<ApiResult<PointLatest>> =>
    api.get<PointLatest>(`/api/archive/history/points/${pointId}/latest`),

  /** GET /api/archive/history/points/:id?start=&end=&resolution=&limit= */
  getHistory: (
    pointId: string,
    params: { start: string; end: string; resolution?: string; limit?: number },
  ): Promise<ApiResult<HistoryEntry[]>> =>
    api.get<HistoryEntry[]>(
      `/api/archive/history/points/${pointId}${queryString(params as Record<string, unknown>)}`,
    ),

  /** POST /api/points/batch-latest — bulk latest values */
  batchLatest: (pointIds: string[]): Promise<ApiResult<PointLatest[]>> =>
    api.post<PointLatest[]>('/api/points/batch-latest', { point_ids: pointIds }),
}
