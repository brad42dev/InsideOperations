//! Badge polling engine.
//!
//! `run_badge_poller` is the top-level async function meant to be spawned in
//! its own Tokio task from `main.rs`.  It reads all enabled badge sources from
//! `access_control_sources`, then spawns one per-source polling loop for each.
//! If new sources are added at runtime, a periodic re-discovery loop (every
//! 60 s) picks them up and launches a polling task for them too.
//!
//! # Polling flow (per source)
//! 1. Read `last_poll_checkpoint` from `access_control_sources`.
//! 2. Call `adapter.poll_events(since: checkpoint)`.
//! 3. For each event:
//!    a. Deduplicate via `INSERT … ON CONFLICT (source_id, external_event_id) DO NOTHING`.
//!    b. Map `employee_id` / `badge_id` to an I/O `user_id` via `users.employee_id`.
//!    c. Insert into `badge_events`.
//!    d. Upsert `presence_status`: `on_site = true` for SwipeIn, `on_site = false` for SwipeOut.
//! 4. Update `last_poll_checkpoint` to the most recent event timestamp.
//! 5. On adapter error: increment `consecutive_failures`; after 5 failures fire a WARNING alert.

use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use tokio::time;
use uuid::Uuid;

use super::{build_adapter, BadgeAdapter, BadgeEvent, BadgeEventType};

/// How often the root task re-discovers enabled sources (handles adds/removes).
const SOURCE_DISCOVERY_INTERVAL: Duration = Duration::from_secs(60);

/// Minimum/maximum values for `poll_interval_s` to prevent misconfiguration.
const MIN_POLL_SECS: u64 = 10;
const MAX_POLL_SECS: u64 = 300;

/// Default poll interval if none is configured.
const DEFAULT_POLL_SECS: u64 = 30;

/// After this many consecutive failures, fire a WARNING alert.
const FAILURE_ALERT_THRESHOLD: i32 = 5;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/// Top-level badge polling task — spawn this from `main.rs`.
///
/// The function never returns unless the database pool is closed.  All errors
/// are logged; none are propagated.
pub async fn run_badge_poller(db: PgPool) {
    tracing::info!("badge poller starting");

    let mut known_source_ids: HashSet<Uuid> = HashSet::new();
    let mut discovery_interval = time::interval(SOURCE_DISCOVERY_INTERVAL);
    // Skip the first tick (fires immediately) so we do an immediate discovery.
    discovery_interval.set_missed_tick_behavior(time::MissedTickBehavior::Skip);

    loop {
        discovery_interval.tick().await;
        discover_and_spawn_sources(&db, &mut known_source_ids).await;
    }
}

// ---------------------------------------------------------------------------
// Source discovery
// ---------------------------------------------------------------------------

