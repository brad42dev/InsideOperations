/**
 * IPC contracts — TypeScript parity for Rust wire types (doc 37 §16)
 *
 * These interfaces must remain in lockstep with the Rust types in io-models.
 * Any change to a Rust struct that crosses a service/frontend boundary requires
 * a corresponding update here in the same commit.
 */

// ---------------------------------------------------------------------------
// REST envelope
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: FieldError[];
  };
}

export interface FieldError {
  field: string;
  message: string;
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_AGGREGATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "GONE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE";

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
}

// ---------------------------------------------------------------------------
// Point types
// ---------------------------------------------------------------------------

export type PointQuality = "good" | "uncertain" | "bad";

export interface PointValue {
  point_id: string;
  value: number;
  quality: PointQuality;
  timestamp: string; // RFC 3339
}

export interface PointMetadata {
  point_id: string;
  tagname: string;
  description?: string;
  engineering_units?: string;
  data_type: string;
  source_id: string;
  active: boolean;
  criticality?: string;
  area?: string;
}

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export type EventType =
  | "alarm"
  | "system"
  | "user_action"
  | "import"
  | "authentication";
export type EventSeverity = "emergency" | "critical" | "warning" | "info";

export interface IpcEvent {
  event_id: string;
  event_type: EventType;
  severity: EventSeverity;
  point_id?: string;
  source_id?: string;
  summary: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Alert types
// ---------------------------------------------------------------------------

export type AlertChannel =
  | "web_socket"
  | "email"
  | "sms"
  | "voice"
  | "radio"
  | "pa";

export interface AlertDispatch {
  alert_id: string;
  severity: EventSeverity;
  template_id: string;
  title: string;
  message: string;
  recipients: AlertRecipient[];
  channels: AlertChannel[];
  requires_acknowledgment: boolean;
  full_screen_takeover: boolean;
  triggered_by: string;
  triggered_at: string;
}

export interface AlertRecipient {
  user_id: string;
  delivery_channels: AlertChannel[];
}

// ---------------------------------------------------------------------------
// User identity
// ---------------------------------------------------------------------------

export interface UserIdentity {
  user_id: string;
  username: string;
  roles: string[];
  permissions: string[];
  site_id?: string;
}

// ---------------------------------------------------------------------------
// Source types
// ---------------------------------------------------------------------------

export type SourceState = "active" | "inactive" | "connecting" | "error";

export interface SourceStatus {
  source_id: string;
  source_type: string;
  status: SourceState;
  last_connected_at?: string;
  last_error_at?: string;
  last_error?: string;
}

// ---------------------------------------------------------------------------
// WebSocket server → client messages
// ---------------------------------------------------------------------------

export interface WsBatchUpdate {
  points: WsPointValue[];
}

export interface WsPointValue {
  id: string; // point_id UUID
  v: number; // value
  q: PointQuality; // quality
  t: number; // epoch_ms
}

export interface WsPointStale {
  point_id: string;
  last_updated_at: string; // RFC 3339
}

export interface WsPointFresh {
  point_id: string;
  value: number;
  timestamp: string; // RFC 3339
}

export interface WsSourceStatus {
  source_id: string;
  source_name: string;
}

export interface WsAlertNotification {
  alert_id: string;
  severity: EventSeverity;
  template_name: string;
  title: string;
  message: string;
  requires_acknowledgment: boolean;
  full_screen_takeover: boolean;
  triggered_at: string;
}

export interface WsAlertAcknowledged {
  alert_id: string;
  acknowledged_by: string;
  acknowledged_at: string;
}

export interface WsExportNotification {
  job_id: string;
  status: "completed" | "failed";
  download_url?: string;
  error_message?: string;
}

export interface WsExportProgress {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress_pct: number;
}

export interface WsPresenceUpdate {
  user_id: string;
  presence_state: "on_site" | "off_site";
  badge_event_type?: string;
  timestamp: string;
}

export type WsServerMessage =
  | { type: "update"; payload: WsBatchUpdate }
  | { type: "point_stale"; payload: WsPointStale }
  | { type: "point_fresh"; payload: WsPointFresh }
  | { type: "source_offline"; payload: WsSourceStatus }
  | { type: "source_online"; payload: WsSourceStatus }
  | { type: "alert_notification"; payload: WsAlertNotification }
  | { type: "alert_acknowledged"; payload: WsAlertAcknowledged }
  | { type: "export_notification"; payload: WsExportNotification }
  | { type: "export_progress"; payload: WsExportProgress }
  | { type: "presence_update"; payload: WsPresenceUpdate }
  | { type: "ping"; payload: Record<string, never> }
  | { type: "server_restarting"; payload: Record<string, never> };

// ---------------------------------------------------------------------------
// WebSocket client → server messages
// ---------------------------------------------------------------------------

export type WsClientMessage =
  | { type: "subscribe"; points: string[] }
  | { type: "unsubscribe"; points: string[] }
  | { type: "acknowledge_alert"; alert_id: string }
  | { type: "pong" }
  | {
      type: "status_report";
      render_fps: number;
      pending_updates: number;
      last_batch_process_ms: number;
    }
  | { type: "client_hint"; device_type: "phone" | "tablet" | "desktop" };

// ---------------------------------------------------------------------------
// Health check types
// ---------------------------------------------------------------------------

export type ReadyStatus = "ready" | "degraded" | "not_ready";

export interface ReadyResponse {
  status: ReadyStatus;
  service: string;
  version: string;
  uptime_seconds: number;
  checks: Record<string, CheckResult>;
}

export interface CheckResult {
  status: "ok" | "timeout" | "error";
  latency_ms: number;
  error?: string;
}
