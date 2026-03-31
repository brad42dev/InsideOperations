use anyhow::Result;
use chrono::{DateTime, Utc};
use tracing::{debug, warn};
use uuid::Uuid;

use super::{SupplementalEvent, SupplementalMetadata};

/// Write supplemental metadata — only overwrites NULL fields so OPC UA data takes priority.
/// Uses the alarm_limit_* columns added by migration 20260315000046_alarm_limits.
pub async fn write_supplemental_metadata(
    db: &sqlx::PgPool,
    source_id: Uuid,
    items: &[SupplementalMetadata],
) -> Result<()> {
    let mut updated = 0u32;
    for item in items {
        let has_limits = item.alarm_limit_hh.is_some()
            || item.alarm_limit_h.is_some()
            || item.alarm_limit_l.is_some()
            || item.alarm_limit_ll.is_some();

        let result = sqlx::query(
            "UPDATE points_metadata SET \
               description       = COALESCE(description,       $3), \
               engineering_units = COALESCE(engineering_units, $4), \
               min_value         = COALESCE(min_value,         $5), \
               max_value         = COALESCE(max_value,         $6), \
               alarm_limit_hh    = COALESCE(alarm_limit_hh,   $7), \
               alarm_limit_h     = COALESCE(alarm_limit_h,    $8), \
               alarm_limit_l     = COALESCE(alarm_limit_l,    $9), \
               alarm_limit_ll    = COALESCE(alarm_limit_ll,   $10), \
               alarm_limit_source = CASE \
                   WHEN alarm_limit_source IS NULL \
                    AND $11 \
                   THEN 'supplemental' \
                   ELSE alarm_limit_source \
               END, \
               updated_at        = NOW() \
             WHERE tagname = $1 AND source_id = $2",
        )
        .bind(&item.tagname) // $1
        .bind(source_id) // $2
        .bind(&item.description) // $3
        .bind(&item.engineering_units) // $4
        .bind(item.eu_range_low) // $5
        .bind(item.eu_range_high) // $6
        .bind(item.alarm_limit_hh) // $7
        .bind(item.alarm_limit_h) // $8
        .bind(item.alarm_limit_l) // $9
        .bind(item.alarm_limit_ll) // $10
        .bind(has_limits) // $11
        .execute(db)
        .await;

        match result {
            Ok(r) if r.rows_affected() > 0 => updated += 1,
            Ok(_) => {
                debug!(
                    tagname = %item.tagname,
                    %source_id,
                    "supplemental metadata: point not found, skipping"
                );
            }
            Err(e) => warn!(
                tagname = %item.tagname,
                error = %e,
                "supplemental metadata: update failed"
            ),
        }
    }
    debug!(
        "supplemental metadata: updated {updated}/{} points for source {source_id}",
        items.len()
    );

    // NOTIFY point_metadata_changed so the OPC Service can refresh its subscription registry
    if updated > 0 {
        if let Err(e) = sqlx::query("SELECT pg_notify($1, $2)")
            .bind("point_metadata_changed")
            .bind("{}")
            .execute(db)
            .await
        {
            warn!(
                %source_id,
                error = %e,
                "supplemental metadata: failed to emit point_metadata_changed NOTIFY"
            );
        }
    }

    Ok(())
}

/// Write supplemental alarm events to the events hypertable.
/// Deduplication is via metadata->>'external_id' when an external_id is provided.
pub async fn write_supplemental_events(
    db: &sqlx::PgPool,
    source_id: Uuid,
    events: &[SupplementalEvent],
) -> Result<()> {
    let mut inserted = 0u32;
    let mut skipped = 0u32;

    for event in events {
        // Dedup: skip if external_id already present
        if let Some(ext_id) = &event.external_id {
            let exists: bool = sqlx::query_scalar(
                "SELECT EXISTS( \
                     SELECT 1 FROM events \
                     WHERE metadata->>'external_id' = $1 \
                 )",
            )
            .bind(ext_id)
            .fetch_one(db)
            .await
            .unwrap_or(false);

            if exists {
                skipped += 1;
                continue;
            }
        }

        // Build metadata JSON: supplemental fields not present as columns
        let meta = serde_json::json!({
            "source_name":            event.source_name,
            "alarm_type":             event.alarm_type,
            "alarm_state":            event.alarm_state,
            "limit_value":            event.limit_value,
            "actual_value":           event.actual_value,
            "external_id":            event.external_id,
            "supplemental_source_id": source_id.to_string(),
        });

        // Map connector event_type string → DB event_type_enum
        let event_type = match event.event_type.as_str() {
            "operator_action" => "operator_action",
            "system_event" => "system_event",
            "config_change" => "config_change",
            "safety_event" => "safety_event",
            "io_alarm" => "io_alarm",
            _ => "process_alarm",
        };

        let severity = event.severity.unwrap_or(500).clamp(0, 1000) as i16;
        let message = event
            .message
            .clone()
            .unwrap_or_else(|| event.source_name.clone());
        let ts: DateTime<Utc> = event.timestamp;

        let result = sqlx::query(
            "INSERT INTO events \
             (event_type, source, severity, message, timestamp, metadata) \
             VALUES ($1::event_type_enum, 'supplemental'::event_source_enum, $2, $3, $4, $5)",
        )
        .bind(event_type)
        .bind(severity)
        .bind(&message)
        .bind(ts)
        .bind(&meta)
        .execute(db)
        .await;

        match result {
            Ok(_) => inserted += 1,
            Err(e) => warn!(
                source_name = %event.source_name,
                error = %e,
                "supplemental events: insert failed"
            ),
        }
    }
    debug!("supplemental events: inserted={inserted} skipped={skipped} for source {source_id}");
    Ok(())
}
