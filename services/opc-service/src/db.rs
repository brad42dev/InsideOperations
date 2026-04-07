//! Database helpers for the OPC Service.

use anyhow::Context;
use chrono::{DateTime, Utc};
use io_bus::{NotifyPointUpdates, NotifyPointValue};
use io_db::DbPool;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/// A row from `point_sources` with source_type = 'opc_ua'.
#[derive(Debug, Clone)]
pub struct PointSource {
    pub id: Uuid,
    pub name: String,
    pub endpoint_url: String,
    pub security_policy: String, // "None", "Basic256Sha256", "Aes256Sha256RsaPss"
    pub security_mode: String,   // "None", "Sign", "SignAndEncrypt"
    pub username: Option<String>,
    pub password: Option<String>,
}

/// A single value update from an OPC UA subscription.
#[derive(Debug, Clone)]
pub struct PointUpdate {
    pub point_id: Uuid,
    pub value: f64,
    pub quality: String, // "good", "uncertain", "bad"
    pub timestamp: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Queries (use sqlx::query for offline build — no DATABASE_URL needed)
// ---------------------------------------------------------------------------

/// Load all enabled OPC UA sources.
pub async fn load_sources(db: &DbPool) -> anyhow::Result<Vec<PointSource>> {
    let rows = sqlx::query(
        r#"
        SELECT
            id,
            name,
            connection_config
        FROM point_sources
        WHERE source_type = 'opc_ua'
          AND enabled = true
        ORDER BY name
        "#,
    )
    .fetch_all(db)
    .await
    .context("load_sources: query failed")?;

    let mut sources = Vec::with_capacity(rows.len());
    for r in rows {
        use sqlx::Row;
        let config: serde_json::Value = r
            .try_get("connection_config")
            .context("load_sources: missing connection_config")?;

        let str_field = |key: &str, default: &str| -> String {
            config
                .get(key)
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .unwrap_or(default)
                .to_string()
        };
        let opt_str_field = |key: &str| -> Option<String> {
            config
                .get(key)
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
        };

        sources.push(PointSource {
            id: r.try_get("id").context("load_sources: missing id")?,
            name: r.try_get("name").context("load_sources: missing name")?,
            endpoint_url: str_field("endpoint_url", ""),
            security_policy: str_field("security_policy", "None"),
            security_mode: str_field("security_mode", "None"),
            username: opt_str_field("username"),
            password: opt_str_field("password"),
        });
    }

    Ok(sources)
}

/// Call the DB stored procedure to upsert a discovered point, returning its UUID.
pub async fn upsert_point_from_source(
    db: &DbPool,
    source_id: Uuid,
    tagname: &str,
    data_type: &str,
    metadata: serde_json::Value,
) -> anyhow::Result<Uuid> {
    // Use the OPC UA DisplayName as the point description if present.
    let display_name: Option<String> = metadata
        .get("display_name")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    let row = sqlx::query(
        r#"SELECT upsert_point_from_source($1, $2, $4, NULL, $5, NULL, NULL, $3) AS point_id"#,
    )
    .bind(source_id)
    .bind(tagname)
    .bind(metadata)
    .bind(display_name)
    .bind(data_type)
    .fetch_one(db)
    .await
    .context("upsert_point_from_source: query failed")?;

    use sqlx::Row;
    let point_id: Uuid = row
        .try_get("point_id")
        .context("upsert_point_from_source: missing point_id")?;

    Ok(point_id)
}

/// Upsert the point_category column and enum label rows for a discrete point.
/// `category` must be "boolean" or "discrete_enum".
/// `labels` is a slice of (idx, label) pairs — for boolean: [(0, "False"), (1, "True")].
pub async fn upsert_discrete_labels(
    db: &DbPool,
    point_id: Uuid,
    category: &str,
    labels: &[(i16, String)],
) -> anyhow::Result<()> {
    // Update point_category on the metadata row
    sqlx::query(r#"UPDATE points_metadata SET point_category = $2 WHERE id = $1"#)
        .bind(point_id)
        .bind(category)
        .execute(db)
        .await
        .context("upsert_discrete_labels: update point_category failed")?;

    // Upsert all label rows in a single statement using unnest
    if !labels.is_empty() {
        let idxs: Vec<i16> = labels.iter().map(|(i, _)| *i).collect();
        let texts: Vec<&str> = labels.iter().map(|(_, t)| t.as_str()).collect();
        sqlx::query(
            r#"INSERT INTO point_enum_labels (point_id, idx, label)
               SELECT $1, u.idx, u.label
               FROM UNNEST($2::smallint[], $3::text[]) AS u(idx, label)
               ON CONFLICT (point_id, idx) DO UPDATE SET label = EXCLUDED.label"#,
        )
        .bind(point_id)
        .bind(&idxs)
        .bind(&texts)
        .execute(db)
        .await
        .context("upsert_discrete_labels: label upsert failed")?;
    }

    Ok(())
}

/// Set the point_category on a point by its UUID.
/// Called during browse when a discrete type is identified.
pub async fn set_point_category(db: &DbPool, point_id: Uuid, category: &str) -> anyhow::Result<()> {
    sqlx::query(r#"UPDATE points_metadata SET point_category = $2 WHERE id = $1"#)
        .bind(point_id)
        .bind(category)
        .execute(db)
        .await
        .context("set_point_category: update failed")?;
    Ok(())
}

/// Merge additional JSON fields into source_raw of the latest metadata version for a point.
/// Used to attach discrete-type metadata (enum_strings, true_state, false_state) discovered
/// after the initial browse upsert.
pub async fn merge_point_source_raw(
    db: &DbPool,
    point_id: Uuid,
    extra: serde_json::Value,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        UPDATE points_metadata_versions
        SET source_raw = COALESCE(source_raw, '{}'::jsonb) || $2::jsonb
        WHERE point_id = $1
          AND version = (
              SELECT MAX(version) FROM points_metadata_versions WHERE point_id = $1
          )
        "#,
    )
    .bind(point_id)
    .bind(extra)
    .execute(db)
    .await
    .context("merge_point_source_raw: update failed")?;
    Ok(())
}

/// Metadata harvested from OPC UA Part 8 AnalogItemType optional properties.
/// All fields are optional — only populated when the server exposes them.
#[derive(Debug, Clone, Default)]
pub struct AnalogMetadata {
    pub description: Option<String>,       // DataItemType.Definition
    pub engineering_units: Option<String>, // AnalogItemType.EngineeringUnits displayName
    pub eu_range_low: Option<f64>,         // AnalogItemType.EURange.low
    pub eu_range_high: Option<f64>,        // AnalogItemType.EURange.high
    pub alarm_limit_hh: Option<f64>,       // AnalogItemType.HighHighLimit
    pub alarm_limit_h: Option<f64>,        // AnalogItemType.HighLimit
    pub alarm_limit_l: Option<f64>,        // AnalogItemType.LowLimit
    pub alarm_limit_ll: Option<f64>,       // AnalogItemType.LowLowLimit
}

/// Write OPC UA Part 8 analog metadata to points_metadata when available.
/// Only updates non-null fields; does not overwrite existing values with NULL.
/// Sets alarm_limit_source = 'opc_ua' when at least one limit is populated.
pub async fn update_point_analog_metadata(
    db: &DbPool,
    point_id: Uuid,
    meta: &AnalogMetadata,
) -> anyhow::Result<()> {
    let has_limits = meta.alarm_limit_hh.is_some()
        || meta.alarm_limit_h.is_some()
        || meta.alarm_limit_l.is_some()
        || meta.alarm_limit_ll.is_some();

    sqlx::query(
        r#"
        UPDATE points_metadata SET
            description        = COALESCE($2, description),
            engineering_units  = COALESCE($3, engineering_units),
            min_value          = COALESCE($4, min_value),
            max_value          = COALESCE($5, max_value),
            alarm_limit_hh     = COALESCE($6, alarm_limit_hh),
            alarm_limit_h      = COALESCE($7, alarm_limit_h),
            alarm_limit_l      = COALESCE($8, alarm_limit_l),
            alarm_limit_ll     = COALESCE($9, alarm_limit_ll),
            alarm_limit_source = CASE
                WHEN $10 THEN 'opc_ua'
                ELSE alarm_limit_source
            END,
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(point_id)
    .bind(&meta.description)
    .bind(&meta.engineering_units)
    .bind(meta.eu_range_low)
    .bind(meta.eu_range_high)
    .bind(meta.alarm_limit_hh)
    .bind(meta.alarm_limit_h)
    .bind(meta.alarm_limit_l)
    .bind(meta.alarm_limit_ll)
    .bind(has_limits)
    .execute(db)
    .await
    .context("update_point_analog_metadata: query failed")?;

    Ok(())
}

/// Batch-UPSERT point values into `points_current`.
pub async fn write_points_current(db: &DbPool, updates: &[PointUpdate]) -> anyhow::Result<()> {
    if updates.is_empty() {
        return Ok(());
    }

    // Build parallel arrays for unnest-based batch upsert.
    let ids: Vec<Uuid> = updates.iter().map(|u| u.point_id).collect();
    let values: Vec<f64> = updates.iter().map(|u| u.value).collect();
    let qualities: Vec<String> = updates.iter().map(|u| u.quality.clone()).collect();
    let timestamps: Vec<DateTime<Utc>> = updates.iter().map(|u| u.timestamp).collect();

    sqlx::query(
        r#"
        WITH data AS (
            SELECT DISTINCT ON (pt_id) pt_id, val, qual, ts
            FROM unnest($1::uuid[], $2::float8[], $3::text[], $4::timestamptz[]) AS t(pt_id, val, qual, ts)
            ORDER BY pt_id, ts DESC
        )
        INSERT INTO points_current (point_id, value, quality, timestamp, updated_at)
        SELECT pt_id, val, qual, ts, NOW() FROM data
        ON CONFLICT (point_id) DO UPDATE
            SET value      = EXCLUDED.value,
                quality    = EXCLUDED.quality,
                timestamp  = EXCLUDED.timestamp,
                updated_at = NOW()
        "#,
    )
    .bind(&ids)
    .bind(&values)
    .bind(&qualities)
    .bind(&timestamps)
    .execute(db)
    .await
    .context("write_points_current: query failed")?;

    Ok(())
}

/// Batch-INSERT historical values into `points_history_raw`.
pub async fn write_history_batch(db: &DbPool, updates: &[PointUpdate]) -> anyhow::Result<()> {
    if updates.is_empty() {
        return Ok(());
    }

    let ids: Vec<Uuid> = updates.iter().map(|u| u.point_id).collect();
    let values: Vec<f64> = updates.iter().map(|u| u.value).collect();
    let qualities: Vec<String> = updates.iter().map(|u| u.quality.clone()).collect();
    let timestamps: Vec<DateTime<Utc>> = updates.iter().map(|u| u.timestamp).collect();

    let row_count = updates.len() as u64;

    sqlx::query(
        r#"
        INSERT INTO points_history_raw (point_id, value, quality, timestamp)
        SELECT
            unnest($1::uuid[]),
            unnest($2::float8[]),
            unnest($3::text[]),
            unnest($4::timestamptz[])
        ON CONFLICT (point_id, timestamp) DO NOTHING
        "#,
    )
    .bind(&ids)
    .bind(&values)
    .bind(&qualities)
    .bind(&timestamps)
    .execute(db)
    .await
    .context("write_history_batch: query failed")?;

    metrics::counter!("io_timeseries_inserts_total").increment(row_count);

    Ok(())
}

/// Update the status column of a `point_sources` row.
pub async fn set_source_status(
    db: &DbPool,
    source_id: Uuid,
    status: &str,
    error_msg: Option<&str>,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        UPDATE point_sources
        SET
            status              = $2,
            last_error_at       = CASE WHEN $3::text IS NOT NULL THEN NOW() ELSE last_error_at END,
            last_error_message  = $3,
            last_connected_at   = CASE WHEN $2 = 'active' THEN NOW() ELSE last_connected_at END,
            updated_at          = NOW()
        WHERE id = $1
        "#,
    )
    .bind(source_id)
    .bind(status)
    .bind(error_msg)
    .execute(db)
    .await
    .context("set_source_status: query failed")?;

    Ok(())
}

// ---------------------------------------------------------------------------
// OPC UA Part 9 event writing
// ---------------------------------------------------------------------------

/// An OPC UA Alarms & Conditions event received from a Part 9 event subscription.
#[derive(Debug, Clone)]
pub struct OpcEvent {
    pub source_id: Uuid,
    /// Resolved point UUID (from SourceName → points_metadata lookup via node_map).
    /// NULL when the point is not known to the system.
    pub point_id: Option<Uuid>,
    pub event_id: Option<String>,    // hex-encoded EventId bytes
    pub event_type: Option<String>,  // NodeId string of EventType
    pub source_name: Option<String>, // SourceName field (= point name string)
    pub timestamp: DateTime<Utc>,    // Time field
    pub severity: Option<u16>,       // Severity field (1–1000)
    pub message: Option<String>,     // Message.text field
    pub condition_name: Option<String>,
    pub acked: bool,  // AckedState/Id
    pub active: bool, // ActiveState/Id
    pub retain: bool,
    /// LimitState/CurrentState — "HighHigh", "High", "Low", "LowLow", or "" for normal.
    pub limit_state: Option<String>,
    /// SuppressedOrShelved — true when the OPC server has shelved or suppressed this alarm.
    pub suppressed_or_shelved: bool,
    /// Configured alarm thresholds from the OPC server (HighHighLimit, HighLimit, etc.).
    pub high_high_limit: Option<f64>,
    pub high_limit: Option<f64>,
    pub low_limit: Option<f64>,
    pub low_low_limit: Option<f64>,
}

/// Map OPC UA Severity (0–1000) to ISA-18.2 alarm priority enum string.
/// SimBLAH discrete severity values: 900 (P1/HH+LL), 600 (P2/H+L), 300 (P3/equipment), 0 (non-alarm).
///   urgent (P1) : ≥750  — HighHigh / LowLow limit alarms
///   high   (P2) : ≥450  — High / Low limit alarms
///   medium (P3) : ≥150  — Equipment / operational alarms
///   low    (P4) : 1–149 — Meta-events (ConditionRefresh etc.)
fn severity_to_priority_enum(severity: i16) -> &'static str {
    match severity {
        750..=1000 => "urgent",
        450..=749 => "high",
        150..=449 => "medium",
        1..=149 => "low",
        _ => "diagnostic",
    }
}

/// Batch-insert OPC UA events into the `events` hypertable.
/// Alarm state machine metadata (active, acked, retain) is stored in the `metadata` JSONB column.
pub async fn write_opc_events(db: &DbPool, events: &[OpcEvent]) -> anyhow::Result<()> {
    if events.is_empty() {
        return Ok(());
    }

    for ev in events {
        // Map severity (OPC UA 1–1000) to our SMALLINT column directly.
        let severity = ev.severity.unwrap_or(500) as i16;

        // Derive alarm_state from active/acked flags.
        let alarm_state = if ev.active {
            "active"
        } else if ev.acked {
            "acknowledged"
        } else {
            "cleared"
        };

        let limit_state = ev.limit_state.as_deref().unwrap_or("");

        // Build metadata JSONB with all OPC A&C fields.
        // The external alarm processor in event-service reads `active`, `acked`,
        // `limit_state`, and `suppressed_or_shelved` from here to reconstruct
        // NotifyAlarmState for the alarm_state_changed broadcast.
        let metadata = serde_json::json!({
            "source_id":            ev.source_id,
            "external_id":          ev.event_id,
            "source_ref":           ev.source_name,
            "condition_name":       ev.condition_name,
            "event_type":           ev.event_type,
            "alarm_state":          alarm_state,
            "acked":                ev.acked,
            "active":               ev.active,
            "retain":               ev.retain,
            // New fields from SimBLAH A&C spec — consumed by event-service processor
            "limit_state":          limit_state,
            "suppressed_or_shelved": ev.suppressed_or_shelved,
            "high_high_limit":      ev.high_high_limit,
            "high_limit":           ev.high_limit,
            "low_limit":            ev.low_limit,
            "low_low_limit":        ev.low_low_limit,
        });

        let message = ev.message.as_deref().unwrap_or("(no message)");

        let priority = severity_to_priority_enum(severity);

        sqlx::query(
            r#"
            INSERT INTO events (
                event_type,
                source,
                severity,
                priority,
                point_id,
                message,
                timestamp,
                source_timestamp,
                source_event_id,
                metadata
            ) VALUES (
                'process_alarm',
                'opc',
                $1,
                $2::alarm_priority_enum,
                $3,
                $4,
                $5,
                $5,
                $6,
                $7
            )
            ON CONFLICT (timestamp, source_event_id)
            WHERE source_event_id IS NOT NULL
            DO NOTHING
            "#,
        )
        .bind(severity)
        .bind(priority)
        .bind(ev.point_id)
        .bind(message)
        .bind(ev.timestamp)
        .bind(ev.event_id.as_deref())
        .bind(&metadata)
        .execute(db)
        .await
        .context("write_opc_events: insert failed")?;
    }

    Ok(())
}

/// NOTIFY fallback: send point updates via PostgreSQL NOTIFY on channel `point_updates`.
pub async fn notify_broker(
    db: &DbPool,
    source_id: Uuid,
    points: &[PointUpdate],
) -> anyhow::Result<()> {
    if points.is_empty() {
        return Ok(());
    }

    // Chunk to stay under PostgreSQL's 8000-byte NOTIFY limit.
    for chunk in points.chunks(50) {
        let notify_points: Vec<NotifyPointValue> = chunk
            .iter()
            .map(|p| NotifyPointValue {
                id: p.point_id,
                value: p.value,
                quality: p.quality.clone(),
                ts: p.timestamp.to_rfc3339(),
            })
            .collect();

        let payload = NotifyPointUpdates {
            msg_type: "point_updates".to_string(),
            source_id,
            points: notify_points,
        };

        let payload_json = serde_json::to_string(&payload)
            .context("notify_broker: failed to serialize payload")?;

        sqlx::query("SELECT pg_notify('point_updates', $1)")
            .bind(&payload_json)
            .execute(db)
            .await
            .context("notify_broker: pg_notify failed")?;
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// History recovery jobs
// ---------------------------------------------------------------------------

/// A pending or running history recovery job.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct RecoveryJob {
    pub id: Uuid,
    pub source_id: Uuid,
    pub from_time: DateTime<Utc>,
    pub to_time: DateTime<Utc>,
}

/// Returns the latest timestamp stored in `points_history_raw` for the given
/// point IDs.  Accepts point IDs directly (already known from the node_map) so
/// we avoid a join against points_metadata and let the (point_id, timestamp DESC)
/// index satisfy the MAX per-chunk efficiently.
pub async fn get_last_history_timestamp(
    db: &DbPool,
    point_ids: &[Uuid],
) -> anyhow::Result<Option<DateTime<Utc>>> {
    let ts = sqlx::query_scalar::<_, Option<DateTime<Utc>>>(
        r#"SELECT MAX(timestamp) FROM points_history_raw WHERE point_id = ANY($1)"#,
    )
    .bind(point_ids)
    .fetch_one(db)
    .await
    .context("get_last_history_timestamp")?;
    Ok(ts)
}

/// Returns the earliest timestamp among the 100 most recently recorded values
/// for a source.  Used to compute the watchdog recovery window: we recover from
/// `(earliest_of_last_100 - 5 min)` to `now` so no data is lost even if the
/// last recorded point was slightly before the outage began.
pub async fn get_earliest_of_recent_points(
    db: &DbPool,
    source_id: Uuid,
) -> anyhow::Result<Option<DateTime<Utc>>> {
    let ts = sqlx::query_scalar::<_, Option<DateTime<Utc>>>(
        r#"SELECT MIN(sub.timestamp) AS earliest
           FROM (
               SELECT ph.timestamp
               FROM points_history_raw ph
               JOIN points_metadata pm ON pm.id = ph.point_id
               WHERE pm.source_id = $1
               ORDER BY ph.timestamp DESC
               LIMIT 100
           ) sub"#,
    )
    .bind(source_id)
    .fetch_one(db)
    .await
    .context("get_earliest_of_recent_points")?;
    Ok(ts)
}

/// Insert a new history recovery job and return its id.
pub async fn create_recovery_job(
    db: &DbPool,
    source_id: Uuid,
    from_time: DateTime<Utc>,
    to_time: DateTime<Utc>,
    requested_by: Option<Uuid>,
) -> anyhow::Result<Uuid> {
    let id = sqlx::query_scalar::<_, Uuid>(
        r#"INSERT INTO opc_history_recovery_jobs (source_id, from_time, to_time, requested_by)
           VALUES ($1, $2, $3, $4) RETURNING id"#,
    )
    .bind(source_id)
    .bind(from_time)
    .bind(to_time)
    .bind(requested_by)
    .fetch_one(db)
    .await
    .context("create_recovery_job")?;
    Ok(id)
}

/// Fetch pending jobs for a source (oldest first, limit 10).
pub async fn get_pending_recovery_jobs(
    db: &DbPool,
    source_id: Uuid,
) -> anyhow::Result<Vec<RecoveryJob>> {
    use sqlx::Row;
    let rows = sqlx::query(
        r#"SELECT id, source_id, from_time, to_time
           FROM opc_history_recovery_jobs
           WHERE source_id = $1 AND status = 'pending'
           ORDER BY created_at ASC
           LIMIT 10"#,
    )
    .bind(source_id)
    .fetch_all(db)
    .await
    .context("get_pending_recovery_jobs")?;

    rows.into_iter()
        .map(|row| {
            Ok(RecoveryJob {
                id: row.try_get("id")?,
                source_id: row.try_get("source_id")?,
                from_time: row.try_get("from_time")?,
                to_time: row.try_get("to_time")?,
            })
        })
        .collect::<anyhow::Result<Vec<_>>>()
}

/// Mark a job as running.
pub async fn claim_recovery_job(db: &DbPool, job_id: Uuid) -> anyhow::Result<()> {
    sqlx::query(
        "UPDATE opc_history_recovery_jobs SET status='running', started_at=now() WHERE id=$1",
    )
    .bind(job_id)
    .execute(db)
    .await
    .context("claim_recovery_job")?;
    Ok(())
}

/// Mark a job as complete.
pub async fn complete_recovery_job(
    db: &DbPool,
    job_id: Uuid,
    points_recovered: i64,
) -> anyhow::Result<()> {
    sqlx::query(
        "UPDATE opc_history_recovery_jobs \
         SET status='complete', completed_at=now(), points_recovered=$2 WHERE id=$1",
    )
    .bind(job_id)
    .bind(points_recovered)
    .execute(db)
    .await
    .context("complete_recovery_job")?;
    Ok(())
}

/// Mark a job as failed.
pub async fn fail_recovery_job(db: &DbPool, job_id: Uuid, error: &str) -> anyhow::Result<()> {
    sqlx::query(
        "UPDATE opc_history_recovery_jobs \
         SET status='failed', completed_at=now(), error_message=$2 WHERE id=$1",
    )
    .bind(job_id)
    .bind(error)
    .execute(db)
    .await
    .context("fail_recovery_job")?;
    Ok(())
}

/// On startup, reset any jobs that were left in 'running' state (from a crash)
/// back to 'pending'. The job's original to_time is preserved — the startup
/// loop will enqueue a new job covering any gap up to now if needed.
/// Returns the number of jobs reset.
pub async fn reset_interrupted_recovery_jobs(db: &DbPool, source_id: Uuid) -> anyhow::Result<u64> {
    let result = sqlx::query(
        r#"UPDATE opc_history_recovery_jobs
           SET status = 'pending', started_at = NULL
           WHERE source_id = $1 AND status = 'running'"#,
    )
    .bind(source_id)
    .execute(db)
    .await
    .context("reset_interrupted_recovery_jobs")?;
    Ok(result.rows_affected())
}

/// Compress any fully-completed chunks of `points_history_raw` whose range ends
/// at or before `up_to`.  Called after each recovery job completes so disk space
/// is reclaimed incrementally rather than letting uncompressed chunks accumulate.
pub async fn compress_completed_chunks(
    db: &DbPool,
    up_to: chrono::DateTime<chrono::Utc>,
) -> anyhow::Result<u32> {
    let chunks: Vec<(String, String)> = sqlx::query_as(
        r#"SELECT chunk_schema, chunk_name
           FROM timescaledb_information.chunks
           WHERE hypertable_name = 'points_history_raw'
             AND is_compressed = false
             AND range_end <= $1"#,
    )
    .bind(up_to)
    .fetch_all(db)
    .await
    .context("list chunks for compression")?;

    let mut count = 0u32;
    for (schema, name) in &chunks {
        let qualified = format!("{}.{}", schema, name);
        match sqlx::query("SELECT compress_chunk($1::regclass)")
            .bind(&qualified)
            .execute(db)
            .await
        {
            Ok(_) => count += 1,
            Err(e) => {
                tracing::warn!(chunk = %qualified, error = %e, "compress_chunk failed — skipping")
            }
        }
    }
    Ok(count)
}

/// Set `active = false` on any point for `source_id` whose tagname is NOT in
/// `current_tagnames`.  The `handle_point_activation_change` trigger will set
/// `deactivated_at` automatically.  Returns the number of rows deactivated.
pub async fn deactivate_removed_points(
    db: &DbPool,
    source_id: Uuid,
    current_tagnames: &[String],
) -> anyhow::Result<u64> {
    let result = sqlx::query(
        r#"
        UPDATE points_metadata
        SET active = false, updated_at = NOW()
        WHERE source_id = $1
          AND active = true
          AND tagname != ALL($2::text[])
        "#,
    )
    .bind(source_id)
    .bind(current_tagnames)
    .execute(db)
    .await
    .context("deactivate_removed_points: query failed")?;
    Ok(result.rows_affected())
}

/// Bulk-update `minimum_sampling_interval_ms` for a batch of points.
/// Accepts parallel arrays of (point_id, interval_ms) pairs.
pub async fn update_minimum_sampling_intervals(
    db: &DbPool,
    point_ids: &[Uuid],
    intervals_ms: &[f64],
) -> anyhow::Result<()> {
    if point_ids.is_empty() {
        return Ok(());
    }
    sqlx::query(
        r#"
        UPDATE points_metadata pm
        SET minimum_sampling_interval_ms = u.interval_ms,
            updated_at = NOW()
        FROM UNNEST($1::uuid[], $2::float8[]) AS u(id, interval_ms)
        WHERE pm.id = u.id
        "#,
    )
    .bind(point_ids)
    .bind(intervals_ms)
    .execute(db)
    .await
    .context("update_minimum_sampling_intervals: query failed")?;
    Ok(())
}

/// Bulk-update `last_seen_at = NOW()` for the given tagnames under a source.
pub async fn touch_last_seen_at(
    db: &DbPool,
    source_id: Uuid,
    tagnames: &[String],
) -> anyhow::Result<()> {
    if tagnames.is_empty() {
        return Ok(());
    }
    sqlx::query(
        r#"
        UPDATE points_metadata
        SET last_seen_at = NOW(), updated_at = NOW()
        WHERE source_id = $1 AND tagname = ANY($2::text[])
        "#,
    )
    .bind(source_id)
    .bind(tagnames)
    .execute(db)
    .await
    .context("touch_last_seen_at: query failed")?;
    Ok(())
}

/// Returns true if `points_history_raw` contains at least one row older than
/// `min_age` for any point belonging to `source_id`.  Used to gate startup
/// history recovery — if the table has less than an hour of data the system
/// is likely freshly installed and there is nothing useful to recover.
pub async fn has_history_older_than(
    db: &DbPool,
    source_id: Uuid,
    min_age: chrono::Duration,
) -> anyhow::Result<bool> {
    let threshold = chrono::Utc::now() - min_age;
    let exists: bool = sqlx::query_scalar(
        r#"SELECT EXISTS(
             SELECT 1
             FROM points_history_raw phr
             JOIN points_metadata pm ON pm.id = phr.point_id
             WHERE pm.source_id = $1
               AND phr.timestamp < $2
           )"#,
    )
    .bind(source_id)
    .bind(threshold)
    .fetch_one(db)
    .await
    .context("has_history_older_than")?;
    Ok(exists)
}

/// Returns true if there is at least one pending recovery job for this source.
/// Used to avoid creating a duplicate startup job when one is already queued.
pub async fn has_pending_recovery_jobs(db: &DbPool, source_id: Uuid) -> anyhow::Result<bool> {
    let exists: bool = sqlx::query_scalar(
        r#"SELECT EXISTS(
             SELECT 1 FROM opc_history_recovery_jobs
             WHERE source_id = $1 AND status = 'pending'
           )"#,
    )
    .bind(source_id)
    .fetch_one(db)
    .await
    .context("has_pending_recovery_jobs")?;
    Ok(exists)
}

