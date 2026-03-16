import { api, queryString } from './client'
import type { ApiResult } from './client'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ConnectorTemplate {
  id: string
  slug: string
  name: string
  domain: string
  vendor: string
  description: string | null
  template_config: Record<string, unknown>
  required_fields: unknown[]
  target_tables: string[]
  version: string
}

export interface ImportConnection {
  id: string
  name: string
  connection_type: string
  config: Record<string, unknown>
  auth_type: string
  enabled: boolean
  last_tested_at: string | null
  last_test_status: string | null
  last_test_message: string | null
  created_at: string
}

export interface ImportDefinition {
  id: string
  connection_id: string
  name: string
  description: string | null
  source_config: Record<string, unknown>
  field_mappings: unknown[]
  transforms: unknown[]
  target_table: string
  enabled: boolean
  error_strategy: string
  batch_size: number
  template_id: string | null
  created_at: string
}

export interface ImportSchedule {
  id: string
  import_definition_id: string
  schedule_type: string
  schedule_config: Record<string, unknown>
  enabled: boolean
  next_run_at: string | null
  last_run_at: string | null
  created_at: string
}

export interface ImportRun {
  id: string
  import_definition_id: string
  definition_name: string | null
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'partial'
  triggered_by: string
  dry_run: boolean
  rows_extracted: number | null
  rows_loaded: number | null
  rows_errored: number | null
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  created_at: string
}

export interface ImportError {
  id: string
  import_run_id: string
  row_number: number | null
  field_name: string | null
  error_type: string
  error_message: string
  raw_value: string | null
  created_at: string
}

export interface SupplementalConnector {
  id: string
  name: string
  connection_type: string
  auth_type: string
  enabled: boolean
  last_tested_at: string | null
  last_test_status: string | null
  last_test_message: string | null
  created_at: string
}

