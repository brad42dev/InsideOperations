//! ETL pipeline execution for import definitions.
//!
//! The pipeline follows: Extract → Map → Transform → Validate → Load
//! Row counts and timing are tracked at each stage and written to `import_runs`.
//! Timing breakdowns are stored in `import_runs.run_metadata` as JSONB because
//! the per-stage duration columns are not yet in the schema.
//! Rows that fail validation are written to `import_errors`.
//! Dry-run mode wraps the full pipeline in a transaction and rolls back.

use anyhow::{anyhow, Result};
use chrono::Utc;
use serde_json::Value as JsonValue;
use sqlx::{PgPool, Row};
use std::time::Instant;
use tracing::{info, warn};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Row batch — the unit of data flowing through the pipeline
// ---------------------------------------------------------------------------

/// A single record extracted from the source.
#[derive(Debug, Clone)]
pub struct SourceRecord {
    pub row_number: i64,
    /// Raw field values keyed by source column name.
    pub fields: std::collections::HashMap<String, JsonValue>,
    /// Original raw text for error reporting.
    pub raw: String,
}

/// A record that passed mapping and may proceed to transform/validate/load.
#[derive(Debug, Clone)]
pub struct MappedRecord {
    pub row_number: i64,
    /// Fields keyed by target column name.
    pub fields: std::collections::HashMap<String, JsonValue>,
    pub raw: String,
}

/// A record that failed at some pipeline stage.
#[derive(Debug)]
pub struct ErrorRecord {
    pub row_number: i64,
    pub error_type: String,
    pub field_name: Option<String>,
    pub error_message: String,
    /// Raw row text (stored in import_errors.raw_value)
    pub raw_value: String,
}

/// Aggregate statistics collected during a run.
#[derive(Debug, Default)]
pub struct RunStats {
    pub rows_extracted: i64,
    pub rows_transformed: i64,
    pub rows_loaded: i64,
    pub rows_skipped: i64,
    pub rows_errored: i64,
    pub extract_duration_ms: i64,
    pub transform_duration_ms: i64,
    pub validate_duration_ms: i64,
    pub load_duration_ms: i64,
    pub total_duration_ms: i64,
    pub errors: Vec<ErrorRecord>,
    /// New watermark computed from this run's extracted records (None if not configured).
    pub new_watermark: Option<JsonValue>,
}

// ---------------------------------------------------------------------------
// Field-mapping helpers
// ---------------------------------------------------------------------------

/// Apply `field_mappings` JSON to a SourceRecord, producing a MappedRecord.
///
/// field_mappings is expected to be an array like:
/// `[{"source": "col_a", "target": "name"}, ...]`
/// or an object `{"col_a": "name"}`.
/// If empty / null, all fields pass through unchanged.
fn apply_field_mappings(record: &SourceRecord, mappings: &JsonValue) -> Result<MappedRecord> {
    let mut out = std::collections::HashMap::new();

    match mappings {
        JsonValue::Array(arr) if !arr.is_empty() => {
            for entry in arr {
                let src = entry
                    .get("source")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default();
                let tgt = entry.get("target").and_then(|v| v.as_str()).unwrap_or(src);
                if let Some(val) = record.fields.get(src) {
                    out.insert(tgt.to_string(), val.clone());
                }
            }
        }
        JsonValue::Object(map) if !map.is_empty() => {
            for (src, tgt_val) in map {
                let tgt = tgt_val.as_str().unwrap_or(src.as_str());
                if let Some(val) = record.fields.get(src.as_str()) {
                    out.insert(tgt.to_string(), val.clone());
                }
            }
        }
        _ => {
            // No mapping — pass all fields through.
            for (k, v) in &record.fields {
                out.insert(k.clone(), v.clone());
            }
        }
    }

    Ok(MappedRecord {
        row_number: record.row_number,
        fields: out,
        raw: record.raw.clone(),
    })
}

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

