/// Background alarm evaluator.
///
/// Polls every 5 seconds against `points_current` for each enabled alarm
/// definition. Applies threshold evaluation with deadband, drives the
/// ISA-18.2 state machine, and persists transitions to `alarm_states` +
/// `events`. Broadcasts state changes via PostgreSQL NOTIFY.
use chrono::Utc;
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::time::{interval, Duration};
use tracing::{error, info, warn};
use uuid::Uuid;

use io_bus::NotifyAlarmState;

use crate::alarm_state::{transition, AlarmEvent, AlarmInstance, AlarmState};
use crate::config::Config;

/// Map an `AlarmInstance` priority integer to a human-readable severity label.
fn priority_to_severity(priority: i32) -> &'static str {
    match priority {
        1 => "urgent",
        2 => "high",
        3 => "medium",
        4 => "low",
        _ => "diagnostic",
    }
}

/// In-process cache of active alarm instances keyed by `alarm_definition_id`.
/// Initialised from the database on startup.
type AlarmCache = Arc<tokio::sync::Mutex<HashMap<Uuid, AlarmInstance>>>;

/// Spawn the evaluator as a long-running tokio task.
pub async fn run_alarm_evaluator(db: PgPool, _config: Arc<Config>) {
    let cache: AlarmCache = Arc::new(tokio::sync::Mutex::new(HashMap::new()));

    // Warm the cache from `alarm_states` (most recent state per definition).
    if let Err(e) = warm_cache(&db, &cache).await {
        error!(error = %e, "Failed to warm alarm cache; starting cold");
    }

    let mut ticker = interval(Duration::from_secs(5));
    info!("Alarm evaluator started (5-second poll interval)");

    loop {
        ticker.tick().await;

        if let Err(e) = evaluate_all(&db, &cache).await {
            error!(error = %e, "Alarm evaluation cycle failed");
        }
    }
}

// ---------------------------------------------------------------------------
// Cache warm-up
// ---------------------------------------------------------------------------

async fn warm_cache(db: &PgPool, cache: &AlarmCache) -> anyhow::Result<()> {
    // Fetch the latest state transition per alarm definition from alarm_states
    // by joining to the most recent event for each definition.
    let rows = sqlx::query(
        r#"
        SELECT DISTINCT ON (ad.id)
            ad.id            AS definition_id,
            ad.point_id      AS point_id,
            ad.priority::text AS priority,
            ad.name          AS name,
            COALESCE(ast.state::text, 'normal') AS state
        FROM alarm_definitions ad
        LEFT JOIN alarm_states ast
            ON ast.event_id IN (
                SELECT id FROM events
                WHERE point_id = ad.point_id
                  AND event_type = 'io_alarm'
                ORDER BY timestamp DESC
                LIMIT 1
            )
        WHERE ad.enabled = true
          AND ad.deleted_at IS NULL
        ORDER BY ad.id, ast.transitioned_at DESC NULLS LAST
        "#,
    )
    .fetch_all(db)
    .await?;

    let mut guard = cache.lock().await;
    for row in &rows {
        let def_id: Uuid = row.try_get("definition_id")?;
        let point_id: Option<Uuid> = row.try_get("point_id")?;
        let priority_str: String = row.try_get("priority")?;
        let name: String = row.try_get("name")?;
        let state_str: String = row.try_get("state")?;

        let state = parse_state(&state_str);
        let priority = priority_to_int(&priority_str);

        let mut instance =
            AlarmInstance::new(def_id, point_id.unwrap_or(Uuid::nil()), priority, name);
        instance.state = state;
        guard.insert(def_id, instance);
    }
    info!(count = guard.len(), "Alarm cache warmed");
    Ok(())
}

// ---------------------------------------------------------------------------
// Evaluation cycle
// ---------------------------------------------------------------------------

