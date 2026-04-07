import { api, queryString, type ApiResult } from "./client";

export interface PointSource {
  id: string;
  name: string;
  endpoint_url: string;
  source_type: string;
  security_policy: string;
  security_mode: string;
  username: string | null;
  enabled: boolean;
  status: string;
  last_connected_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  created_at: string;
}

export interface CreatePointSourceRequest {
  name: string;
  endpoint_url: string;
  source_type: "opc_ua";
  security_policy?: string;
  security_mode?: string;
  username?: string;
  password?: string;
  client_certificate_id?: string | null;
  platform?: string | null;
  publish_interval_ms?: number | null;
}

export interface UpdatePointSourceRequest {
  name?: string;
  endpoint_url?: string;
  enabled?: boolean;
  security_policy?: string;
  security_mode?: string;
  username?: string;
  password?: string;
  client_certificate_id?: string | null;
  platform?: string | null;
  publish_interval_ms?: number | null;
}

/** Existing PointMeta shape used by the OPC sources listing */
export interface PointMeta {
  id: string;
  tagname: string;
  source_id: string;
  display_name: string | null;
  unit: string | null;
  data_type: string | null;
  /** OPC UA AnalogItemType.EURange.low — engineering minimum (from OPC UA metadata crawl) */
  eu_range_low: number | null;
  /** OPC UA AnalogItemType.EURange.high — engineering maximum (from OPC UA metadata crawl) */
  eu_range_high: number | null;
  point_category: "analog" | "boolean" | "discrete_enum";
  /**
   * OPC UA MinimumSamplingInterval (AttributeId 11) in milliseconds.
   * Null = unknown (treat as 1000 ms). Values from SimBLAH:
   *   1000      — normal 1 Hz process tag
   *   300000    — GC analyzer (5-minute cycle)
   *   3600000   — lab/quality analyzer (1-hour cycle)
   * Tags with interval ≥ 5000 ms should use step/hold-last-value rendering.
   */
  minimum_sampling_interval_ms: number | null;
}

export interface HistoryRow {
  timestamp: string;
  value: number | null;
  quality?: string;
  avg?: number | null;
  min?: number | null;
  max?: number | null;
  count?: number | null;
}

export interface HistoryResult {
  point_id: string;
  resolution: string;
  start: string;
  end: string;
  rows: HistoryRow[];
}

// ---------------------------------------------------------------------------
// New types for point detail panel / shared UI components
// ---------------------------------------------------------------------------

/** A single enum label entry for a discrete point */
export interface EnumLabel {
  idx: number;
  label: string;
}

/** Rich point metadata returned by GET /api/points/:id */
export interface PointDetail {
  id: string;
  name: string;
  description: string | null;
  engineering_unit: string | null;
  data_type: string;
  source_id: string;
  source_name: string;
  eu_range_low: number | null;
  eu_range_high: number | null;
  point_category: "analog" | "boolean" | "discrete_enum";
  enum_labels: EnumLabel[];
  minimum_sampling_interval_ms: number | null;
}

/**
 * Combined response from GET /api/v1/points/:id/detail — returns metadata
 * and the latest value snapshot in a single round-trip.
 */
