import { api, queryString, PaginatedResult } from './client'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const TOKEN_KEY = 'io_access_token'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TargetType =
  | 'users'
  | 'opc_sources'
  | 'alarm_definitions'
  | 'import_connections'
  | 'points_metadata'
  | 'user_roles'
  | 'application_settings'
  | 'point_sources'
  | 'dashboard_metadata'
  | 'import_definitions'

export const TARGET_TYPE_LABELS: Record<TargetType, string> = {
  users: 'Users',
  opc_sources: 'OPC Sources',
  alarm_definitions: 'Alarm Definitions',
  import_connections: 'Import Connections',
  points_metadata: 'Points Metadata',
  user_roles: 'User Role Assignments',
  application_settings: 'Application Settings',
  point_sources: 'Point Sources',
  dashboard_metadata: 'Dashboard Metadata',
  import_definitions: 'Import Definitions',
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

/** Describes how one file column maps to a system field. */
export interface ColumnMapping {
  /** Column name as it appears in the uploaded file. */
  file_column: string
  /** System field name (stripped of [READ-ONLY] suffix). */
  system_field: string
  /** "matched" | "read_only" | "unmapped" */
  status: 'matched' | 'read_only' | 'unmapped'
}

/** A single row-level validation problem. */
export interface ValidationError {
  row: number
  id: string
  error: string
  field?: string
}

/** Summary of validation results from the preview call. */
export interface ValidationSummary {
  valid_id_count: number
  duplicate_id_count: number
  invalid_id_count: number
  type_error_count: number
  required_field_error_count: number
  errors: ValidationError[]
}

export interface DiffPreview {
  added: Record<string, unknown>[]
  modified: ModifiedRow[]
  /** Rows where updated_at > _exported_at — modified in the DB since template was downloaded. */
  conflicted: ModifiedRow[]
  removed: Record<string, unknown>[]
  unchanged_count: number
  column_mapping: ColumnMapping[]
  validation: ValidationSummary
}

/** A row that failed validation or errored during apply. */
export interface FailedRow {
  row: number
  id: string
  reason_type: 'validation_error' | 'skipped_conflict' | 'apply_error'
  reason: string
}

export interface ApplySummary {
  snapshot_id: string
  added: number
  modified: number
  removed: number
  unchanged: number
  validation_failed: number
  failed_rows: FailedRow[]
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

  /** Apply changes from a CSV/XLSX upload. Creates a safety snapshot first.
   *  conflictResolution: 'skip' (default) skips conflicted rows; 'overwrite' applies them. */
  apply: (targetType: TargetType, file: File, conflictResolution: 'skip' | 'overwrite' = 'skip') => {
    const fd = new FormData()
    fd.append('target_type', targetType)
    fd.append('file', file)
    fd.append('conflict_resolution', conflictResolution)
    return multipartPost<ApplySummary>('/api/bulk-update/apply', fd)
  },

  /**
   * Download an error report CSV for a given apply operation, identified by snapshot_id.
   * Falls back to client-side CSV generation from failed rows when snapshotId is not available.
   */
  downloadErrorReport: async (snapshotId: string, failedRows?: FailedRow[]): Promise<void> => {
    // If we have failed rows locally, generate the CSV client-side for immediacy
    if (failedRows && failedRows.length > 0) {
      const header = 'row,id,reason_type,reason\n'
      const lines = failedRows.map((r) => {
        const reasonEscaped = r.reason.includes(',') ? `"${r.reason.replace(/"/g, '""')}"` : r.reason
        return `${r.row},${r.id},${r.reason_type},${reasonEscaped}`
      })
      const csv = header + lines.join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bulk-update-error-report.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return
    }

    // Otherwise fetch from the server endpoint
    const token = localStorage.getItem(TOKEN_KEY)
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`${API_BASE}/api/bulk-update/${snapshotId}/error-report`, {
      headers,
      credentials: 'include',
    })

    if (!res.ok) {
      throw new Error(`Failed to download error report: ${res.status}`)
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bulk-update-${snapshotId}-error-report.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  /**
   * Download a "full results" CSV combining successful and failed rows.
   */
  downloadFullResults: (applyResult: ApplySummary, targetType: TargetType): void => {
    const header = 'snapshot_id,target_type,modified,unchanged,added,removed,validation_failed\n'
    const line = `${applyResult.snapshot_id},${targetType},${applyResult.modified},${applyResult.unchanged},${applyResult.added},${applyResult.removed},${applyResult.validation_failed}`
    const csv = header + line + '\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bulk-update-full-results-${applyResult.snapshot_id}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },
}