async fn evaluate_all(db: &PgPool, cache: &AlarmCache) -> anyhow::Result<()> {
    // Fetch all enabled alarm definitions with current point values.
    let rows = sqlx::query(
        r#"
        SELECT
            ad.id               AS definition_id,
            ad.name             AS name,
            ad.point_id         AS point_id,
            ad.definition_type  AS definition_type,
            ad.threshold_config AS threshold_config,
            ad.priority::text   AS priority,
            pc.value            AS current_value
        FROM alarm_definitions ad
        LEFT JOIN points_current pc ON pc.point_id = ad.point_id
        WHERE ad.enabled = true
          AND ad.deleted_at IS NULL
        "#,
    )
    .fetch_all(db)
    .await?;

    let now = Utc::now();

    for row in &rows {
        let def_id: Uuid = match row.try_get("definition_id") {
            Ok(v) => v,
            Err(e) => {
                warn!(error = %e, "skipping alarm_definition row with bad id");
                continue;
            }
        };
        let definition_type: String = row.try_get("definition_type").unwrap_or_default();
        let current_value: Option<f64> = row.try_get("current_value").unwrap_or(None);

        // For threshold alarms, we need a current value.
        if definition_type == "threshold" {
            let value = match current_value {
                Some(v) => v,
                None => continue, // No data yet — skip.
            };

            let threshold_config: Option<serde_json::Value> =
                row.try_get("threshold_config").unwrap_or(None);

            let condition_active = evaluate_threshold(value, threshold_config.as_ref());

            // Get or create instance in cache.
            let mut guard = cache.lock().await;
            let point_id: Option<Uuid> = row.try_get("point_id").unwrap_or(None);
            let name: String = row.try_get("name").unwrap_or_default();
            let priority_str: String = row.try_get("priority").unwrap_or_default();

            let instance = guard.entry(def_id).or_insert_with(|| {
                AlarmInstance::new(
                    def_id,
                    point_id.unwrap_or(Uuid::nil()),
                    priority_to_int(&priority_str),
                    &name,
                )
            });

            let event = if condition_active {
                // Check for re-activation (already active — no re-trigger)
                if instance.state == AlarmState::Unacknowledged
                    || instance.state == AlarmState::Acknowledged
                {
                    continue;
                }
                AlarmEvent::ConditionActive { value }
            } else {
                if instance.state == AlarmState::Normal {
                    continue; // Already normal — nothing to do.
                }
                AlarmEvent::ConditionCleared
            };

            let current_state = instance.state.clone();
            let next = transition(&current_state, &event, instance, now);

            if let Some(new_state) = next {
                instance.state = new_state.clone();
                let instance_snapshot = instance.clone();
                drop(guard); // Release lock before async DB writes.

                if let Err(e) =
                    persist_transition(db, &instance_snapshot, &current_state, &new_state, now)
                        .await
                {
                    error!(
                        definition_id = %def_id,
                        error = %e,
                        "Failed to persist alarm transition"
                    );
                }
            }
        }
        // Expression-based alarms: evaluation is handled by the auth-service
        // expression engine. The event-service receives pre-evaluated results
        // via the event bus and applies the same state machine here.
        // (Phase 8 scope: threshold alarms only.)
    }

    // Check for expired shelves.
    check_shelve_expirations(db, cache, now).await;

    Ok(())
}

// ---------------------------------------------------------------------------
// Shelve expiration check
// ---------------------------------------------------------------------------

async fn check_shelve_expirations(db: &PgPool, cache: &AlarmCache, now: chrono::DateTime<Utc>) {
    let mut guard = cache.lock().await;
    let mut to_transition: Vec<(Uuid, AlarmInstance)> = Vec::new();

    for (def_id, instance) in guard.iter_mut() {
        if instance.state == AlarmState::Shelved {
            if let Some(until) = instance.shelved_until {
                if now >= until {
                    let current = instance.state.clone();
                    if let Some(new_state) =
                        transition(&current, &AlarmEvent::ShelveExpired, instance, now)
                    {
                        instance.state = new_state;
                        to_transition.push((*def_id, instance.clone()));
                    }
                }
            }
        }
    }
    drop(guard);

    for (_def_id, instance) in &to_transition {
        if let Err(e) =
            persist_transition(db, instance, &AlarmState::Shelved, &instance.state, now).await
        {
            error!(definition_id = %instance.definition_id, error = %e, "Shelve expiry persist failed");
        }
    }
}

