import { api, queryString, PaginatedResult } from './client'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const TOKEN_KEY = 'io_access_token'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TargetType = 'users' | 'opc_sources' | 'alarm_definitions' | 'import_connections'

export const TARGET_TYPE_LABELS: Record<TargetType, string> = {
  users: 'Users',
  opc_sources: 'OPC Sources',
  alarm_definitions: 'Alarm Definitions',
  import_connections: 'Import Connections',
}

export interface Snapshot {
  id: string
  target_type: TargetType
  label: string | null
  row_count: number
  created_by: string | null
  created_at: string
}

export interface SnapshotDetail extends Snapshot {
  snapshot_data: Record<string, unknown>[]
}

export interface CreateSnapshotRequest {
  target_type: TargetType
  label?: string
}

export interface ModifiedRow {
  id: string
  before: Record<string, unknown>
  after: Record<string, unknown>
  changed_fields: string[]
}

export interface DiffPreview {
  added: Record<string, unknown>[]
  modified: ModifiedRow[]
  removed: Record<string, unknown>[]
  unchanged_count: number
}

export interface ApplySummary {
  snapshot_id: string
  added: number
  modified: number
  removed: number
  unchanged: number
}

export interface RestoreResult {
  restored_snapshot_id: string
  safety_snapshot_id: string
  rows_restored: number
}

export interface ListSnapshotsParams {
  page?: number
  limit?: number
}

// ---------------------------------------------------------------------------
// Snapshots API
// ---------------------------------------------------------------------------

export const snapshotsApi = {
  list: (params?: ListSnapshotsParams) =>
    api.get<PaginatedResult<Snapshot>>(
      `/api/snapshots${queryString(params as Record<string, unknown>)}`,
    ),

  get: (id: string) => api.get<SnapshotDetail>(`/api/snapshots/${id}`),

  create: (req: CreateSnapshotRequest) => api.post<{ id: string }>('/api/snapshots', req),

  delete: (id: string) => api.delete(`/api/snapshots/${id}`),

  restore: (id: string) => api.post<RestoreResult>(`/api/snapshots/${id}/restore`, {}),
}

// ---------------------------------------------------------------------------
// Bulk Update API — multipart helpers
// ---------------------------------------------------------------------------

async function multipartPost<T>(
  path: string,
  formData: FormData,
): Promise<{ success: true; data: T } | { success: false; error: { code: string; message: string } }> {
  const token = localStorage.getItem(TOKEN_KEY)
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  // Do NOT set Content-Type — browser sets it with boundary automatically

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData,
    })
  } catch {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Network request failed' } }
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return { success: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse server response' } }
  }

  if (!res.ok) {
    const errJson = json as { error?: { code: string; message: string }; code?: string; message?: string }
    return {
      success: false,
      error: errJson.error ?? { code: errJson.code ?? 'SERVER_ERROR', message: errJson.message ?? `Server error: ${res.status}` },
    }
  }

  const envelope = json as { success?: boolean; data?: T } & Record<string, unknown>
  if ('data' in envelope) {
    return { success: true, data: envelope.data as T }
  }
  return { success: true, data: json as T }
}

export const bulkUpdateApi = {
  /** Download the CSV template for a target type (returns a Blob URL). */
  downloadTemplate: async (targetType: TargetType): Promise<void> => {
    const token = localStorage.getItem(TOKEN_KEY)
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`${API_BASE}/api/bulk-update/template/${targetType}`, {
      headers,
      credentials: 'include',
    })

    if (!res.ok) {
      throw new Error(`Failed to download template: ${res.status}`)
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${targetType}-bulk-update.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  /** Preview changes for a CSV upload. */
  preview: (targetType: TargetType, file: File) => {
    const fd = new FormData()
    fd.append('target_type', targetType)
    fd.append('file', file)
    return multipartPost<DiffPreview>('/api/bulk-update/preview', fd)
  },

  /** Apply changes from a CSV upload. Creates a safety snapshot first. */
  apply: (targetType: TargetType, file: File) => {
    const fd = new FormData()
    fd.append('target_type', targetType)
    fd.append('file', file)
    return multipartPost<ApplySummary>('/api/bulk-update/apply', fd)
  },
}
