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
    pub quality: String,          // "good", "uncertain", "bad"
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
        let config: serde_json::Value = r.try_get("connection_config")
            .context("load_sources: missing connection_config")?;

        let str_field = |key: &str, default: &str| -> String {
            config.get(key)
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .unwrap_or(default)
                .to_string()
        };
        let opt_str_field = |key: &str| -> Option<String> {
            config.get(key)
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
    metadata: serde_json::Value,
) -> anyhow::Result<Uuid> {
    let row = sqlx::query(
        r#"SELECT upsert_point_from_source($1, $2, NULL, NULL, 'Double', NULL, NULL, $3) AS point_id"#,
    )
    .bind(source_id)
    .bind(tagname)
    .bind(metadata)
    .fetch_one(db)
    .await
    .context("upsert_point_from_source: query failed")?;

    use sqlx::Row;
    let point_id: Uuid = row
        .try_get("point_id")
        .context("upsert_point_from_source: missing point_id")?;

    Ok(point_id)
}

/// Metadata harvested from OPC UA Part 8 AnalogItemType optional properties.
/// All fields are optional — only populated when the server exposes them.
#[derive(Debug, Clone, Default)]
pub struct AnalogMetadata {
    pub description: Option<String>,         // DataItemType.Definition
    pub engineering_units: Option<String>,   // AnalogItemType.EngineeringUnits displayName
    pub eu_range_low: Option<f64>,           // AnalogItemType.EURange.low
    pub eu_range_high: Option<f64>,          // AnalogItemType.EURange.high
    pub alarm_limit_hh: Option<f64>,         // AnalogItemType.HighHighLimit
    pub alarm_limit_h: Option<f64>,          // AnalogItemType.HighLimit
    pub alarm_limit_l: Option<f64>,          // AnalogItemType.LowLimit
    pub alarm_limit_ll: Option<f64>,         // AnalogItemType.LowLowLimit
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
    pub event_id: Option<String>,    // hex-encoded EventId bytes
    pub event_type: Option<String>,  // NodeId string of EventType
    pub source_name: Option<String>, // SourceName field
    pub timestamp: DateTime<Utc>,    // Time field
    pub severity: Option<u16>,       // Severity field (1–1000)
    pub message: Option<String>,     // Message.text field
    pub condition_name: Option<String>,
    pub acked: bool,   // AckedState/Id
    pub active: bool,  // ActiveState/Id
    pub retain: bool,
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

        // Build metadata JSONB with OPC-specific fields.
        let metadata = serde_json::json!({
            "source_id": ev.source_id,
            "external_id": ev.event_id,
            "source_ref": ev.source_name,
            "condition_name": ev.condition_name,
            "event_type": ev.event_type,
            "alarm_state": alarm_state,
            "acked": ev.acked,
            "active": ev.active,
            "retain": ev.retain,
        });

        let message = ev.message.as_deref().unwrap_or("(no message)");

        sqlx::query(
            r#"
            INSERT INTO events (
                event_type,
                source,
                severity,
                point_id,
                message,
                timestamp,
                source_timestamp,
                metadata
            ) VALUES (
                'process_alarm',
                'opc',
                $1,
                NULL,
                $2,
                $3,
                $3,
                $4
            )
            "#,
        )
        .bind(severity)
        .bind(message)
        .bind(ev.timestamp)
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
pub struct RecoveryJob {
    pub id: Uuid,
    pub source_id: Uuid,
    pub from_time: DateTime<Utc>,
    pub to_time: DateTime<Utc>,
}

/// Returns the latest timestamp stored in `points_history_raw` for points belonging
/// to the given source.  Used to compute the auto-recovery window on startup.
pub async fn get_last_history_timestamp(
    db: &DbPool,
    source_id: Uuid,
) -> anyhow::Result<Option<DateTime<Utc>>> {
    let ts = sqlx::query_scalar::<_, Option<DateTime<Utc>>>(
        r#"SELECT MAX(ph.time)
           FROM points_history_raw ph
           JOIN points_metadata pm ON pm.id = ph.point_id
           WHERE pm.source_id = $1"#,
    )
    .bind(source_id)
    .fetch_one(db)
    .await
    .context("get_last_history_timestamp")?;
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