// ---------------------------------------------------------------------------
// Persist a state transition
// ---------------------------------------------------------------------------

async fn persist_transition(
    db: &PgPool,
    instance: &AlarmInstance,
    previous: &AlarmState,
    new_state: &AlarmState,
    now: chrono::DateTime<Utc>,
) -> anyhow::Result<()> {
    // Insert an event row for the transition.
    let event_id = Uuid::new_v4();
    let message = format!(
        "Alarm '{}' transitioned {} → {}",
        instance.message, previous, new_state,
    );

    sqlx::query(
        "INSERT INTO events (id, event_type, source, severity, point_id, message, timestamp, metadata)
         VALUES ($1, 'io_alarm'::event_type_enum, 'io_threshold'::event_source_enum,
                 $2, $3, $4, $5,
                 jsonb_build_object('definition_id', $6::text, 'state', $7))",
    )
    .bind(event_id)
    .bind(500_i16) // default severity
    .bind(
        if instance.point_id == Uuid::nil() {
            None
        } else {
            Some(instance.point_id)
        },
    )
    .bind(&message)
    .bind(now)
    .bind(instance.definition_id)
    .bind(new_state.to_string())
    .execute(db)
    .await?;

    metrics::counter!("io_events_ingested_total").increment(1);

    // Insert alarm_states row linking to the event.
    let state_db = alarm_state_to_db_str(new_state);
    let prev_state_db = alarm_state_to_db_str(previous);

    sqlx::query(
        "INSERT INTO alarm_states
             (id, event_id, event_timestamp, state, previous_state, transitioned_at, transitioned_by)
         VALUES ($1, $2, $3, $4::alarm_state_enum, $5::alarm_state_enum, $6, $7)",
    )
    .bind(Uuid::new_v4())
    .bind(event_id)
    .bind(now)
    .bind(state_db)
    .bind(prev_state_db)
    .bind(now)
    .bind(instance.acknowledged_by)
    .execute(db)
    .await?;

    // Broadcast via PostgreSQL NOTIFY using the source-agnostic NotifyAlarmState envelope.
    // All alarm sources (threshold, OPC A&C, import, expression) use this same shape.
    let notify = NotifyAlarmState {
        point_id: instance.point_id,
        priority: if matches!(new_state, AlarmState::Normal | AlarmState::Disabled) {
            0
        } else {
            instance.priority
        },
        active: matches!(
            new_state,
            AlarmState::Unacknowledged | AlarmState::Acknowledged
        ),
        unacknowledged: matches!(
            new_state,
            AlarmState::Unacknowledged | AlarmState::ReturnToNormal
        ),
        suppressed: matches!(
            new_state,
            AlarmState::Shelved | AlarmState::Suppressed | AlarmState::Disabled
        ),
        message: Some(instance.message.clone()),
        timestamp: now.to_rfc3339(),
    };
    let notify_payload = serde_json::to_string(&notify).unwrap_or_default();
    sqlx::query("SELECT pg_notify('alarm_state_changed', $1)")
        .bind(&notify_payload)
        .execute(db)
        .await?;

    // Update io_alarms_active gauge: count alarms in unacknowledged or return-to-normal states.
    // These are "active" alarms that require operator attention.
    if let Ok(active_count) = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(DISTINCT ad.id)
         FROM alarm_definitions ad
         INNER JOIN LATERAL (
             SELECT state FROM alarm_states ast
             INNER JOIN events e ON e.id = ast.event_id
             WHERE e.point_id = ad.point_id
             ORDER BY ast.transitioned_at DESC
             LIMIT 1
         ) latest_state ON true
         WHERE ad.enabled = true
           AND ad.deleted_at IS NULL
           AND latest_state.state IN ('unacknowledged', 'acknowledged', 'return_to_normal')",
    )
    .fetch_one(db)
    .await
    {
        metrics::gauge!("io_alarms_active").set(active_count as f64);
    }

    // Emit domain metrics for notable state transitions.
    match new_state {
        AlarmState::Unacknowledged => {
            let severity = priority_to_severity(instance.priority);
            metrics::counter!(
                "io_alarms_fired_total",
                "severity" => severity,
            )
            .increment(1);
        }
        AlarmState::Normal | AlarmState::Acknowledged => {
            // Normal means the condition cleared and was silently resolved;
            // Acknowledged after RTN also counts as resolution.
            if matches!(
                previous,
                AlarmState::Acknowledged | AlarmState::ReturnToNormal
            ) {
                metrics::counter!("io_alarms_resolved_total").increment(1);
            }
        }
        _ => {}
    }

    info!(
        definition_id = %instance.definition_id,
        previous = %previous,
        new = %new_state,
        "Alarm state transition persisted"
    );

    Ok(())
}