/// Apply `transforms` JSON array to a MappedRecord in place.
///
/// Supported ops (extensible):
///
/// - `{"op": "set_null_if_empty", "field": "x"}` — sets field to null when empty string.
/// - `{"op": "trim", "field": "x"}` — trims whitespace from string fields.
/// - `{"op": "to_lowercase", "field": "x"}` — lowercases string fields.
/// - `{"op": "to_uppercase", "field": "x"}` — uppercases string fields.
///
/// Unknown ops are logged as warnings but do NOT fail the row.
fn apply_transforms(record: &mut MappedRecord, transforms: &JsonValue) -> Vec<ErrorRecord> {
    let arr = match transforms.as_array() {
        Some(a) => a,
        None => return vec![],
    };

    let mut errors = vec![];

    for step in arr {
        let op = step.get("op").and_then(|v| v.as_str()).unwrap_or_default();
        let field = step
            .get("field")
            .and_then(|v| v.as_str())
            .unwrap_or_default();

        match op {
            "set_null_if_empty" => {
                if let Some(JsonValue::String(s)) = record.fields.get(field) {
                    if s.trim().is_empty() {
                        record.fields.insert(field.to_string(), JsonValue::Null);
                    }
                }
            }
            "trim" => {
                if let Some(JsonValue::String(s)) = record.fields.get(field).cloned() {
                    record
                        .fields
                        .insert(field.to_string(), JsonValue::String(s.trim().to_string()));
                }
            }
            "to_lowercase" => {
                if let Some(JsonValue::String(s)) = record.fields.get(field).cloned() {
                    record
                        .fields
                        .insert(field.to_string(), JsonValue::String(s.to_lowercase()));
                }
            }
            "to_uppercase" => {
                if let Some(JsonValue::String(s)) = record.fields.get(field).cloned() {
                    record
                        .fields
                        .insert(field.to_string(), JsonValue::String(s.to_uppercase()));
                }
            }
            "" | "noop" => {}
            unknown => {
                warn!(
                    op = unknown,
                    row = record.row_number,
                    "unknown transform op; skipping"
                );
                errors.push(ErrorRecord {
                    row_number: record.row_number,
                    error_type: "transform_warning".to_string(),
                    field_name: Some(field.to_string()),
                    error_message: format!("unknown transform op: {unknown}"),
                    raw_value: record.raw.clone(),
                });
            }
        }
    }
    errors
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/// Validate a transformed record.
///
/// Checks that required fields (listed in `source_config.required_fields`)
/// are present and non-null.
fn validate_record(record: &MappedRecord, source_config: &JsonValue) -> Result<(), ErrorRecord> {
    let required: Vec<&str> = source_config
        .get("required_fields")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect())
        .unwrap_or_default();

    for field in required {
        match record.fields.get(field) {
            None | Some(JsonValue::Null) => {
                return Err(ErrorRecord {
                    row_number: record.row_number,
                    error_type: "validation_error".to_string(),
                    field_name: Some(field.to_string()),
                    error_message: format!("required field '{field}' is null or missing"),
                    raw_value: record.raw.clone(),
                });
            }
            _ => {}
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Extractors
// ---------------------------------------------------------------------------

/// Extract records from the configured source.
///
/// The source type is read from `source_config.source_type`.
/// Supported types:
/// - `csv` / `csv_inline` — inline CSV in `source_config.data`
/// - `json_array`          — inline JSON array in `source_config.data`
/// - anything else         — dispatched to an `EtlConnector` via `connection_id`
async fn extract_records(
    db: &PgPool,
    source_config: &JsonValue,
    connection_id: Option<Uuid>,
    master_key: &[u8; 32],
    upload_dir: &str,
    prev_watermark: Option<JsonValue>,
) -> Result<Vec<SourceRecord>> {
    let source_type = source_config
        .get("source_type")
        .and_then(|v| v.as_str())
        .unwrap_or("generic");

    match source_type {
        "csv" | "csv_inline" => extract_csv(source_config),
        "json_array" => extract_json_array(source_config),
        _ => {
            // ETL connector dispatch
            if let Some(conn_id) = connection_id {
                use crate::connectors::etl::{get_etl_connector, EtlConnectorConfig};
                use sqlx::Row as _;

                let row = sqlx::query(
                    "SELECT connection_type, config, auth_type, auth_config \
                     FROM import_connections WHERE id = $1",
                )
                .bind(conn_id)
                .fetch_optional(db)
                .await?;

                let row = match row {
                    Some(r) => r,
                    None => {
                        warn!(connection_id = %conn_id, "connection not found for ETL dispatch");
                        return Ok(vec![]);
                    }
                };

                let connection_type: String = row.try_get("connection_type").unwrap_or_default();
                let config: JsonValue = row
                    .try_get::<JsonValue, _>("config")
                    .unwrap_or(JsonValue::Null);
                let auth_type: String = row.try_get("auth_type").unwrap_or_default();
                let auth_config_raw: JsonValue = row
                    .try_get::<JsonValue, _>("auth_config")
                    .unwrap_or(JsonValue::Null);
                let auth_config =
                    crate::crypto::decrypt_sensitive_fields(&auth_config_raw, master_key);

                if let Some(connector) = get_etl_connector(&connection_type) {
                    let etl_cfg = EtlConnectorConfig {
                        connection_id: conn_id,
                        connection_config: config,
                        auth_type,
                        auth_config,
                        source_config: source_config.clone(),
                        upload_dir: upload_dir.to_string(),
                        watermark_state: prev_watermark,
                    };
                    connector.extract(&etl_cfg).await
                } else {
                    info!(
                        source_type,
                        connection_type,
                        "no ETL connector implementation for type; returning empty"
                    );
                    Ok(vec![])
                }
            } else {
                info!(
                    source_type,
                    "connector-backed source has no connection_id; returning empty"
                );
                Ok(vec![])
            }
        }
    }
}

fn extract_csv(source_config: &JsonValue) -> Result<Vec<SourceRecord>> {
    let raw_data = source_config
        .get("data")
        .and_then(|v| v.as_str())
        .unwrap_or_default();

    if raw_data.is_empty() {
        return Ok(vec![]);
    }

    let delimiter = source_config
        .get("delimiter")
        .and_then(|v| v.as_str())
        .and_then(|s| s.chars().next())
        .unwrap_or(',');

    let mut lines = raw_data.lines();

    let header_line = match lines.next() {
        Some(h) => h,
        None => return Ok(vec![]),
    };
    let headers: Vec<&str> = header_line.split(delimiter).map(|s| s.trim()).collect();

    let mut records = vec![];
    for (idx, line) in lines.enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let values: Vec<&str> = line.split(delimiter).collect();
        let mut fields = std::collections::HashMap::new();
        for (i, header) in headers.iter().enumerate() {
            let val = values.get(i).copied().unwrap_or("").trim();
            if val.is_empty() {
                fields.insert(header.to_string(), JsonValue::Null);
            } else {
                fields.insert(header.to_string(), JsonValue::String(val.to_string()));
            }
        }
        records.push(SourceRecord {
            row_number: (idx + 1) as i64,
            raw: line.to_string(),
            fields,
        });
    }
    Ok(records)
}

fn extract_json_array(source_config: &JsonValue) -> Result<Vec<SourceRecord>> {
    let data = match source_config.get("data") {
        Some(d) => d,
        None => return Ok(vec![]),
    };

    let arr = match data.as_array() {
        Some(a) => a,
        None => {
            return Err(anyhow!(
                "source_config.data must be a JSON array for source_type=json_array"
            ))
        }
    };

    let mut records = vec![];
    for (idx, item) in arr.iter().enumerate() {
        let fields = match item.as_object() {
            Some(map) => map.iter().map(|(k, v)| (k.clone(), v.clone())).collect(),
            None => {
                warn!(row = idx + 1, "json_array row is not an object; skipping");
                continue;
            }
        };
        records.push(SourceRecord {
            row_number: (idx + 1) as i64,
            raw: item.to_string(),
            fields,
        });
    }
    Ok(records)
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/// Bulk-insert (or upsert) loaded records into `custom_import_data`.
///
/// When `source_config.id_field` is set, uses the field value as `source_row_id`
/// and performs an upsert (ON CONFLICT DO UPDATE) for deduplication.
/// Otherwise uses the row number and plain INSERT.
async fn load_records(
    executor: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    def_id: Uuid,
    records: &[MappedRecord],
    source_config: &JsonValue,
) -> Result<i64> {
    let mut loaded: i64 = 0;
    let id_field = source_config
        .get("id_field")
        .and_then(|v| v.as_str());
    let use_upsert = id_field.is_some();

    for record in records {
        let data_json = serde_json::to_value(&record.fields)?;
        let source_row_id = if let Some(field) = id_field {
            record
                .fields
                .get(field)
                .and_then(|v| match v {
                    JsonValue::String(s) => Some(s.clone()),
                    JsonValue::Number(n) => Some(n.to_string()),
                    _ => None,
                })
                .unwrap_or_else(|| record.row_number.to_string())
        } else {
            record.row_number.to_string()
        };

        let result = if use_upsert {
            sqlx::query(
                "INSERT INTO custom_import_data \
                 (import_definition_id, data, source_row_id, imported_at) \
                 VALUES ($1, $2, $3, NOW()) \
                 ON CONFLICT (import_definition_id, source_row_id) \
                 WHERE source_row_id IS NOT NULL \
                 DO UPDATE SET data = EXCLUDED.data, imported_at = NOW()",
            )
            .bind(def_id)
            .bind(data_json)
            .bind(&source_row_id)
            .execute(&mut **executor)
            .await
        } else {
            sqlx::query(
                "INSERT INTO custom_import_data \
                 (import_definition_id, data, source_row_id, imported_at) \
                 VALUES ($1, $2, $3, NOW())",
            )
            .bind(def_id)
            .bind(data_json)
            .bind(&source_row_id)
            .execute(&mut **executor)
            .await
        };

        match result {
            Ok(_) => loaded += 1,
            Err(e) => {
                warn!(
                    def_id = %def_id,
                    row = record.row_number,
                    error = %e,
                    "load error for row"
                );
                return Err(anyhow!("load error on row {}: {e}", record.row_number));
            }
        }
    }
    Ok(loaded)
}

// ---------------------------------------------------------------------------
// Error writer
// ---------------------------------------------------------------------------

async fn write_errors(
    executor: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    run_id: Uuid,
    errors: &[ErrorRecord],
) -> Result<()> {
    for err in errors {
        sqlx::query(
            "INSERT INTO import_errors \
             (import_run_id, row_number, error_type, field_name, error_message, raw_value, created_at) \
             VALUES ($1, $2, $3, $4, $5, $6, NOW())",
        )
        .bind(run_id)
        .bind(err.row_number as i32)
        .bind(&err.error_type)
        .bind(err.field_name.as_deref())
        .bind(&err.error_message)
        .bind(&err.raw_value)
        .execute(&mut **executor)
        .await?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Inner pipeline — runs inside a transaction so dry-run can rollback
// ---------------------------------------------------------------------------

#[allow(clippy::too_many_arguments)]
async fn run_pipeline_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    db: &PgPool,
    run_id: Uuid,
    def_id: Uuid,
    source_config: &JsonValue,
    field_mappings: &JsonValue,
    transforms: &JsonValue,
    _target_table: &str,
    connection_id: Option<Uuid>,
    master_key: &[u8; 32],
    upload_dir: &str,
    prev_watermark: Option<JsonValue>,
) -> Result<RunStats> {
    let mut stats = RunStats::default();
    let total_start = Instant::now();

    // ── EXTRACT ──────────────────────────────────────────────────────────────
    let extract_start = Instant::now();
    let raw_records =
        extract_records(db, source_config, connection_id, master_key, upload_dir, prev_watermark).await?;
    stats.extract_duration_ms = extract_start.elapsed().as_millis() as i64;

    // File-based connectors (SFTP directory, FTP, local_file) append a sentinel record
    // (row_number == 0, fields == {"__io_fp_state__": <json>}) carrying the updated
    // FilePollingState. Strip it here before any mapping/loading; use it as new_watermark.
    let file_poll_state: Option<JsonValue> = raw_records
        .iter()
        .find(|r| r.fields.contains_key("__io_fp_state__"))
        .and_then(|r| r.fields.get("__io_fp_state__"))
        .cloned();
    let source_records: Vec<SourceRecord> = if file_poll_state.is_some() {
        raw_records
            .into_iter()
            .filter(|r| !r.fields.contains_key("__io_fp_state__"))
            .collect()
    } else {
        raw_records
    };

    stats.rows_extracted = source_records.len() as i64;
    info!(run_id = %run_id, extracted = stats.rows_extracted, "extract stage complete");

    // ── COMPUTE NEW WATERMARK ─────────────────────────────────────────────────
    // For file-polling connectors: use the sentinel state from extraction.
    // For DB/REST connectors: compute from the max value of watermark_column.
    stats.new_watermark = file_poll_state.or_else(|| {
        let wm_column = source_config
            .get("watermark_column")
            .and_then(|v| v.as_str());
        if let Some(col) = wm_column {
            let wm_type = source_config
                .get("watermark_type")
                .and_then(|v| v.as_str())
                .unwrap_or("timestamp");
            let mut max_value: Option<String> = None;
            for rec in &source_records {
                let val_str = match rec.fields.get(col) {
                    Some(JsonValue::String(s)) => Some(s.clone()),
                    Some(JsonValue::Number(n)) => Some(n.to_string()),
                    _ => None,
                };
                if let Some(val) = val_str {
                    let should_update = match max_value.as_ref() {
                        None => true,
                        Some(m) if wm_type == "integer" => {
                            val.parse::<i64>().unwrap_or(i64::MIN)
                                > m.parse::<i64>().unwrap_or(i64::MIN)
                        }
                        Some(m) => val > *m,
                    };
                    if should_update {
                        max_value = Some(val);
                    }
                }
            }
            max_value.map(|val| {
                serde_json::json!({
                    "watermark_type": wm_type,
                    "watermark_column": col,
                    "last_value": val,
                    "last_run_completed_at": Utc::now().to_rfc3339(),
                })
            })
        } else {
            None
        }
    });

    // ── MAP + TRANSFORM + VALIDATE ────────────────────────────────────────────
    let transform_start = Instant::now();
    let mut good_records: Vec<MappedRecord> = vec![];
    let mut all_errors: Vec<ErrorRecord> = vec![];

    for rec in &source_records {
        // Map
        let mut mapped = match apply_field_mappings(rec, field_mappings) {
            Ok(m) => m,
            Err(e) => {
                all_errors.push(ErrorRecord {
                    row_number: rec.row_number,
                    error_type: "mapping_error".to_string(),
                    field_name: None,
                    error_message: e.to_string(),
                    raw_value: rec.raw.clone(),
                });
                continue;
            }
        };

        // Transform (non-fatal warnings extend errors but row continues)
        let transform_errors = apply_transforms(&mut mapped, transforms);
        all_errors.extend(transform_errors);

        good_records.push(mapped);
    }

    stats.transform_duration_ms = transform_start.elapsed().as_millis() as i64;
    stats.rows_transformed = good_records.len() as i64;
    info!(
        run_id = %run_id,
        transformed = stats.rows_transformed,
        "transform stage complete"
    );

    // ── VALIDATE ─────────────────────────────────────────────────────────────
    let validate_start = Instant::now();
    let mut valid_records: Vec<MappedRecord> = vec![];

    for rec in good_records {
        match validate_record(&rec, source_config) {
            Ok(()) => valid_records.push(rec),
            Err(err) => {
                all_errors.push(err);
            }
        }
    }

    stats.validate_duration_ms = validate_start.elapsed().as_millis() as i64;
    // rows_errored is the count of fatal errors (validation failures, mapping errors)
    // transform warnings are non-fatal so we count only unique error rows
    let fatal_error_rows: std::collections::HashSet<i64> = all_errors
        .iter()
        .filter(|e| e.error_type != "transform_warning")
        .map(|e| e.row_number)
        .collect();
    stats.rows_errored = fatal_error_rows.len() as i64;

    info!(
        run_id = %run_id,
        valid = valid_records.len(),
        errored = stats.rows_errored,
        "validate stage complete"
    );

    // Write all error records into the transaction
    if !all_errors.is_empty() {
        write_errors(tx, run_id, &all_errors).await?;
        stats.errors = all_errors;
    }

    // ── LOAD ─────────────────────────────────────────────────────────────────
    let load_start = Instant::now();

    let loaded = load_records(tx, def_id, &valid_records, source_config).await?;

    stats.load_duration_ms = load_start.elapsed().as_millis() as i64;
    stats.rows_loaded = loaded;
    let total_valid = valid_records.len() as i64;
    stats.rows_skipped = if total_valid > loaded {
        total_valid - loaded
    } else {
        0
    };

    stats.total_duration_ms = total_start.elapsed().as_millis() as i64;
    info!(
        run_id = %run_id,
        loaded = stats.rows_loaded,
        total_ms = stats.total_duration_ms,
        "load stage complete"
    );

    Ok(stats)
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/// Execute the full ETL pipeline for `run_id` / `def_id`.
///
/// This function is designed to be called from a `tokio::spawn` task.
/// It owns the full lifecycle of an import run:
///   1. Marks run as `running`
///   2. Fetches the import_definitions row
///   3. Executes Extract → Map → Transform → Validate → Load inside a transaction
///   4. If `dry_run`: rolls back the transaction but still records statistics
///   5. Updates `import_runs` with final status, row counts, and timing metadata
pub async fn execute(
    db: &PgPool,
    run_id: Uuid,
    def_id: Uuid,
    dry_run: bool,
    master_key: [u8; 32],
    upload_dir: String,
    schedule_id: Option<Uuid>,
) -> Result<()> {
    // Count this import run being started.
    metrics::counter!("io_import_runs_total").increment(1);

    // ── Mark run as `running` ─────────────────────────────────────────────────
    sqlx::query(
        "UPDATE import_runs SET status = 'running', started_at = COALESCE(started_at, NOW()) \
         WHERE id = $1",
    )
    .bind(run_id)
    .execute(db)
    .await?;

    // ── Heartbeat task for scheduled runs ────────────────────────────────────
    // Writes last_heartbeat_at every 60 s so the scheduler's stale-run detector
    // (running = true AND last_heartbeat_at < NOW() - INTERVAL '5 minutes')
    // does not reclaim this run while it is still executing.
    let heartbeat_handle = if let Some(sched_id) = schedule_id {
        let db_hb = db.clone();
        Some(tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
            loop {
                interval.tick().await;
                let _ = sqlx::query(
                    "UPDATE import_schedules SET last_heartbeat_at = NOW() WHERE id = $1",
                )
                .bind(sched_id)
                .execute(&db_hb)
                .await;
            }
        }))
    } else {
        None
    };

    // NOTIFY import_status — running
    let running_payload = serde_json::json!({
        "run_id": run_id.to_string(),
        "status": "running",
        "definition_id": def_id.to_string(),
    })
    .to_string();
    if let Err(e) = sqlx::query("SELECT pg_notify($1, $2)")
        .bind("import_status")
        .bind(&running_payload)
        .execute(db)
        .await
    {
        warn!(%run_id, error = %e, "failed to emit import_status NOTIFY (running)");
    }

    // ── Fetch import definition ───────────────────────────────────────────────
    let def_row = sqlx::query(
        "SELECT connection_id, source_config, field_mappings, transforms, target_table \
         FROM import_definitions WHERE id = $1",
    )
    .bind(def_id)
    .fetch_optional(db)
    .await?;

    let def_row = match def_row {
        Some(r) => r,
        None => {
            let msg = format!("import_definition {def_id} not found");
            warn!(%run_id, "{}", msg);
            sqlx::query(
                "UPDATE import_runs \
                 SET status = 'failed', completed_at = NOW(), error_message = $2 \
                 WHERE id = $1",
            )
            .bind(run_id)
            .bind(&msg)
            .execute(db)
            .await?;

            // NOTIFY import_status — failed
            let failed_payload = serde_json::json!({
                "run_id": run_id.to_string(),
                "status": "failed",
                "definition_id": def_id.to_string(),
                "error": &msg,
            })
            .to_string();
            let alert_payload = serde_json::json!({
                "run_id": run_id.to_string(),
                "definition_id": def_id.to_string(),
                "error": &msg,
            })
            .to_string();
            if let Err(e) = sqlx::query("SELECT pg_notify($1, $2)")
                .bind("import_status")
                .bind(&failed_payload)
                .execute(db)
                .await
            {
                warn!(%run_id, error = %e, "failed to emit import_status NOTIFY (failed)");
            }
            if let Err(e) = sqlx::query("SELECT pg_notify($1, $2)")
                .bind("import_alert")
                .bind(&alert_payload)
                .execute(db)
                .await
            {
                warn!(%run_id, error = %e, "failed to emit import_alert NOTIFY");
            }

            return Err(anyhow!(msg));
        }
    };

    let connection_id: Option<Uuid> = def_row.try_get("connection_id").ok().flatten();
    let source_config: JsonValue = def_row
        .try_get::<JsonValue, _>("source_config")
        .unwrap_or(JsonValue::Null);
    let field_mappings: JsonValue = def_row
        .try_get::<JsonValue, _>("field_mappings")
        .unwrap_or(JsonValue::Null);
    let transforms: JsonValue = def_row
        .try_get::<JsonValue, _>("transforms")
        .unwrap_or(JsonValue::Null);
    let target_table: String = def_row
        .try_get::<String, _>("target_table")
        .unwrap_or_else(|_| "custom_import_data".to_string());

    // ── Read previous watermark from the latest successful run ───────────────
    let prev_watermark: Option<JsonValue> = sqlx::query_scalar(
        "SELECT watermark_state FROM import_runs \
         WHERE import_definition_id = $1 \
           AND status IN ('completed', 'partial') \
           AND watermark_state IS NOT NULL \
         ORDER BY completed_at DESC \
         LIMIT 1",
    )
    .bind(def_id)
    .fetch_optional(db)
    .await
    .unwrap_or(None)
    .flatten();

    // ── Execute inside a transaction (always — rollback if dry_run) ───────────
    let mut tx = db.begin().await?;

    let stats_result = run_pipeline_in_tx(
        &mut tx,
        db,
        run_id,
        def_id,
        &source_config,
        &field_mappings,
        &transforms,
        &target_table,
        connection_id,
        &master_key,
        &upload_dir,
        prev_watermark,
    )
    .await;

    let stats = match stats_result {
        Ok(s) => {
            if dry_run {
                // Dry run: rollback — nothing persisted, but stats are valid
                tx.rollback().await?;
            } else {
                tx.commit().await?;
                // Write new watermark after successful commit (not in dry-run)
                if let Some(ref wm) = s.new_watermark {
                    if let Err(e) = sqlx::query(
                        "UPDATE import_runs SET watermark_state = $2 WHERE id = $1",
                    )
                    .bind(run_id)
                    .bind(wm)
                    .execute(db)
                    .await
                    {
                        warn!(%run_id, error = %e, "failed to write watermark_state to import_runs");
                    }
                }
            }
            s
        }
        Err(e) => {
            // Pipeline failed: rollback and mark run as failed
            let _ = tx.rollback().await;
            let msg = e.to_string();
            sqlx::query(
                "UPDATE import_runs \
                 SET status = 'failed', completed_at = NOW(), error_message = $2 \
                 WHERE id = $1",
            )
            .bind(run_id)
            .bind(&msg)
            .execute(db)
            .await?;

            // NOTIFY import_status — failed
            let failed_payload = serde_json::json!({
                "run_id": run_id.to_string(),
                "status": "failed",
                "definition_id": def_id.to_string(),
                "error": &msg,
            })
            .to_string();
            let alert_payload = serde_json::json!({
                "run_id": run_id.to_string(),
                "definition_id": def_id.to_string(),
                "error": &msg,
            })
            .to_string();
            if let Err(ne) = sqlx::query("SELECT pg_notify($1, $2)")
                .bind("import_status")
                .bind(&failed_payload)
                .execute(db)
                .await
            {
                warn!(%run_id, error = %ne, "failed to emit import_status NOTIFY (failed)");
            }
            if let Err(ne) = sqlx::query("SELECT pg_notify($1, $2)")
                .bind("import_alert")
                .bind(&alert_payload)
                .execute(db)
                .await
            {
                warn!(%run_id, error = %ne, "failed to emit import_alert NOTIFY");
            }

            return Err(e);
        }
    };

    // ── Determine final status ────────────────────────────────────────────────
    // Schema allows: pending, running, completed, failed, cancelled, partial
    // Use 'partial' when there were row-level errors but some rows succeeded.
    let final_status = if stats.rows_errored > 0 && stats.rows_loaded > 0 {
        "partial"
    } else if stats.rows_errored > 0 {
        "failed"
    } else {
        "completed"
    };

    // ── Build timing metadata JSONB (duration columns not in schema) ──────────
    let timing_meta = serde_json::json!({
        "extract_duration_ms": stats.extract_duration_ms,
        "transform_duration_ms": stats.transform_duration_ms,
        "validate_duration_ms": stats.validate_duration_ms,
        "load_duration_ms": stats.load_duration_ms,
        "total_duration_ms": stats.total_duration_ms,
        "dry_run": dry_run,
    });

    // ── Update import_runs with final counts and timing ───────────────────────
    sqlx::query(
        "UPDATE import_runs SET \
         status = $2, \
         completed_at = NOW(), \
         rows_extracted = $3, \
         rows_transformed = $4, \
         rows_loaded = $5, \
         rows_skipped = $6, \
         rows_errored = $7, \
         run_metadata = $8 \
         WHERE id = $1",
    )
    .bind(run_id)
    .bind(final_status)
    .bind(stats.rows_extracted as i32)
    .bind(stats.rows_transformed as i32)
    .bind(stats.rows_loaded as i32)
    .bind(stats.rows_skipped as i32)
    .bind(stats.rows_errored as i32)
    .bind(timing_meta)
    .execute(db)
    .await?;

    info!(
        run_id = %run_id,
        status = final_status,
        dry_run,
        rows_extracted = stats.rows_extracted,
        rows_loaded = stats.rows_loaded,
        rows_errored = stats.rows_errored,
        total_ms = stats.total_duration_ms,
        "import run complete"
    );

    // ── Abort heartbeat task ──────────────────────────────────────────────────
    if let Some(handle) = heartbeat_handle {
        handle.abort();
    }

    // Emit import metrics.
    if stats.rows_loaded > 0 {
        metrics::counter!("io_import_rows_processed_total").increment(stats.rows_loaded as u64);
    }
    if stats.rows_errored > 0 {
        metrics::counter!("io_import_errors_total").increment(stats.rows_errored as u64);
    }

    // NOTIFY import_status — completed / partial
    // Skip NOTIFY in dry-run mode: no real commit happened so there is nothing to announce.
    if !dry_run {
        let completed_payload = serde_json::json!({
            "run_id": run_id.to_string(),
            "status": final_status,
            "definition_id": def_id.to_string(),
            "rows_extracted": stats.rows_extracted,
            "rows_loaded": stats.rows_loaded,
            "rows_errored": stats.rows_errored,
            "total_duration_ms": stats.total_duration_ms,
        })
        .to_string();
        if let Err(e) = sqlx::query("SELECT pg_notify($1, $2)")
            .bind("import_status")
            .bind(&completed_payload)
            .execute(db)
            .await
        {
            warn!(%run_id, error = %e, "failed to emit import_status NOTIFY (completed)");
        }

        // If the run had errors (partial or all-failed), also emit import_alert
        if stats.rows_errored > 0 {
            let alert_payload = serde_json::json!({
                "run_id": run_id.to_string(),
                "definition_id": def_id.to_string(),
                "status": final_status,
                "rows_errored": stats.rows_errored,
            })
            .to_string();
            if let Err(e) = sqlx::query("SELECT pg_notify($1, $2)")
                .bind("import_alert")
                .bind(&alert_payload)
                .execute(db)
                .await
            {
                warn!(%run_id, error = %e, "failed to emit import_alert NOTIFY");
            }
        }
    }

    Ok(())
}
