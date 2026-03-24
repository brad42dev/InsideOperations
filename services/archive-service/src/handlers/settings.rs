use axum::{
    extract::State,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use io_error::{IoError, IoResult};
use io_models::ApiResponse;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Response / request types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ArchiveSettingsPayload {
    /// Raw point history retention in days.
    pub retention_raw_days: i64,
    /// 1-minute aggregate retention in days.
    pub retention_1m_days: i64,
    /// 5-minute aggregate retention in days.
    pub retention_5m_days: i64,
    /// 15-minute aggregate retention in days.
    pub retention_15m_days: i64,
    /// 1-hour aggregate retention in days.
    pub retention_1h_days: i64,
    /// 1-day aggregate retention in days.
    pub retention_1d_days: i64,
    /// Compress chunks older than this many days.
    pub compression_after_days: i64,
    /// Maintenance run interval in seconds.
    pub maintenance_interval_secs: u64,
}

// ---------------------------------------------------------------------------
// GET /settings — return current archive configuration
// ---------------------------------------------------------------------------

pub async fn get_settings(
    State(state): State<AppState>,
) -> IoResult<Json<ApiResponse<ArchiveSettingsPayload>>> {
    let cfg = &state.config;

    // Start with env-based defaults.
    let mut payload = ArchiveSettingsPayload {
        retention_raw_days: cfg.retention_raw_days,
        retention_1m_days: cfg.retention_1m_days,
        retention_5m_days: cfg.retention_5m_days,
        retention_15m_days: cfg.retention_15m_days,
        retention_1h_days: cfg.retention_1h_days,
        retention_1d_days: cfg.retention_1d_days,
        compression_after_days: cfg.compression_after_days,
        maintenance_interval_secs: cfg.maintenance_interval_secs,
    };

    // Try to read overrides persisted to the system_settings table.
    // Use non-macro sqlx::query_as to avoid requiring DATABASE_URL at compile time.
    let rows: Result<Vec<(String, JsonValue)>, _> = sqlx::query_as::<_, (String, JsonValue)>(
        "SELECT key, value FROM system_settings WHERE key LIKE 'archive.%'",
    )
    .fetch_all(&state.db)
    .await;

    if let Ok(rows) = rows {
        for (key, value) in rows {
            let as_i64 = value
                .as_str()
                .and_then(|s| s.parse::<i64>().ok())
                .or_else(|| value.as_i64());
            if let Some(val) = as_i64 {
                match key.as_str() {
                    "archive.retention_raw_days" => payload.retention_raw_days = val,
                    "archive.retention_1m_days" => payload.retention_1m_days = val,
                    "archive.retention_5m_days" => payload.retention_5m_days = val,
                    "archive.retention_15m_days" => payload.retention_15m_days = val,
                    "archive.retention_1h_days" => payload.retention_1h_days = val,
                    "archive.retention_1d_days" => payload.retention_1d_days = val,
                    "archive.compression_after_days" => payload.compression_after_days = val,
                    "archive.maintenance_interval_secs" if val > 0 => {
                        payload.maintenance_interval_secs = val as u64;
                    }
                    _ => {}
                }
            }
        }
    }

    Ok(Json(ApiResponse::ok(payload)))
}

// ---------------------------------------------------------------------------
// PUT /settings — persist archive configuration to system_settings table
// ---------------------------------------------------------------------------

pub async fn put_settings(
    State(state): State<AppState>,
    Json(body): Json<ArchiveSettingsPayload>,
) -> IoResult<Json<ApiResponse<ArchiveSettingsPayload>>> {
    // Validate retention bounds: 1 to 36500 days (100 years max).
    let i64_fields: &[(&str, i64)] = &[
        ("retention_raw_days", body.retention_raw_days),
        ("retention_1m_days", body.retention_1m_days),
        ("retention_5m_days", body.retention_5m_days),
        ("retention_15m_days", body.retention_15m_days),
        ("retention_1h_days", body.retention_1h_days),
        ("retention_1d_days", body.retention_1d_days),
        ("compression_after_days", body.compression_after_days),
    ];
    for (name, val) in i64_fields {
        if *val < 1 || *val > 36_500 {
            return Err(IoError::field(*name, "must be between 1 and 36500".to_string()));
        }
    }
    if body.maintenance_interval_secs < 60 || body.maintenance_interval_secs > 86_400 {
        return Err(IoError::field(
            "maintenance_interval_secs",
            "must be between 60 and 86400",
        ));
    }

    // Upsert each setting into system_settings.
    let entries: &[(&str, i64)] = &[
        ("archive.retention_raw_days", body.retention_raw_days),
        ("archive.retention_1m_days", body.retention_1m_days),
        ("archive.retention_5m_days", body.retention_5m_days),
        ("archive.retention_15m_days", body.retention_15m_days),
        ("archive.retention_1h_days", body.retention_1h_days),
        ("archive.retention_1d_days", body.retention_1d_days),
        ("archive.compression_after_days", body.compression_after_days),
        (
            "archive.maintenance_interval_secs",
            body.maintenance_interval_secs as i64,
        ),
    ];

    for (key, value) in entries {
        let json_val = JsonValue::String(value.to_string());
        let description = format!("Archive service setting: {key}");
        sqlx::query(
            r#"
            INSERT INTO system_settings (key, value, description, is_public, requires_restart)
            VALUES ($1, $2, $3, false, false)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            "#,
        )
        .bind(key)
        .bind(&json_val)
        .bind(&description)
        .execute(&state.db)
        .await
        .map_err(|e| IoError::Internal(e.to_string()))?;
    }

    Ok(Json(ApiResponse::ok(body)))
}