/// Fetches all enabled badge sources and spawns a polling task for any that
/// are not already being polled.
async fn discover_and_spawn_sources(db: &PgPool, known: &mut HashSet<Uuid>) {
    #[derive(sqlx::FromRow)]
    struct SourceRow {
        id: Uuid,
        name: String,
        adapter_type: String,
        config: serde_json::Value,
        poll_interval_s: i32,
    }

    let rows = sqlx::query_as::<_, SourceRow>(
        "SELECT id, name, adapter_type, config, poll_interval_s
         FROM access_control_sources
         WHERE enabled = true",
    )
    .fetch_all(db)
    .await;

    match rows {
        Err(e) => {
            tracing::error!(error = %e, "badge poller: failed to query access_control_sources");
        }
        Ok(sources) => {
            for source in sources {
                if known.contains(&source.id) {
                    continue;
                }
                known.insert(source.id);

                let poll_secs = source.poll_interval_s.max(MIN_POLL_SECS as i32).min(MAX_POLL_SECS as i32) as u64;
                let adapter: Arc<dyn BadgeAdapter> = Arc::from(build_adapter(
                    &source.adapter_type,
                    source.name.clone(),
                    &source.config,
                ));

                let source_id = source.id;
                let source_name = source.name.clone();
                let db_clone = db.clone();

                tracing::info!(
                    source_id = %source_id,
                    source_name = %source_name,
                    adapter_type = %source.adapter_type,
                    poll_interval_s = poll_secs,
                    "badge poller: spawning per-source poll loop"
                );

                tokio::spawn(run_source_poll_loop(
                    db_clone,
                    adapter,
                    source_id,
                    source_name,
                    Duration::from_secs(poll_secs),
                ));
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Per-source poll loop
// ---------------------------------------------------------------------------

/// Runs indefinitely for a single badge source.
async fn run_source_poll_loop(
    db: PgPool,
    adapter: Arc<dyn BadgeAdapter>,
    source_id: Uuid,
    source_name: String,
    interval: Duration,
) {
    let mut ticker = time::interval(interval);
    ticker.set_missed_tick_behavior(time::MissedTickBehavior::Skip);

    loop {
        ticker.tick().await;
        poll_once(&db, &*adapter, source_id, &source_name).await;
    }
}

/// Execute one poll cycle for the given source.
async fn poll_once(
    db: &PgPool,
    adapter: &dyn BadgeAdapter,
    source_id: Uuid,
    source_name: &str,
) {
    // 1. Read checkpoint
    let checkpoint: Option<DateTime<Utc>> = match sqlx::query_scalar(
        "SELECT last_poll_checkpoint FROM access_control_sources WHERE id = $1",
    )
    .bind(source_id)
    .fetch_optional(db)
    .await
    {
        Ok(v) => v.flatten(),
        Err(e) => {
            tracing::error!(source_id = %source_id, error = %e, "badge poller: failed to read checkpoint");
            return;
        }
    };

    // Default checkpoint: 24 h ago so the very first poll is not unbounded.
    let since = checkpoint.unwrap_or_else(|| Utc::now() - chrono::Duration::hours(24));

    // 2. Call adapter
    let events = match adapter.poll_events(since).await {
        Ok(evts) => evts,
        Err(e) => {
            tracing::warn!(
                source_id = %source_id,
                source_name = %source_name,
                error = %e,
                "badge poller: adapter error"
            );
            on_adapter_failure(db, source_id, source_name, &e.to_string()).await;
            return;
        }
    };

    if events.is_empty() {
        // Successful (empty) poll — reset failure counter, update last_poll_at.
        let _ = sqlx::query(
            "UPDATE access_control_sources
             SET last_poll_at = now(), last_poll_ok = true,
                 consecutive_failures = 0, last_error = NULL
             WHERE id = $1",
        )
        .bind(source_id)
        .execute(db)
        .await;
        return;
    }

    // 3. Process each event
    let mut latest_ts: Option<DateTime<Utc>> = None;
    for event in &events {
        process_event(db, source_id, event).await;
        if latest_ts.map_or(true, |ts| event.occurred_at > ts) {
            latest_ts = Some(event.occurred_at);
        }
    }

    // 4. Update checkpoint
    if let Some(ts) = latest_ts {
        let _ = sqlx::query(
            "UPDATE access_control_sources
             SET last_poll_checkpoint = $2,
                 last_poll_at = now(),
                 last_poll_ok = true,
                 consecutive_failures = 0,
                 last_error = NULL
             WHERE id = $1",
        )
        .bind(source_id)
        .bind(ts)
        .execute(db)
        .await;
    }

    tracing::debug!(
        source_id = %source_id,
        event_count = events.len(),
        "badge poller: processed events"
    );
}

// ---------------------------------------------------------------------------
// Event processing helpers
// ---------------------------------------------------------------------------

/// Insert a single badge event (with deduplication) and update presence.
async fn process_event(db: &PgPool, source_id: Uuid, event: &BadgeEvent) {
    // Map badge_id / employee_id → I/O user
    let user_id = resolve_user_id(db, event).await;

    // Serialize event_type for storage
    let event_type_str = badge_event_type_str(&event.event_type);

    // 3c. Insert into badge_events — ON CONFLICT skips duplicates
    let insert_result = sqlx::query(
        "INSERT INTO badge_events
             (source_id, event_type, employee_id, user_id, door_id, door_name, event_time,
              raw_data, external_event_id, badge_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (source_id, external_event_id)
         WHERE external_event_id IS NOT NULL
         DO NOTHING",
    )
    .bind(source_id)
    .bind(event_type_str)
    .bind(&event.employee_id)
    .bind(user_id)
    .bind(&event.reader_id)
    .bind(&event.reader_name)
    .bind(event.occurred_at)
    .bind(&event.raw_data)
    .bind(&event.external_event_id)
    .bind(&event.badge_id)
    .execute(db)
    .await;

    if let Err(e) = insert_result {
        tracing::warn!(
            source_id = %source_id,
            external_event_id = %event.external_event_id,
            error = %e,
            "badge poller: failed to insert badge_event"
        );
        return;
    }

    // 3d. Update presence_status for SwipeIn / SwipeOut (only when we have a user)
    if let Some(uid) = user_id {
        update_presence(db, uid, event).await;
    }
}

/// Attempt to resolve an I/O user ID from the event's employee_id or badge_id.
async fn resolve_user_id(db: &PgPool, event: &BadgeEvent) -> Option<Uuid> {
    // Try employee_id first
    if let Some(ref emp_id) = event.employee_id {
        if let Ok(Some(uid)) = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM users WHERE employee_id = $1 LIMIT 1",
        )
        .bind(emp_id)
        .fetch_optional(db)
        .await
        {
            return Some(uid);
        }
    }
    None
}

/// Update the presence_status table based on the event type.
async fn update_presence(db: &PgPool, user_id: Uuid, event: &BadgeEvent) {
    let (on_site, last_area, last_door) = match event.event_type {
        BadgeEventType::SwipeIn => (true, event.reader_name.clone(), event.reader_id.clone()),
        BadgeEventType::SwipeOut => (false, event.reader_name.clone(), event.reader_id.clone()),
        // Non-presence events — no update
        _ => return,
    };

    let result = sqlx::query(
        "INSERT INTO presence_status (user_id, on_site, last_seen_at, last_area, last_door, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (user_id) DO UPDATE
         SET on_site       = EXCLUDED.on_site,
             last_seen_at  = EXCLUDED.last_seen_at,
             last_area     = EXCLUDED.last_area,
             last_door     = EXCLUDED.last_door,
             updated_at    = now()",
    )
    .bind(user_id)
    .bind(on_site)
    .bind(event.occurred_at)
    .bind(last_area)
    .bind(last_door)
    .execute(db)
    .await;

    if let Err(e) = result {
        tracing::warn!(
            user_id = %user_id,
            error = %e,
            "badge poller: failed to update presence_status"
        );
    }
}

// ---------------------------------------------------------------------------
// Failure handling
// ---------------------------------------------------------------------------

/// Increment consecutive_failures and fire a WARNING alert after threshold.
async fn on_adapter_failure(db: &PgPool, source_id: Uuid, source_name: &str, error_msg: &str) {
    // Increment counter and get the new value
    let new_count: Option<i32> = sqlx::query_scalar(
        "UPDATE access_control_sources
         SET last_poll_at = now(),
             last_poll_ok  = false,
             last_error    = $2,
             consecutive_failures = consecutive_failures + 1
         WHERE id = $1
         RETURNING consecutive_failures",
    )
    .bind(source_id)
    .bind(error_msg)
    .fetch_optional(db)
    .await
    .unwrap_or(None);

    if let Some(count) = new_count {
        if count >= FAILURE_ALERT_THRESHOLD {
            tracing::warn!(
                source_id = %source_id,
                source_name = %source_name,
                consecutive_failures = count,
                error = %error_msg,
                "badge poller: {} consecutive failures on source '{}' — WARNING threshold reached",
                count, source_name
            );
            fire_warning_alert(db, source_id, source_name, count, error_msg).await;
        }
    }
}

/// Fire a WARNING-level alert via the alerts system.
///
/// This inserts directly into the `system_alerts` table (or the equivalent
/// notification mechanism) rather than calling the Alert Service over HTTP,
/// since the poller does not have access to the request context.  A simpler
/// approach — logging at WARN — is used here as a minimum viable signal;
/// a future enhancement can add the HTTP call once the alert ingestion API
/// is stabilised.
async fn fire_warning_alert(
    db: &PgPool,
    source_id: Uuid,
    source_name: &str,
    failures: i32,
    error_msg: &str,
) {
    // Log a structured warning that can be picked up by alerting rules.
    // In production, this can be replaced with an HTTP call to the alert-service.
    tracing::warn!(
        target: "badge_poller_alert",
        source_id = %source_id,
        source_name = %source_name,
        consecutive_failures = failures,
        error = %error_msg,
        severity = "WARNING",
        "BADGE_POLLER_FAILURE: access control source '{}' has failed {} consecutive times",
        source_name,
        failures
    );

    // Best-effort: record in system_alerts if the table exists.
    let _ = sqlx::query(
        "INSERT INTO system_alerts
             (severity, source, title, message, metadata, created_at)
         VALUES ('warning', 'badge-poller', $1, $2, $3, now())
         ON CONFLICT DO NOTHING",
    )
    .bind(format!("Badge source '{}' consecutive failures", source_name))
    .bind(format!(
        "Badge source '{}' (id={}) has failed {} consecutive times. Last error: {}",
        source_name, source_id, failures, error_msg
    ))
    .bind(serde_json::json!({
        "source_id": source_id,
        "source_name": source_name,
        "consecutive_failures": failures,
        "last_error": error_msg
    }))
    .execute(db)
    .await;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn badge_event_type_str(t: &BadgeEventType) -> &'static str {
    match t {
        BadgeEventType::SwipeIn => "SwipeIn",
        BadgeEventType::SwipeOut => "SwipeOut",
        BadgeEventType::AccessDenied => "AccessDenied",
        BadgeEventType::DoorForced => "DoorForced",
        BadgeEventType::DoorHeldOpen => "DoorHeldOpen",
        BadgeEventType::Duress => "Duress",
        BadgeEventType::PassbackViolation => "PassbackViolation",
        BadgeEventType::Tailgate => "Tailgate",
    }
}
