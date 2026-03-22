---
id: DD-37-004
title: Add six missing NOTIFY payload types to io-bus (NotifyEvent, NotifyAlert, etc.)
unit: DD-37
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The `io-bus` crate defines types for PostgreSQL NOTIFY/LISTEN channels used for
inter-service events. The spec defines 9 payload types across 9 channels. Only 2 are
present (`NotifyPointUpdates`, `NotifyPointMetadataChanged`). The missing 6 types cover
event notifications, alert dispatch, alert triggers, import status, export progress, and
presence updates — all required by services that LISTEN on those channels.

## Spec Excerpt (verbatim)

> All NOTIFY payloads are JSON. All conform to these rules:
> - UTF-8 encoded
> - Max 7,500 bytes (within PostgreSQL's 8KB limit with margin)
> - Channel names are static strings (no dynamic channel names)
> - Every payload includes a `type` field for forward compatibility
> — 37_IPC_CONTRACTS.md, §5

The spec then defines types for channels: `events`, `alerts`, `alert_trigger`,
`import_status`, `export_progress`, `presence_updates`, `email_send`.

## Where to Look in the Codebase

Primary files:
- `crates/io-bus/src/lib.rs:198-228` — existing NOTIFY types (only 2 present)
- `design-docs/37_IPC_CONTRACTS.md` §5 — all 9 payload type definitions

## Verification Checklist

- [ ] `NotifyEvent` struct exists with fields: `msg_type`, `event_id`, `event_type`, `severity`, `point_id: Option<Uuid>`, `summary`
- [ ] `NotifyAlert` struct exists with fields: `msg_type`, `alert_id`, `severity`, `template_name`, `title`, `requires_acknowledgment: bool`, `full_screen_takeover: bool`
- [ ] `NotifyAlertTrigger` struct exists with fields: `msg_type`, `source_event_id`, `trigger_type`, `severity`, `point_id: Option<Uuid>`, `context: serde_json::Value`
- [ ] `NotifyImportStatus` struct exists with fields: `msg_type`, `run_id`, `status`, `progress_pct: u8`, `error_message: Option<String>`
- [ ] `NotifyExportProgress` struct exists with fields: `msg_type`, `job_id`, `user_id`, `status`, `progress_pct: u8`
- [ ] `NotifyPresenceUpdate` struct exists with fields: `msg_type`, `user_id`, `presence_state`, `badge_event_type: Option<String>`, `timestamp: String`

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `crates/io-bus/src/lib.rs` ends after `NotifyPointMetadataChanged` at line 228. All 6 listed types are absent.

## Fix Instructions (if needed)

Add these structs to `crates/io-bus/src/lib.rs` after the existing NOTIFY types (after line 228).
Copy the exact field names from `37_IPC_CONTRACTS.md` §5. Use `#[serde(rename = "type")]` on
the `msg_type` field (matching the pattern already used by `NotifyPointUpdates` at line 206).

```rust
/// Sent on channel `events` by Event Service; consumed by Data Broker.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotifyEvent {
    #[serde(rename = "type")]
    pub msg_type: String,       // always "event"
    pub event_id: Uuid,
    pub event_type: String,     // "alarm", "system", "user_action", etc.
    pub severity: String,       // "emergency", "critical", "warning", "info"
    pub point_id: Option<Uuid>,
    pub summary: String,
}

/// Sent on channel `alerts` by Alert Service; consumed by Data Broker.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotifyAlert {
    #[serde(rename = "type")]
    pub msg_type: String,       // always "alert"
    pub alert_id: Uuid,
    pub severity: String,
    pub template_name: String,
    pub title: String,
    pub requires_acknowledgment: bool,
    pub full_screen_takeover: bool,
}

/// Sent on channel `alert_trigger` by Event Service; consumed by Alert Service.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotifyAlertTrigger {
    #[serde(rename = "type")]
    pub msg_type: String,       // always "alert_trigger"
    pub source_event_id: Uuid,
    pub trigger_type: String,
    pub severity: String,
    pub point_id: Option<Uuid>,
    pub context: serde_json::Value,
}

/// Sent on channel `import_status` by Import Service; consumed by API Gateway.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotifyImportStatus {
    #[serde(rename = "type")]
    pub msg_type: String,       // always "import_status"
    pub run_id: Uuid,
    pub status: String,         // "running", "completed", "failed"
    pub progress_pct: u8,
    pub error_message: Option<String>,
}

/// Sent on channel `export_progress` by API Gateway; consumed by Data Broker.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotifyExportProgress {
    #[serde(rename = "type")]
    pub msg_type: String,       // always "export_progress"
    pub job_id: Uuid,
    pub user_id: Uuid,
    pub status: String,         // "queued", "processing", "completed", "failed"
    pub progress_pct: u8,
}

/// Sent on channel `presence_updates` by API Gateway; consumed by Data Broker.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotifyPresenceUpdate {
    #[serde(rename = "type")]
    pub msg_type: String,       // always "presence_update"
    pub user_id: Uuid,
    pub presence_state: String, // "on_site", "off_site"
    pub badge_event_type: Option<String>,
    pub timestamp: String,      // RFC 3339
}

/// Sent on channel `email_send` by any service; consumed by Email Service.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotifyEmailSend {
    #[serde(rename = "type")]
    pub msg_type: String,       // always "email_send"
    pub template_id: Option<Uuid>,
    pub to: Vec<String>,
    pub subject: Option<String>,
    pub template_variables: Option<serde_json::Value>,
    pub priority: String,       // "normal", "critical", "high", "low"
    pub context_type: String,   // "report", "alert", "export", "round", "auth", "test"
    pub context_id: Option<Uuid>,
}
```

Do NOT:
- Use strong-typed enums for `event_type`, `severity`, `status` fields — these NOTIFY types use `String` for forward compatibility (the spec explicitly says so via the 7,500-byte constraint and forward-compat rule)
- Put these in a separate module — keep them alongside the existing NOTIFY types in `io-bus/src/lib.rs`