/// Refresh continuous aggregates for a recovered date range.
/// Called after each recovery job completes so historical data becomes visible
/// in the materialized-only aggregate views immediately (the scheduled refresh
/// policies only cover a short recent window and won't reach historical dates).
pub async fn refresh_aggregates_for_range(
    db: &DbPool,
    from_time: chrono::DateTime<chrono::Utc>,
    to_time: chrono::DateTime<chrono::Utc>,
) -> anyhow::Result<()> {
    // Sub-day views: refresh the exact window.
    let sub_day_views = [
        "points_history_1m",
        "points_history_5m",
        "points_history_15m",
        "points_history_1h",
    ];
    for view in &sub_day_views {
        sqlx::query(&format!(
            "CALL refresh_continuous_aggregate('{}', $1, $2)",
            view
        ))
        .bind(from_time)
        .bind(to_time)
        .execute(db)
        .await
        .with_context(|| format!("refresh_continuous_aggregate({})", view))?;
    }

    // 1d view: the bucket size is 1 day, so the refresh window must cover at
    // least one full day.  Align to [floor(from, day), ceil(to, day)].
    let day_from = from_time
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc();
    let to_naive = to_time.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();
    let day_to = if to_time > to_naive {
        to_naive + chrono::Duration::days(1)
    } else {
        to_naive
    };
    sqlx::query("CALL refresh_continuous_aggregate('points_history_1d', $1, $2)")
        .bind(day_from)
        .bind(day_to)
        .execute(db)
        .await
        .context("refresh_continuous_aggregate(points_history_1d)")?;

    Ok(())
}