export interface PointDetailResponse {
  id: string;
  name: string;
  description: string | null;
  engineering_unit: string | null;
  data_type: string;
  source_id: string;
  source_name: string;
  /** Latest value snapshot — may be null if no data has been recorded yet */
  latest: {
    value: number;
    quality: string;
    timestamp: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Alarm data types for PointDetailPanel
// ---------------------------------------------------------------------------

/** Alarm threshold row from GET /api/v1/points/:id/alarms */
export interface PointAlarmThreshold {
  level: "HH" | "H" | "L" | "LL";
  value: number | null;
  enabled: boolean;
}

/** Summary alarm event from the last 5 alarms list */
export interface PointAlarmEvent {
  id: string;
  timestamp: string;
  value: number | null;
  priority: "critical" | "high" | "medium" | "low" | string;
  state: string;
  message: string | null;
}

/** Combined alarm data response for the Point Detail panel */
export interface PointAlarmData {
  thresholds: PointAlarmThreshold[];
  alarm_count_30d: number;
  time_in_alarm_minutes: number;
  last_alarms: PointAlarmEvent[];
}

// ---------------------------------------------------------------------------
// Linked graphics types for PointDetailPanel
// ---------------------------------------------------------------------------

/** A graphic that contains this point (reverse lookup) */
export interface LinkedGraphic {
  id: string;
  name: string;
  /** 'console' | 'process' | 'designer' */
  type: string;
  route: string;
}

/** Latest value snapshot from the archive */
export interface PointLatest {
  point_id: string;
  value: number | null;
  quality: string;
  timestamp: string | null;
}

/** Single history entry from the archive time-series */
export interface HistoryEntry {
  time: string;
  value: number;
  quality: string;
}

// ---------------------------------------------------------------------------
// Existing API objects
// ---------------------------------------------------------------------------

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency_ms?: number | null;
}

export const pointSourcesApi = {
  list: () =>
    api.get<{
      data: PointSource[];
      pagination: { total: number; page: number; pages: number };
    }>("/api/points/sources"),
  get: (id: string) => api.get<PointSource>(`/api/points/sources/${id}`),
  create: (req: CreatePointSourceRequest) =>
    api.post<PointSource>("/api/points/sources", req),
  update: (id: string, req: UpdatePointSourceRequest) =>
    api.put<PointSource>(`/api/points/sources/${id}`, req),
  delete: (id: string) => api.delete(`/api/points/sources/${id}`),
  reconnect: (id: string) =>
    api.post<void>(`/api/opc/sources/${id}/reconnect`, {}),
  testConnection: (id: string) =>
    api.post<ConnectionTestResult>(`/api/opc/sources/${id}/test`, {}),
};

export const pointsApi = {
  list: (params?: {
    source_id?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    api.get<{
      data: PointMeta[];
      pagination: { total: number; page: number; pages: number };
    }>(`/api/points${queryString(params as Record<string, unknown>)}`),

  history: (
    pointId: string,
    params: {
      start: string;
      end: string;
      resolution?: string;
      limit?: number;
      bucket_seconds?: number;
      aggregate_function?: string;
    },
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
    params: {
      start: string;
      end: string;
      resolution?: string;
      limit?: number;
      bucket_seconds?: number;
      aggregate_function?: string;
    },
  ): Promise<ApiResult<HistoryEntry[]>> =>
    api.get<HistoryEntry[]>(
      `/api/archive/history/points/${pointId}${queryString(params as Record<string, unknown>)}`,
    ),

  /**
   * GET /api/v1/points/:id/detail — single request returning combined metadata
   * and latest value snapshot (spec CX-POINT-DETAIL non-negotiable #6).
   */
  getDetail: (pointId: string): Promise<ApiResult<PointDetailResponse>> =>
    api.get<PointDetailResponse>(`/api/v1/points/${pointId}/detail`),

  /** POST /api/points/batch-latest — bulk latest values */
  batchLatest: (pointIds: string[]): Promise<ApiResult<PointLatest[]>> =>
    api.post<PointLatest[]>("/api/points/batch-latest", {
      point_ids: pointIds,
    }),

  /** POST /api/points/history-batch — bulk historical data for multiple points */
  historyBatch: (
    pointIds: string[],
    params: {
      start: string;
      end: string;
      resolution?: string;
      limit?: number;
      bucket_seconds?: number;
      aggregate_function?: string;
    },
  ): Promise<ApiResult<HistoryResult[]>> =>
    api.post<HistoryResult[]>("/api/points/history-batch", {
      point_ids: pointIds,
      ...params,
    }),

  /**
   * GET /api/v1/points/:id/alarms — alarm thresholds, 30-day count, time in alarm,
   * and last 5 alarm events for the Point Detail panel.
   */
  getAlarmData: (pointId: string): Promise<ApiResult<PointAlarmData>> =>
    api.get<PointAlarmData>(
      `/api/v1/points/${encodeURIComponent(pointId)}/alarms`,
    ),

  /**
   * GET /api/v1/points/:id/graphics — reverse lookup against design_object_points
   * returning all graphics that contain this point.
   */
  getLinkedGraphics: (pointId: string): Promise<ApiResult<LinkedGraphic[]>> =>
    api.get<LinkedGraphic[]>(
      `/api/v1/points/${encodeURIComponent(pointId)}/graphics`,
    ),
};

// ---------------------------------------------------------------------------
// Point configuration (Settings > Points)
// ---------------------------------------------------------------------------

/** Aggregation type bitmask bit positions */
export const AGG_AVERAGING = 1;
export const AGG_SUM = 2;
export const AGG_ACCUMULATION = 4;

/** Full editable point configuration record */
export interface PointConfig {
  id: string;
  tagname: string;
  display_name: string | null;
  description: string | null;
  unit: string | null;
  data_type: string | null;
  source_id: string;
  source_name: string | null;
  active: boolean;
  criticality:
    | "safety_critical"
    | "environmental"
    | "production"
    | "informational"
    | null;
  area: string | null;
  default_graphic_id: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  barcode: string | null;
  notes: string | null;
  write_frequency_seconds: number | null;
  aggregation_types: number;
  custom_expression_id: string | null;
  custom_expression_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface PointConfigListResult {
  data: PointConfig[];
  pagination: { total: number; page: number; pages: number; limit: number };
}

export interface UpdatePointConfigRequest {
  active?: boolean;
  criticality?: string | null;
  area?: string | null;
  barcode?: string | null;
  notes?: string | null;
  write_frequency_seconds?: number | null;
  aggregation_types?: number;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  default_graphic_id?: string | null;
  custom_expression_id?: string | null;
}

export interface PointMetadataVersion {
  id: string;
  point_id: string;
  changed_at: string;
  changed_by: string | null;
  changes: Record<string, { old: unknown; new: unknown }>;
  version: number;
}

export const pointConfigApi = {
  list: (params?: {
    search?: string;
    source_id?: string;
    area?: string;
    active?: boolean;
    page?: number;
    limit?: number;
  }) =>
    api.get<PointConfigListResult>(
      `/api/points${queryString(params as Record<string, unknown>)}`,
    ),

  update: (id: string, req: UpdatePointConfigRequest) =>
    api.patch<PointConfig>(`/api/points/${id}`, req),

  deactivate: (id: string) =>
    api.post<PointConfig>(`/api/points/${id}/deactivate`, {}),

  reactivate: (id: string) =>
    api.post<PointConfig>(`/api/points/${id}/reactivate`, {}),

  bulkUpdateAggregation: (ids: string[], aggregation_types: number) =>
    api.post<{ updated: number }>("/api/points/bulk-aggregation", {
      point_ids: ids,
      aggregation_types,
    }),

  getMetadataVersions: (id: string) =>
    api.get<PointMetadataVersion[]>(`/api/points/${id}/metadata-versions`),
};

// ---------------------------------------------------------------------------
// History recovery
// ---------------------------------------------------------------------------

export interface RecoveryJob {
  id: string;
  source_id: string;
  from_time: string;
  to_time: string;
  status: "pending" | "running" | "complete" | "failed";
  points_recovered: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// OPC source stats
// ---------------------------------------------------------------------------

export interface PointSourceStats {
  source_id: string;
  point_count: number;
  active_subscriptions: number;
  updates_per_minute: number | null;
  error_count_24h: number;
  last_value_at: string | null;
}

export const pointSourceStatsApi = {
  /** GET /api/opc/sources/stats — stats for all sources (bulk) */
  listAll: () =>
    api.get<{
      data: PointSourceStats[];
      pagination: { total: number; page: number; pages: number };
    }>("/api/opc/sources/stats"),
  /** GET /api/opc/sources/:id/stats — stats for one source */
  get: (id: string) =>
    api.get<PointSourceStats>(`/api/opc/sources/${id}/stats`),
};

export const historyRecoveryApi = {
  createJob: (sourceId: string, fromTime: string, toTime?: string) =>
    api.post<{ id: string }>(`/api/opc/sources/${sourceId}/history-recovery`, {
      from_time: fromTime,
      ...(toTime ? { to_time: toTime } : {}),
    }),
  listJobs: (sourceId: string) =>
    api.get<RecoveryJob[]>(
      `/api/opc/sources/${sourceId}/history-recovery/jobs`,
    ),
};