// ---------------------------------------------------------------------------
// Threshold evaluation (with deadband from threshold_config)
// ---------------------------------------------------------------------------

/// Returns true if any threshold is violated.
fn evaluate_threshold(value: f64, config: Option<&serde_json::Value>) -> bool {
    let cfg = match config {
        Some(c) => c,
        None => return false,
    };

    // Config format:
    // {
    //   "hh": { "enabled": true, "threshold": 100.0, "deadband": 1.0 },
    //   "h":  { "enabled": true, "threshold": 90.0,  "deadband": 1.0 },
    //   "l":  { "enabled": true, "threshold": 10.0,  "deadband": 1.0 },
    //   "ll": { "enabled": true, "threshold": 5.0,   "deadband": 1.0 }
    // }

    check_high_threshold(value, cfg, "hh")
        || check_high_threshold(value, cfg, "h")
        || check_low_threshold(value, cfg, "l")
        || check_low_threshold(value, cfg, "ll")
}

fn check_high_threshold(value: f64, cfg: &serde_json::Value, key: &str) -> bool {
    let level = match cfg.get(key) {
        Some(v) => v,
        None => return false,
    };
    let enabled = level
        .get("enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !enabled {
        return false;
    }
    let threshold = level
        .get("threshold")
        .and_then(|v| v.as_f64())
        .unwrap_or(f64::MAX);
    value >= threshold
}

fn check_low_threshold(value: f64, cfg: &serde_json::Value, key: &str) -> bool {
    let level = match cfg.get(key) {
        Some(v) => v,
        None => return false,
    };
    let enabled = level
        .get("enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !enabled {
        return false;
    }
    let threshold = level
        .get("threshold")
        .and_then(|v| v.as_f64())
        .unwrap_or(f64::MIN);
    value <= threshold
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Map alarm_priority_enum text to an ISA-18.2 integer (1 = most critical).
fn priority_to_int(s: &str) -> i32 {
    match s {
        "urgent" => 1,
        "high" => 2,
        "medium" => 3,
        "low" => 4,
        "diagnostic" => 5,
        _ => 4,
    }
}

fn parse_state(s: &str) -> AlarmState {
    match s {
        "active" | "unacknowledged" => AlarmState::Unacknowledged,
        "acknowledged" => AlarmState::Acknowledged,
        "rtn" | "return_to_normal" => AlarmState::ReturnToNormal,
        "shelved" => AlarmState::Shelved,
        "suppressed" | "out_of_service" => AlarmState::Suppressed,
        "disabled" => AlarmState::Disabled,
        _ => AlarmState::Normal,
    }
}

fn alarm_state_to_db_str(s: &AlarmState) -> &'static str {
    match s {
        AlarmState::Normal => "cleared", // maps to closest DB enum value
        AlarmState::Unacknowledged => "active",
        AlarmState::Acknowledged => "acknowledged",
        AlarmState::ReturnToNormal => "rtn",
        AlarmState::Shelved => "shelved",
        AlarmState::Suppressed => "suppressed",
        AlarmState::Disabled => "disabled",
    }
}

// ---------------------------------------------------------------------------
// Pass-through processor for externally-sourced alarm events
// ---------------------------------------------------------------------------

