import { api, queryString, type ApiResult, type PaginatedResult } from './client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardVariable {
  name: string
  label: string
  type: 'query' | 'custom' | 'text' | 'interval' | 'constant' | 'chained'
  query?: string
  options?: string[]
  depends_on?: string
  multi?: boolean
  include_all?: boolean
  default?: string
}

export interface WidgetConfig {
  id: string
  type: string
  x: number
  y: number
  w: number
  h: number
  config: Record<string, unknown>
}

export interface Dashboard {
  id: string
  name: string
  description?: string
  category?: string
  layout: Record<string, unknown>
  widgets: WidgetConfig[]
  variables: DashboardVariable[]
  published: boolean
  is_system: boolean
  user_id?: string
  created_at: string
  updated_at: string
}

export interface CreateDashboardRequest {
  name: string
  description?: string
  category?: string
  layout: Record<string, unknown>
  widgets: WidgetConfig[]
  variables: DashboardVariable[]
}

export interface UpdateDashboardRequest {
  name?: string
  description?: string
  category?: string
  layout?: Record<string, unknown>
  widgets?: WidgetConfig[]
  variables?: DashboardVariable[]
  published?: boolean
}

export interface PlaylistItem {
  id: string
  dashboard_id: string
  position: number
  dwell_seconds: number
  variable_overrides: Record<string, unknown>
}

export interface Playlist {
  id: string
  name: string
  items: PlaylistItem[]
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const dashboardsApi = {
  list: (params?: {
    published?: boolean
    category?: string
    system?: boolean
  }): Promise<ApiResult<PaginatedResult<Dashboard>>> =>
    api.get<PaginatedResult<Dashboard>>(`/api/dashboards${queryString(params)}`),

  get: (id: string): Promise<ApiResult<Dashboard>> =>
    api.get<Dashboard>(`/api/dashboards/${id}`),

  create: (data: CreateDashboardRequest): Promise<ApiResult<Dashboard>> =>
    api.post<Dashboard>('/api/dashboards', data),

  update: (id: string, data: UpdateDashboardRequest): Promise<ApiResult<Dashboard>> =>
    api.put<Dashboard>(`/api/dashboards/${id}`, data),

  delete: (id: string): Promise<ApiResult<void>> =>
    api.delete<void>(`/api/dashboards/${id}`),

  duplicate: (id: string): Promise<ApiResult<Dashboard>> =>
    api.post<Dashboard>(`/api/dashboards/${id}/duplicate`, {}),

  listPlaylists: (): Promise<ApiResult<Playlist[]>> =>
    api.get<Playlist[]>('/api/dashboards/playlists'),

  getPlaylist: (id: string): Promise<ApiResult<Playlist>> =>
    api.get<Playlist>(`/api/dashboards/playlists/${id}`),

  createPlaylist: (data: {
    name: string
    items: Omit<PlaylistItem, 'id'>[]
  }): Promise<ApiResult<Playlist>> =>
    api.post<Playlist>('/api/dashboards/playlists', data),

  updatePlaylist: (id: string, data: Partial<Playlist>): Promise<ApiResult<Playlist>> =>
    api.put<Playlist>(`/api/dashboards/playlists/${id}`, data),

  deletePlaylist: (id: string): Promise<ApiResult<void>> =>
    api.delete<void>(`/api/dashboards/playlists/${id}`),

  /** Export a dashboard as a .iographic ZIP (returns Blob) */
  exportIographic: async (id: string, description?: string): Promise<Blob> => {
    const token = localStorage.getItem('io_access_token')
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const resp = await fetch(`/api/dashboards/${id}/export/iographic`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ description: description ?? '' }),
      credentials: 'include',
    })
    if (!resp.ok) throw new Error(`Export failed: ${resp.statusText}`)
    return resp.blob()
  },
}