export interface CreateSupplementalConnectorData {
  name: string
  connection_type: string
  point_source_id: string
  is_supplemental_connector: true
  auth_type: string
  config: Record<string, unknown>
  auth_config: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

export interface CreateConnectionBody {
  name: string
  connection_type: string
  config?: Record<string, unknown>
  auth_type?: string
  auth_config?: Record<string, unknown>
}

export interface UpdateConnectionBody {
  name?: string
  connection_type?: string
  config?: Record<string, unknown>
  auth_type?: string
  auth_config?: Record<string, unknown>
  enabled?: boolean
}

export interface CreateDefinitionBody {
  connection_id: string
  name: string
  description?: string
  source_config?: Record<string, unknown>
  field_mappings?: unknown[]
  transforms?: unknown[]
  target_table: string
  error_strategy?: string
  batch_size?: number
  template_id?: string
}

export interface UpdateDefinitionBody {
  name?: string
  description?: string
  source_config?: Record<string, unknown>
  field_mappings?: unknown[]
  transforms?: unknown[]
  target_table?: string
  error_strategy?: string
  batch_size?: number
  enabled?: boolean
}

export interface CreateScheduleBody {
  schedule_type: string
  schedule_config?: Record<string, unknown>
  enabled?: boolean
  next_run_at?: string
}

export interface UpdateScheduleBody {
  schedule_type?: string
  schedule_config?: Record<string, unknown>
  enabled?: boolean
  next_run_at?: string
}

export interface TriggerRunBody {
  dry_run?: boolean
}

// ---------------------------------------------------------------------------
// API object
// ---------------------------------------------------------------------------

const BASE = '/api/import'

export const importApi = {
  // Connector Templates
  listTemplates(params?: { domain?: string }): Promise<ApiResult<ConnectorTemplate[]>> {
    return api.get<ConnectorTemplate[]>(`${BASE}/connector-templates${queryString(params)}`)
  },

  getTemplate(slug: string): Promise<ApiResult<ConnectorTemplate>> {
    return api.get<ConnectorTemplate>(`${BASE}/connector-templates/${encodeURIComponent(slug)}`)
  },

  // Connections
  listConnections(params?: { enabled?: boolean }): Promise<ApiResult<ImportConnection[]>> {
    return api.get<ImportConnection[]>(`${BASE}/connections${queryString(params)}`)
  },

  createConnection(body: CreateConnectionBody): Promise<ApiResult<ImportConnection>> {
    return api.post<ImportConnection>(`${BASE}/connections`, body)
  },

  getConnection(id: string): Promise<ApiResult<ImportConnection>> {
    return api.get<ImportConnection>(`${BASE}/connections/${id}`)
  },

  updateConnection(id: string, body: UpdateConnectionBody): Promise<ApiResult<ImportConnection>> {
    return api.put<ImportConnection>(`${BASE}/connections/${id}`, body)
  },

  deleteConnection(id: string): Promise<ApiResult<{ deleted: boolean }>> {
    return api.delete<{ deleted: boolean }>(`${BASE}/connections/${id}`)
  },

  testConnection(id: string): Promise<ApiResult<{ status: string; message: string }>> {
    return api.post<{ status: string; message: string }>(`${BASE}/connections/${id}/test`, {})
  },

  // Definitions
  listDefinitions(params?: { connection_id?: string }): Promise<ApiResult<ImportDefinition[]>> {
    return api.get<ImportDefinition[]>(`${BASE}/definitions${queryString(params)}`)
  },

  createDefinition(body: CreateDefinitionBody): Promise<ApiResult<ImportDefinition>> {
    return api.post<ImportDefinition>(`${BASE}/definitions`, body)
  },

  getDefinition(id: string): Promise<ApiResult<ImportDefinition>> {
    return api.get<ImportDefinition>(`${BASE}/definitions/${id}`)
  },

  updateDefinition(id: string, body: UpdateDefinitionBody): Promise<ApiResult<ImportDefinition>> {
    return api.put<ImportDefinition>(`${BASE}/definitions/${id}`, body)
  },

  deleteDefinition(id: string): Promise<ApiResult<{ deleted: boolean }>> {
    return api.delete<{ deleted: boolean }>(`${BASE}/definitions/${id}`)
  },

  // Schedules
  listSchedules(definitionId: string): Promise<ApiResult<ImportSchedule[]>> {
    return api.get<ImportSchedule[]>(`${BASE}/definitions/${definitionId}/schedules`)
  },

  createSchedule(definitionId: string, body: CreateScheduleBody): Promise<ApiResult<ImportSchedule>> {
    return api.post<ImportSchedule>(`${BASE}/definitions/${definitionId}/schedules`, body)
  },

  updateSchedule(id: string, body: UpdateScheduleBody): Promise<ApiResult<ImportSchedule>> {
    return api.put<ImportSchedule>(`${BASE}/schedules/${id}`, body)
  },

  deleteSchedule(id: string): Promise<ApiResult<{ deleted: boolean }>> {
    return api.delete<{ deleted: boolean }>(`${BASE}/schedules/${id}`)
  },

  // Runs
  listRuns(definitionId: string, params?: { limit?: number }): Promise<ApiResult<ImportRun[]>> {
    return api.get<ImportRun[]>(`${BASE}/definitions/${definitionId}/runs${queryString(params)}`)
  },

  triggerRun(definitionId: string, body: TriggerRunBody): Promise<ApiResult<ImportRun>> {
    return api.post<ImportRun>(`${BASE}/definitions/${definitionId}/runs`, body)
  },

  getRun(id: string): Promise<ApiResult<ImportRun>> {
    return api.get<ImportRun>(`${BASE}/runs/${id}`)
  },

  getRunErrors(id: string): Promise<ApiResult<ImportError[]>> {
    return api.get<ImportError[]>(`${BASE}/runs/${id}/errors`)
  },

  cancelRun(id: string): Promise<ApiResult<{ cancelled: boolean }>> {
    return api.post<{ cancelled: boolean }>(`${BASE}/runs/${id}/cancel`, {})
  },

  // Supplemental Point Data connectors
  listSupplementalConnectors(pointSourceId: string): Promise<ApiResult<SupplementalConnector[]>> {
    return api.get<SupplementalConnector[]>(
      `${BASE}/connections${queryString({ point_source_id: pointSourceId, supplemental: true })}`,
    )
  },

  createSupplementalConnector(
    data: CreateSupplementalConnectorData,
  ): Promise<ApiResult<SupplementalConnector>> {
    return api.post<SupplementalConnector>(`${BASE}/connections`, data)
  },

  testSupplementalConnector(
    connectionId: string,
  ): Promise<ApiResult<{ status: string; message: string }>> {
    return api.post<{ status: string; message: string }>(
      `${BASE}/connections/${connectionId}/test`,
      {},
    )
  },

  deleteSupplementalConnector(connectionId: string): Promise<ApiResult<{ deleted: boolean }>> {
    return api.delete<{ deleted: boolean }>(`${BASE}/connections/${connectionId}`)
  },
}