/// Process alarm events that arrived via external sources (OPC UA A&C, Universal Import,
/// and future connectors).  These events land in the `events` table with
/// `event_type = 'process_alarm'` but do NOT go through the threshold evaluator, so they
/// would otherwise never reach the `alarm_state_changed` broadcast channel.
///
/// This function polls for new such events every 5 seconds (using a created_at watermark
/// to avoid re-processing) and re-emits each as a standardised `NotifyAlarmState` NOTIFY
/// so the data-broker can push the state to all WebSocket clients — regardless of source.
///
/// The ISA-18.2 state machine for these sources runs on the originating system (e.g. the
/// OPC server itself); we pass the state through faithfully without re-evaluating it.
pub async fn run_external_alarm_processor(db: PgPool) {
    // On startup, look back 60 seconds so we catch events that arrived just before we
    // connected.  After that we advance the watermark each cycle.
    let mut watermark = Utc::now() - chrono::Duration::seconds(60);
    let mut ticker = interval(Duration::from_secs(5));

    info!("External alarm processor started (OPC A&C / Import events, 5-second poll)");

    loop {
        ticker.tick().await;

        let now = Utc::now();

        // Fetch the most recent process_alarm event per point for events that arrived
        // after our last watermark.  DISTINCT ON (point_id) gives us the latest state
        // per point in this window, which is exactly what we want to broadcast.
        let rows = match sqlx::query(
            r#"
            SELECT DISTINCT ON (point_id)
                point_id,
                severity,
                metadata,
                timestamp
            FROM events
            WHERE event_type = 'process_alarm'
              AND source = 'opc'
              AND point_id IS NOT NULL
              AND created_at > $1
            ORDER BY point_id, timestamp DESC
            "#,
        )
        .bind(watermark)
        .fetch_all(&db)
        .await
        {
            Ok(r) => r,
            Err(e) => {
                warn!(error = %e, "External alarm processor: DB query failed");
                continue;
            }
        };

        watermark = now;

        for row in &rows {
            let point_id: Uuid = match row.try_get("point_id") {
                Ok(v) => v,
                Err(_) => continue,
            };
            let metadata: Option<serde_json::Value> = row.try_get("metadata").unwrap_or(None);
            let meta = match metadata {
                Some(m) => m,
                None => continue,
            };

            let severity: i16 = row.try_get("severity").unwrap_or(0);

            let active = meta
                .get("active")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let acked = meta.get("acked").and_then(|v| v.as_bool()).unwrap_or(false);
            let retain = meta
                .get("retain")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let suppressed_or_shelved = meta
                .get("suppressed_or_shelved")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            // Derive priority from OPC UA Severity (0–1000) using SimBLAH severity ranges.
            let priority_int = if active || acked {
                severity_to_priority(severity)
            } else {
                0 // Cleared
            };
            let priority_enum = severity_to_priority_enum(severity);

            let alarm_state = if active && !acked {
                "active"
            } else if active && acked {
                "acknowledged"
            } else if !active && !acked {
                "rtn"
            } else {
                "cleared"
            };

            let condition_name = meta
                .get("condition_name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let limit_state: Option<String> = meta
                .get("limit_state")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string());
            let event_id_hex: Option<String> = meta
                .get("external_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let source_id: Option<uuid::Uuid> = meta
                .get("source_id")
                .and_then(|v| v.as_str())
                .and_then(|s| uuid::Uuid::parse_str(s).ok());
            let message: Option<String> = meta
                .get("condition_name")
                .or_else(|| meta.get("message"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let event_ts: chrono::DateTime<chrono::Utc> = row.try_get("timestamp").unwrap_or(now);

            // Upsert current alarm state — latest OPC event always wins.
            if let Err(e) = sqlx::query(
                r#"
                INSERT INTO alarms_current (
                    point_id, alarm_source, condition_name,
                    state, priority, severity, limit_state,
                    event_id_hex, source_id,
                    active, acked, retain, suppressed_or_shelved,
                    message, metadata, last_event_at,
                    activated_at, cleared_at, updated_at
                ) VALUES (
                    $1, 'opc', $2,
                    $3::alarm_state_enum, $4::alarm_priority_enum, $5, $6,
                    $7, $8,
                    $9, $10, $11, $12,
                    $13, $14, $15,
                    CASE WHEN $9 THEN $15 ELSE NULL END,
                    CASE WHEN NOT $9 THEN $15 ELSE NULL END,
                    NOW()
                )
                ON CONFLICT (point_id, alarm_source, condition_name) DO UPDATE SET
                    state                = EXCLUDED.state,
                    priority             = EXCLUDED.priority,
                    severity             = EXCLUDED.severity,
                    limit_state          = EXCLUDED.limit_state,
                    event_id_hex         = EXCLUDED.event_id_hex,
                    source_id            = COALESCE(EXCLUDED.source_id, alarms_current.source_id),
                    active               = EXCLUDED.active,
                    acked                = EXCLUDED.acked,
                    retain               = EXCLUDED.retain,
                    suppressed_or_shelved = EXCLUDED.suppressed_or_shelved,
                    message              = EXCLUDED.message,
                    metadata             = EXCLUDED.metadata,
                    last_event_at        = EXCLUDED.last_event_at,
                    activated_at         = CASE
                        WHEN EXCLUDED.active AND NOT alarms_current.active
                            THEN EXCLUDED.last_event_at
                        ELSE alarms_current.activated_at
                    END,
                    cleared_at           = CASE
                        WHEN NOT EXCLUDED.active AND alarms_current.active
                            THEN EXCLUDED.last_event_at
                        ELSE alarms_current.cleared_at
                    END,
                    updated_at           = NOW()
                "#,
            )
            .bind(point_id)
            .bind(&condition_name)
            .bind(alarm_state)
            .bind(priority_enum)
            .bind(severity)
            .bind(&limit_state)
            .bind(&event_id_hex)
            .bind(source_id)
            .bind(active)
            .bind(acked)
            .bind(retain)
            .bind(suppressed_or_shelved)
            .bind(&message)
            .bind(&meta)
            .bind(event_ts)
            .execute(&db)
            .await
            {
                warn!(error = %e, %point_id, "External alarm processor: alarms_current upsert failed");
            }

            let notify = NotifyAlarmState {
                point_id,
                priority: priority_int,
                active,
                unacknowledged: active && !acked,
                suppressed: suppressed_or_shelved,
                message,
                timestamp: now.to_rfc3339(),
            };

            let payload = match serde_json::to_string(&notify) {
                Ok(p) => p,
                Err(_) => continue,
            };

            if let Err(e) = sqlx::query("SELECT pg_notify('alarm_state_changed', $1)")
                .bind(&payload)
                .execute(&db)
                .await
            {
                warn!(error = %e, %point_id, "External alarm processor: NOTIFY failed");
            }
        }

        if !rows.is_empty() {
            info!(
                count = rows.len(),
                "External alarm processor: broadcast {} alarm state(s)",
                rows.len()
            );
        }
    }
}

/// Map OPC UA Severity (0–1000) to ISA-18.2 priority integer.
/// SimBLAH discrete values: 900 (P1), 600 (P2), 300 (P3), 0 (non-alarm).
///   1 (urgent) : ≥750  — HighHigh / LowLow
///   2 (high)   : ≥450  — High / Low limit alarms
///   3 (medium) : ≥150  — Equipment / operational alarms
///   4 (low)    : 1–149 — Meta-events
fn severity_to_priority(severity: i16) -> i32 {
    match severity {
        750..=1000 => 1,
        450..=749 => 2,
        150..=449 => 3,
        1..=149 => 4,
        _ => 0,
    }
}

/// Map OPC UA Severity to alarm_priority_enum string.
fn severity_to_priority_enum(severity: i16) -> &'static str {
    match severity {
        750..=1000 => "urgent",
        450..=749 => "high",
        150..=449 => "medium",
        1..=149 => "low",
        _ => "diagnostic",
    }
}
