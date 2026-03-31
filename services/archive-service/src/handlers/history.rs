use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tracing::warn;
use uuid::Uuid;

use io_error::{IoError, IoResult};
use io_models::ApiResponse;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Service-secret guard
// ---------------------------------------------------------------------------

fn check_service_secret(headers: &HeaderMap, expected: &str) -> IoResult<()> {
    let provided = headers
        .get("x-io-service-secret")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if provided != expected {
        warn!("archive history endpoint called with invalid or missing x-io-service-secret");
        return Err(IoError::Forbidden("Invalid service secret".to_string()));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Query parameter types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    pub start: String,
    pub end: String,
    #[serde(default = "default_resolution")]
    pub resolution: String,
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub agg: Option<String>, // legacy: "avg", "sum", "min", "max", "count"
    /// Explicit bucket size in seconds. When present, takes precedence over
    /// `resolution` and drives which precomputed table + SQL aggregate to use.
    #[serde(default)]
    pub bucket_seconds: Option<i64>,
    /// Aggregate function to apply per bucket. One of: avg, min, max, sum,
    /// count, first, last, median, stddev, range. Defaults to "avg".
    #[serde(default)]
    pub aggregate_function: Option<String>,
}

fn default_resolution() -> String {
    "raw".to_string()
}

fn default_limit() -> i64 {
    10_000
}

/// Pick the best precomputed resolution for a given time span.
/// Callers use this when `resolution == "auto"`.
fn auto_resolution(span_secs: i64) -> &'static str {
    match span_secs {
        s if s <= 7_200 => "raw",   // ≤ 2 h  → raw ticks
        s if s <= 21_600 => "1m",   // ≤ 6 h  → 1-minute buckets
        s if s <= 172_800 => "5m",  // ≤ 48 h → 5-minute buckets
        s if s <= 604_800 => "1h",  // ≤ 7 d  → 1-hour buckets
        _ => "1d",                  // > 7 d  → daily buckets
    }
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct HistoryResponse {
    pub point_id: Uuid,
    pub resolution: String,
    pub start: String,
    pub end: String,
    pub rows: Vec<HistoryRow>,
}

#[derive(Debug, Serialize)]
pub struct HistoryRow {
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quality: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avg: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sum: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct LatestResponse {
    pub point_id: Uuid,
    pub value: Option<f64>,
    pub quality: Option<String>,
    pub timestamp: Option<String>,
}

// ---------------------------------------------------------------------------
// Rolling average query / response
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct RollingQuery {
    pub window: String, // e.g. "5m", "1h", "2d"
}

#[derive(Debug, Serialize)]
pub struct RollingResponse {
    pub point_id: Uuid,
    pub window: String,
    pub rolling_avg: Option<f64>,
    pub rolling_min: Option<f64>,
    pub rolling_max: Option<f64>,
    pub sample_count: i64,
}

/// Parse a window string like "5m", "30m", "2h", "1d" into total seconds.
/// Supported suffixes: m (minutes), h (hours), d (days).
fn parse_window_seconds(window: &str) -> Result<i64, IoError> {
    if window.is_empty() {
        return Err(IoError::BadRequest(
            "window parameter must not be empty".to_string(),
        ));
    }
    let (num_str, suffix) = window.split_at(window.len() - 1);
    let n: i64 = num_str.parse().map_err(|_| {
        IoError::BadRequest(format!(
            "Invalid window '{}'. Expected format: Nm, Nh, or Nd (e.g. 5m, 2h, 1d)",
            window
        ))
    })?;
    if n <= 0 {
        return Err(IoError::BadRequest(
            "window value must be positive".to_string(),
        ));
    }
    match suffix {
        "m" => Ok(n * 60),
        "h" => Ok(n * 3600),
        "d" => Ok(n * 86_400),
        _ => Err(IoError::BadRequest(format!(
            "Invalid window suffix '{}'. Use m, h, or d.",
            suffix
        ))),
    }
}

// ---------------------------------------------------------------------------
// Aggregation type validation
// ---------------------------------------------------------------------------

/// Validate that the requested aggregation type is permitted for the point.
/// Looks up `aggregation_types` from `points_metadata` and checks the bitmask.
/// Bit 0 (value 1): allow averaging; Bit 1 (value 2): allow sum/totaling.
/// `min`, `max`, and `count` are always permitted (no bitmask check).
/// Raw resolution callers must NOT call this (raw bypasses agg type checks).
async fn validate_agg_type(
    db: &sqlx::PgPool,
    point_id: Uuid,
    agg: &Option<String>,
) -> IoResult<()> {
    let Some(ref agg_str) = agg else {
        return Ok(());
    };

    match agg_str.as_str() {
        "min" | "max" | "count" | "first" | "last" | "range" => return Ok(()),
        "avg" | "sum" | "median" | "stddev" => {}
        other => {
            return Err(IoError::BadRequest(format!(
                "Unknown aggregation type '{}'. Valid values: avg, min, max, sum, count, first, last, median, stddev, range",
                other
            )));
        }
    }

    let agg_types: i32 =
        sqlx::query_scalar("SELECT aggregation_types FROM points_metadata WHERE id = $1")
            .bind(point_id)
            .fetch_optional(db)
            .await?
            .unwrap_or(0);

    match agg_str.as_str() {
        "avg" | "median" | "stddev" if (agg_types & 1) == 0 => Err(IoError::BadRequest(format!(
            "This point does not permit '{}' (aggregation_types bit 0 not set)",
            agg_str
        ))),
        "sum" if (agg_types & 2) == 0 => Err(IoError::BadRequest(
            "This point does not permit summing (aggregation_types bit 1 not set)".to_string(),
        )),
        _ => Ok(()),
    }
}

// ---------------------------------------------------------------------------
// Bucket-based query helpers
// ---------------------------------------------------------------------------

struct SourceInfo {
    table: &'static str,
    time_col: &'static str,
    /// Column used as input to the aggregate expression (value for raw, avg for precomputed).
    value_col: &'static str,
    /// Seconds per row in the precomputed table. 0 = raw (variable rate).
    table_bucket_sec: i64,
}

/// Choose the finest precomputed table whose bucket size is ≤ `bucket_seconds`.
/// Falls back to raw for sub-minute requests.
fn pick_source_table(bucket_seconds: i64) -> SourceInfo {
    if bucket_seconds < 60 {
        SourceInfo {
            table: "points_history_raw",
            time_col: "timestamp",
            value_col: "value",
            table_bucket_sec: 0,
        }
    } else if bucket_seconds < 300 {
        SourceInfo {
            table: "points_history_1m",
            time_col: "bucket",
            value_col: "avg",
            table_bucket_sec: 60,
        }
    } else if bucket_seconds < 900 {
        SourceInfo {
            table: "points_history_5m",
            time_col: "bucket",
            value_col: "avg",
            table_bucket_sec: 300,
        }
    } else if bucket_seconds < 3600 {
        SourceInfo {
            table: "points_history_15m",
            time_col: "bucket",
            value_col: "avg",
            table_bucket_sec: 900,
        }
    } else if bucket_seconds < 86400 {
        SourceInfo {
            table: "points_history_1h",
            time_col: "bucket",
            value_col: "avg",
            table_bucket_sec: 3600,
        }
    } else {
        SourceInfo {
            table: "points_history_1d",
            time_col: "bucket",
            value_col: "avg",
            table_bucket_sec: 86400,
        }
    }
}

/// Build the SQL aggregate expression for the compute path (time_bucket query).
/// All identifiers come from `pick_source_table`, never from user input.
fn agg_sql_expr(agg_fn: &str, value_col: &str, time_col: &str, is_raw: bool) -> String {
    match agg_fn {
        "avg" => format!("AVG({}::float8)", value_col),
        "min" => format!("MIN({}::float8)", value_col),
        "max" => format!("MAX({}::float8)", value_col),
        "sum" => format!("SUM({}::float8)", value_col),
        "count" => {
            if is_raw {
                "COUNT(*)::float8".to_string()
            } else {
                "SUM(count)::float8".to_string()
            }
        }
        "first" => format!("first({}::float8, {})", value_col, time_col),
        "last" => format!("last({}::float8, {})", value_col, time_col),
        "stddev" => format!("STDDEV({}::float8)", value_col),
        "median" => format!(
            "percentile_disc(0.5) WITHIN GROUP (ORDER BY {}::float8)",
            value_col
        ),
        "range" => format!("(MAX({}::float8) - MIN({}::float8))", value_col, value_col),
        _ => "NULL::float8".to_string(),
    }
}

/// Query with explicit bucket size and aggregate function.
/// Returns rows with `value` set to the aggregate result.
/// Fast path: exact precomputed table match + avg/min/max/sum/count → direct column read.
/// Compute path: time_bucket() + aggregate expression over source table.
async fn query_with_bucket(
    db: &sqlx::PgPool,
    point_id: Uuid,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    bucket_seconds: i64,
    agg_fn: &str,
    limit: i64,
) -> IoResult<Vec<HistoryRow>> {
    let src = pick_source_table(bucket_seconds);
    let is_raw = src.table_bucket_sec == 0;

    // Fast path: bucket exactly matches precomputed table, agg is a precomputed column.
    let is_precomputed_agg = matches!(agg_fn, "avg" | "min" | "max" | "sum" | "count");
    if !is_raw && src.table_bucket_sec == bucket_seconds && is_precomputed_agg {
        let col = match agg_fn {
            "avg" => "avg",
            "min" => "min",
            "max" => "max",
            "sum" => "sum",
            "count" => "count",
            _ => unreachable!(),
        };
        let sql = format!(
            "SELECT {time_col} AS bucket, {col}::float8 AS value \
             FROM {table} \
             WHERE point_id = $1 AND {time_col} BETWEEN $2 AND $3 \
             ORDER BY {time_col} LIMIT $4",
            time_col = src.time_col,
            col = col,
            table = src.table,
        );
        let rows = sqlx::query(&sql)
            .bind(point_id)
            .bind(start)
            .bind(end)
            .bind(limit)
            .fetch_all(db)
            .await?;
        return Ok(rows
            .into_iter()
            .map(|r| {
                let ts: DateTime<Utc> = r.get("bucket");
                HistoryRow {
                    timestamp: ts.to_rfc3339(),
                    value: r.get("value"),
                    quality: None,
                    avg: None,
                    min: None,
                    max: None,
                    count: None,
                    sum: None,
                }
            })
            .collect());
    }

    // Compute path: time_bucket() + aggregate expression.
    let agg_expr = agg_sql_expr(agg_fn, src.value_col, src.time_col, is_raw);
    let sql = format!(
        "SELECT time_bucket(($5::text || ' seconds')::interval, {time_col}) AS bucket, \
         {agg_expr} AS value \
         FROM {table} \
         WHERE point_id = $1 AND {time_col} BETWEEN $2 AND $3 \
         GROUP BY bucket ORDER BY bucket LIMIT $4",
        time_col = src.time_col,
        agg_expr = agg_expr,
        table = src.table,
    );
    let rows = sqlx::query(&sql)
        .bind(point_id)
        .bind(start)
        .bind(end)
        .bind(limit)
        .bind(bucket_seconds)
        .fetch_all(db)
        .await?;
    Ok(rows
        .into_iter()
        .map(|r| {
            let ts: DateTime<Utc> = r.get("bucket");
            HistoryRow {
                timestamp: ts.to_rfc3339(),
                value: r.get("value"),
                quality: None,
                avg: None,
                min: None,
                max: None,
                count: None,
                sum: None,
            }
        })
        .collect())
}

// ---------------------------------------------------------------------------
// Batch request / response
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct BatchHistoryRequest {
    pub point_ids: Vec<Uuid>,
    pub start: String,
    pub end: String,
    #[serde(default = "default_resolution")]
    pub resolution: String,
    #[serde(default)]
    pub agg: Option<String>, // legacy: "avg", "sum", "min", "max", "count"
    #[serde(default)]
    pub bucket_seconds: Option<i64>,
    #[serde(default)]
    pub aggregate_function: Option<String>,
}

// ---------------------------------------------------------------------------
// GET /history/points/:point_id
// ---------------------------------------------------------------------------

pub async fn get_point_history(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(point_id): Path<Uuid>,
    Query(params): Query<HistoryQuery>,
) -> IoResult<impl IntoResponse> {
    check_service_secret(&headers, &state.config.service_secret)?;

    let start: DateTime<Utc> = params
        .start
        .parse()
        .map_err(|_| IoError::BadRequest("Invalid 'start' timestamp".to_string()))?;
    let end: DateTime<Utc> = params
        .end
        .parse()
        .map_err(|_| IoError::BadRequest("Invalid 'end' timestamp".to_string()))?;

    if start >= end {
        return Err(IoError::BadRequest(
            "'start' must be before 'end'".to_string(),
        ));
    }

    let limit = params.limit.clamp(1, 100_000);

    // --- New path: explicit bucket_seconds + aggregate_function ---
    if let Some(bucket_seconds) = params.bucket_seconds {
        if bucket_seconds < 1 {
            return Err(IoError::BadRequest(
                "bucket_seconds must be >= 1".to_string(),
            ));
        }
        let agg_fn = params.aggregate_function.as_deref().unwrap_or("avg");
        let agg_opt = Some(agg_fn.to_string());
        validate_agg_type(&state.db, point_id, &agg_opt).await?;

        let rows = query_with_bucket(
            &state.db,
            point_id,
            start,
            end,
            bucket_seconds,
            agg_fn,
            limit,
        )
        .await?;

        return Ok(Json(ApiResponse::ok(HistoryResponse {
            point_id,
            resolution: format!("{}s", bucket_seconds),
            start: start.to_rfc3339(),
            end: end.to_rfc3339(),
            rows,
        })));
    }

    // --- Legacy path: resolution param ---
    // Resolve "auto" → best precomputed bucket for this time span.
    let resolution = if params.resolution == "auto" {
        auto_resolution((end - start).num_seconds()).to_string()
    } else {
        params.resolution.clone()
    };

    // Aggregation type validation: only applies to aggregate resolutions, not raw.
    if resolution != "raw" {
        validate_agg_type(&state.db, point_id, &params.agg).await?;
    }

    // When agg is not explicitly specified and resolution is aggregate, look up the
    // point's aggregation_types bitmask once and use it to null out disallowed columns.
    // Bit 0 (value 1): allow avg. Bit 1 (value 2): allow sum.
    // When agg IS explicitly specified it already passed validate_agg_type above, so
    // we expose all columns as before (no masking needed).
    let (allow_avg, allow_sum) = if resolution != "raw" && params.agg.is_none() {
        let agg_types: i32 =
            sqlx::query_scalar("SELECT aggregation_types FROM points_metadata WHERE id = $1")
                .bind(point_id)
                .fetch_optional(&state.db)
                .await?
                .unwrap_or(0);
        ((agg_types & 1) != 0, (agg_types & 2) != 0)
    } else {
        (true, true)
    };

    let rows = match resolution.as_str() {
        "raw" => {
            let raw_rows = sqlx::query(
                "SELECT timestamp, value, quality \
                 FROM points_history_raw \
                 WHERE point_id = $1 AND timestamp BETWEEN $2 AND $3 \
                 ORDER BY timestamp \
                 LIMIT $4",
            )
            .bind(point_id)
            .bind(start)
            .bind(end)
            .bind(limit)
            .fetch_all(&state.db)
            .await?;

            raw_rows
                .into_iter()
                .map(|r| {
                    let ts: DateTime<Utc> = r.get("timestamp");
                    HistoryRow {
                        timestamp: ts.to_rfc3339(),
                        value: r.get("value"),
                        quality: r.get("quality"),
                        avg: None,
                        min: None,
                        max: None,
                        count: None,
                        sum: None,
                    }
                })
                .collect::<Vec<_>>()
        }
        "1m" => {
            let agg_rows = sqlx::query(
                "SELECT bucket AS timestamp, avg, min, max, count, sum \
                 FROM points_history_1m \
                 WHERE point_id = $1 AND bucket BETWEEN $2 AND $3 \
                 ORDER BY bucket \
                 LIMIT $4",
            )
            .bind(point_id)
            .bind(start)
            .bind(end)
            .bind(limit)
            .fetch_all(&state.db)
            .await?;

            agg_rows
                .into_iter()
                .map(|r| {
                    let ts: DateTime<Utc> = r.get("timestamp");
                    HistoryRow {
                        timestamp: ts.to_rfc3339(),
                        value: None,
                        quality: None,
                        avg: if allow_avg { r.get("avg") } else { None },
                        min: r.get("min"),
                        max: r.get("max"),
                        count: r.get("count"),
                        sum: if allow_sum { r.get("sum") } else { None },
                    }
                })
                .collect::<Vec<_>>()
        }
        "5m" => {
            let agg_rows = sqlx::query(
                "SELECT bucket AS timestamp, avg, min, max, count, sum \
                 FROM points_history_5m \
                 WHERE point_id = $1 AND bucket BETWEEN $2 AND $3 \
                 ORDER BY bucket \
                 LIMIT $4",
            )
            .bind(point_id)
            .bind(start)
            .bind(end)
            .bind(limit)
            .fetch_all(&state.db)
            .await?;

            agg_rows
                .into_iter()
                .map(|r| {
                    let ts: DateTime<Utc> = r.get("timestamp");
                    HistoryRow {
                        timestamp: ts.to_rfc3339(),
                        value: None,
                        quality: None,
                        avg: if allow_avg { r.get("avg") } else { None },
                        min: r.get("min"),
                        max: r.get("max"),
                        count: r.get("count"),
                        sum: if allow_sum { r.get("sum") } else { None },
                    }
                })
                .collect::<Vec<_>>()
        }
        "1h" => {
            let agg_rows = sqlx::query(
                "SELECT bucket AS timestamp, avg, min, max, count, sum \
                 FROM points_history_1h \
                 WHERE point_id = $1 AND bucket BETWEEN $2 AND $3 \
                 ORDER BY bucket \
                 LIMIT $4",
            )
            .bind(point_id)
            .bind(start)
            .bind(end)
            .bind(limit)
            .fetch_all(&state.db)
            .await?;

            agg_rows
                .into_iter()
                .map(|r| {
                    let ts: DateTime<Utc> = r.get("timestamp");
                    HistoryRow {
                        timestamp: ts.to_rfc3339(),
                        value: None,
                        quality: None,
                        avg: if allow_avg { r.get("avg") } else { None },
                        min: r.get("min"),
                        max: r.get("max"),
                        count: r.get("count"),
                        sum: if allow_sum { r.get("sum") } else { None },
                    }
                })
                .collect::<Vec<_>>()
        }
        "15m" => {
            let agg_rows = sqlx::query(
                "SELECT bucket AS timestamp, avg, min, max, count, sum \
                 FROM points_history_15m \
                 WHERE point_id = $1 AND bucket BETWEEN $2 AND $3 \
                 ORDER BY bucket \
                 LIMIT $4",
            )
            .bind(point_id)
            .bind(start)
            .bind(end)
            .bind(limit)
            .fetch_all(&state.db)
            .await?;

            agg_rows
                .into_iter()
                .map(|r| {
                    let ts: DateTime<Utc> = r.get("timestamp");
                    HistoryRow {
                        timestamp: ts.to_rfc3339(),
                        value: None,
                        quality: None,
                        avg: if allow_avg { r.get("avg") } else { None },
                        min: r.get("min"),
                        max: r.get("max"),
                        count: r.get("count"),
                        sum: if allow_sum { r.get("sum") } else { None },
                    }
                })
                .collect::<Vec<_>>()
        }
        "1d" => {
            let agg_rows = sqlx::query(
                "SELECT bucket AS timestamp, avg, min, max, count, sum \
                 FROM points_history_1d \
                 WHERE point_id = $1 AND bucket BETWEEN $2 AND $3 \
                 ORDER BY bucket \
                 LIMIT $4",
            )
            .bind(point_id)
            .bind(start)
            .bind(end)
            .bind(limit)
            .fetch_all(&state.db)
            .await?;

            agg_rows
                .into_iter()
                .map(|r| {
                    let ts: DateTime<Utc> = r.get("timestamp");
                    HistoryRow {
                        timestamp: ts.to_rfc3339(),
                        value: None,
                        quality: None,
                        avg: if allow_avg { r.get("avg") } else { None },
                        min: r.get("min"),
                        max: r.get("max"),
                        count: r.get("count"),
                        sum: if allow_sum { r.get("sum") } else { None },
                    }
                })
                .collect::<Vec<_>>()
        }
        other => {
            return Err(IoError::BadRequest(format!(
                "Unknown resolution '{}'. Valid values: auto, raw, 1m, 5m, 15m, 1h, 1d",
                other
            )));
        }
    };

    Ok(Json(ApiResponse::ok(HistoryResponse {
        point_id,
        resolution,
        start: start.to_rfc3339(),
        end: end.to_rfc3339(),
        rows,
    })))
}

// ---------------------------------------------------------------------------
// GET /history/points/:point_id/latest
// ---------------------------------------------------------------------------

pub async fn get_point_latest(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(point_id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    check_service_secret(&headers, &state.config.service_secret)?;

    let row = sqlx::query(
        "SELECT point_id, value, quality, timestamp \
         FROM points_current \
         WHERE point_id = $1",
    )
    .bind(point_id)
    .fetch_optional(&state.db)
    .await?;

    let response = match row {
        Some(r) => {
            let ts: Option<DateTime<Utc>> = r.get("timestamp");
            LatestResponse {
                point_id: r.get("point_id"),
                value: r.get("value"),
                quality: r.get("quality"),
                timestamp: ts.map(|t| t.to_rfc3339()),
            }
        }
        None => {
            return Err(IoError::NotFound(format!(
                "No current value for point {}",
                point_id
            )));
        }
    };

    Ok(Json(ApiResponse::ok(response)))
}

// ---------------------------------------------------------------------------
// POST /history/points/batch
// ---------------------------------------------------------------------------

pub async fn get_batch_history(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<BatchHistoryRequest>,
) -> IoResult<impl IntoResponse> {
    check_service_secret(&headers, &state.config.service_secret)?;

    if body.point_ids.is_empty() {
        return Err(IoError::BadRequest(
            "point_ids must not be empty".to_string(),
        ));
    }

    if body.point_ids.len() > 50 {
        return Err(IoError::BadRequest(
            "Batch requests are limited to 50 points".to_string(),
        ));
    }

    let start: DateTime<Utc> = body
        .start
        .parse()
        .map_err(|_| IoError::BadRequest("Invalid 'start' timestamp".to_string()))?;
    let end: DateTime<Utc> = body
        .end
        .parse()
        .map_err(|_| IoError::BadRequest("Invalid 'end' timestamp".to_string()))?;

    if start >= end {
        return Err(IoError::BadRequest(
            "'start' must be before 'end'".to_string(),
        ));
    }

    let mut results: Vec<HistoryResponse> = Vec::with_capacity(body.point_ids.len());

    for point_id in &body.point_ids {
        // New path: explicit bucket_seconds.
        if let Some(bucket_seconds) = body.bucket_seconds {
            if bucket_seconds < 1 {
                return Err(IoError::BadRequest(
                    "bucket_seconds must be >= 1".to_string(),
                ));
            }
            let agg_fn = body.aggregate_function.as_deref().unwrap_or("avg");
            let agg_opt = Some(agg_fn.to_string());
            validate_agg_type(&state.db, *point_id, &agg_opt).await?;

            let rows = query_with_bucket(
                &state.db,
                *point_id,
                start,
                end,
                bucket_seconds,
                agg_fn,
                10_000,
            )
            .await?;

            results.push(HistoryResponse {
                point_id: *point_id,
                resolution: format!("{}s", bucket_seconds),
                start: start.to_rfc3339(),
                end: end.to_rfc3339(),
                rows,
            });
            continue;
        }

        // Legacy path: resolution param.
        // Resolve "auto" → best precomputed bucket for this time span.
        let resolution = if body.resolution == "auto" {
            auto_resolution((end - start).num_seconds()).to_string()
        } else {
            body.resolution.clone()
        };

        // Aggregation type validation: only applies to aggregate resolutions, not raw.
        if resolution != "raw" {
            validate_agg_type(&state.db, *point_id, &body.agg).await?;
        }

        // When agg is not explicitly specified and resolution is aggregate, look up the
        // point's aggregation_types bitmask once per point and use it to null out
        // disallowed columns in the response.
        let (allow_avg, allow_sum) = if resolution != "raw" && body.agg.is_none() {
            let agg_types: i32 =
                sqlx::query_scalar("SELECT aggregation_types FROM points_metadata WHERE id = $1")
                    .bind(point_id)
                    .fetch_optional(&state.db)
                    .await?
                    .unwrap_or(0);
            ((agg_types & 1) != 0, (agg_types & 2) != 0)
        } else {
            (true, true)
        };

        let rows = match resolution.as_str() {
            "raw" => {
                let raw_rows = sqlx::query(
                    "SELECT timestamp, value, quality \
                     FROM points_history_raw \
                     WHERE point_id = $1 AND timestamp BETWEEN $2 AND $3 \
                     ORDER BY timestamp \
                     LIMIT 10000",
                )
                .bind(point_id)
                .bind(start)
                .bind(end)
                .fetch_all(&state.db)
                .await?;

                raw_rows
                    .into_iter()
                    .map(|r| {
                        let ts: DateTime<Utc> = r.get("timestamp");
                        HistoryRow {
                            timestamp: ts.to_rfc3339(),
                            value: r.get("value"),
                            quality: r.get("quality"),
                            avg: None,
                            min: None,
                            max: None,
                            count: None,
                            sum: None,
                        }
                    })
                    .collect::<Vec<_>>()
            }
            "1m" => {
                let agg_rows = sqlx::query(
                    "SELECT bucket AS timestamp, avg, min, max, count, sum \
                     FROM points_history_1m \
                     WHERE point_id = $1 AND bucket BETWEEN $2 AND $3 \
                     ORDER BY bucket \
                     LIMIT 10000",
                )
                .bind(point_id)
                .bind(start)
                .bind(end)
                .fetch_all(&state.db)
                .await?;

                agg_rows
                    .into_iter()
                    .map(|r| {
                        let ts: DateTime<Utc> = r.get("timestamp");
                        HistoryRow {
                            timestamp: ts.to_rfc3339(),
                            value: None,
                            quality: None,
                            avg: if allow_avg { r.get("avg") } else { None },
                            min: r.get("min"),
                            max: r.get("max"),
                            count: r.get("count"),
                            sum: if allow_sum { r.get("sum") } else { None },
                        }
                    })
                    .collect::<Vec<_>>()
            }
            "5m" => {
                let agg_rows = sqlx::query(
                    "SELECT bucket AS timestamp, avg, min, max, count, sum \
                     FROM points_history_5m \
                     WHERE point_id = $1 AND bucket BETWEEN $2 AND $3 \
                     ORDER BY bucket \
                     LIMIT 10000",
                )
                .bind(point_id)
                .bind(start)
                .bind(end)
                .fetch_all(&state.db)
                .await?;

                agg_rows
                    .into_iter()
                    .map(|r| {
                        let ts: DateTime<Utc> = r.get("timestamp");
                        HistoryRow {
                            timestamp: ts.to_rfc3339(),
                            value: None,
                            quality: None,
                            avg: if allow_avg { r.get("avg") } else { None },
                            min: r.get("min"),
                            max: r.get("max"),
                            count: r.get("count"),
                            sum: if allow_sum { r.get("sum") } else { None },
                        }
                    })
                    .collect::<Vec<_>>()
            }
            "1h" => {
                let agg_rows = sqlx::query(
                    "SELECT bucket AS timestamp, avg, min, max, count, sum \
                     FROM points_history_1h \
                     WHERE point_id = $1 AND bucket BETWEEN $2 AND $3 \
                     ORDER BY bucket \
                     LIMIT 10000",
                )
                .bind(point_id)
                .bind(start)
                .bind(end)
                .fetch_all(&state.db)
                .await?;

                agg_rows
                    .into_iter()
                    .map(|r| {
                        let ts: DateTime<Utc> = r.get("timestamp");
                        HistoryRow {
                            timestamp: ts.to_rfc3339(),
                            value: None,
                            quality: None,
                            avg: if allow_avg { r.get("avg") } else { None },
                            min: r.get("min"),
                            max: r.get("max"),
                            count: r.get("count"),
                            sum: if allow_sum { r.get("sum") } else { None },
                        }
                    })
                    .collect::<Vec<_>>()
            }
            "15m" => {
                let agg_rows = sqlx::query(
                    "SELECT bucket AS timestamp, avg, min, max, count, sum \
                     FROM points_history_15m \
                     WHERE point_id = $1 AND bucket BETWEEN $2 AND $3 \
                     ORDER BY bucket \
                     LIMIT 10000",
                )
                .bind(point_id)
                .bind(start)
                .bind(end)
                .fetch_all(&state.db)
                .await?;

                agg_rows
                    .into_iter()
                    .map(|r| {
                        let ts: DateTime<Utc> = r.get("timestamp");
                        HistoryRow {
                            timestamp: ts.to_rfc3339(),
                            value: None,
                            quality: None,
                            avg: if allow_avg { r.get("avg") } else { None },
                            min: r.get("min"),
                            max: r.get("max"),
                            count: r.get("count"),
                            sum: if allow_sum { r.get("sum") } else { None },
                        }
                    })
                    .collect::<Vec<_>>()
            }
            "1d" => {
                let agg_rows = sqlx::query(
                    "SELECT bucket AS timestamp, avg, min, max, count, sum \
                     FROM points_history_1d \
                     WHERE point_id = $1 AND bucket BETWEEN $2 AND $3 \
                     ORDER BY bucket \
                     LIMIT 10000",
                )
                .bind(point_id)
                .bind(start)
                .bind(end)
                .fetch_all(&state.db)
                .await?;

                agg_rows
                    .into_iter()
                    .map(|r| {
                        let ts: DateTime<Utc> = r.get("timestamp");
                        HistoryRow {
                            timestamp: ts.to_rfc3339(),
                            value: None,
                            quality: None,
                            avg: if allow_avg { r.get("avg") } else { None },
                            min: r.get("min"),
                            max: r.get("max"),
                            count: r.get("count"),
                            sum: if allow_sum { r.get("sum") } else { None },
                        }
                    })
                    .collect::<Vec<_>>()
            }
            other => {
                return Err(IoError::BadRequest(format!(
                    "Unknown resolution '{}'. Valid values: auto, raw, 1m, 5m, 15m, 1h, 1d",
                    other
                )));
            }
        };

        results.push(HistoryResponse {
            point_id: *point_id,
            resolution,
            start: start.to_rfc3339(),
            end: end.to_rfc3339(),
            rows,
        });
    }

    Ok(Json(ApiResponse::ok(results)))
}

// ---------------------------------------------------------------------------
// GET /history/points/:point_id/rolling
// ---------------------------------------------------------------------------

pub async fn get_point_rolling(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(point_id): Path<Uuid>,
    Query(params): Query<RollingQuery>,
) -> IoResult<impl IntoResponse> {
    check_service_secret(&headers, &state.config.service_secret)?;

    let window_secs = parse_window_seconds(&params.window)?;

    // Enforce aggregation_types: rolling average requires averaging to be permitted.
    let agg_types: i32 =
        sqlx::query_scalar("SELECT aggregation_types FROM points_metadata WHERE id = $1")
            .bind(point_id)
            .fetch_optional(&state.db)
            .await?
            .unwrap_or(0);

    if (agg_types & 1) == 0 {
        return Err(IoError::BadRequest(
            "This point does not permit averaging (aggregation_types bit 0 not set)".to_string(),
        ));
    }

    // Select source table based on window size:
    //   < 5 min  (< 300 s)   => points_history_raw   (quality = 'Good')
    //   5min–1h  (300–3600 s) => points_history_1m
    //   1h–1d    (3600–86400 s) => points_history_15m
    //   > 1d     (> 86400 s) => points_history_1h
    let response = if window_secs < 300 {
        // Raw table — filter to Good quality only
        let row = sqlx::query(
            "SELECT \
               AVG(value) AS rolling_avg, \
               MIN(value) AS rolling_min, \
               MAX(value) AS rolling_max, \
               COUNT(*) AS sample_count \
             FROM points_history_raw \
             WHERE point_id = $1 \
               AND quality = 'Good' \
               AND timestamp >= NOW() - ($2 || ' seconds')::interval",
        )
        .bind(point_id)
        .bind(window_secs)
        .fetch_one(&state.db)
        .await?;

        let sample_count: i64 = row.get("sample_count");
        RollingResponse {
            point_id,
            window: params.window,
            rolling_avg: if sample_count > 0 {
                row.get("rolling_avg")
            } else {
                None
            },
            rolling_min: if sample_count > 0 {
                row.get("rolling_min")
            } else {
                None
            },
            rolling_max: if sample_count > 0 {
                row.get("rolling_max")
            } else {
                None
            },
            sample_count,
        }
    } else if window_secs <= 3600 {
        // 1-minute aggregates
        let row = sqlx::query(
            "SELECT \
               AVG(avg) AS rolling_avg, \
               MIN(min) AS rolling_min, \
               MAX(max) AS rolling_max, \
               COALESCE(SUM(count), 0) AS sample_count \
             FROM points_history_1m \
             WHERE point_id = $1 \
               AND bucket >= NOW() - ($2 || ' seconds')::interval",
        )
        .bind(point_id)
        .bind(window_secs)
        .fetch_one(&state.db)
        .await?;

        let sample_count: i64 = row.get("sample_count");
        RollingResponse {
            point_id,
            window: params.window,
            rolling_avg: if sample_count > 0 {
                row.get("rolling_avg")
            } else {
                None
            },
            rolling_min: if sample_count > 0 {
                row.get("rolling_min")
            } else {
                None
            },
            rolling_max: if sample_count > 0 {
                row.get("rolling_max")
            } else {
                None
            },
            sample_count,
        }
    } else if window_secs <= 86_400 {
        // 15-minute aggregates
        let row = sqlx::query(
            "SELECT \
               AVG(avg) AS rolling_avg, \
               MIN(min) AS rolling_min, \
               MAX(max) AS rolling_max, \
               COALESCE(SUM(count), 0) AS sample_count \
             FROM points_history_15m \
             WHERE point_id = $1 \
               AND bucket >= NOW() - ($2 || ' seconds')::interval",
        )
        .bind(point_id)
        .bind(window_secs)
        .fetch_one(&state.db)
        .await?;

        let sample_count: i64 = row.get("sample_count");
        RollingResponse {
            point_id,
            window: params.window,
            rolling_avg: if sample_count > 0 {
                row.get("rolling_avg")
            } else {
                None
            },
            rolling_min: if sample_count > 0 {
                row.get("rolling_min")
            } else {
                None
            },
            rolling_max: if sample_count > 0 {
                row.get("rolling_max")
            } else {
                None
            },
            sample_count,
        }
    } else {
        // 1-hour aggregates (windows > 1 day)
        let row = sqlx::query(
            "SELECT \
               AVG(avg) AS rolling_avg, \
               MIN(min) AS rolling_min, \
               MAX(max) AS rolling_max, \
               COALESCE(SUM(count), 0) AS sample_count \
             FROM points_history_1h \
             WHERE point_id = $1 \
               AND bucket >= NOW() - ($2 || ' seconds')::interval",
        )
        .bind(point_id)
        .bind(window_secs)
        .fetch_one(&state.db)
        .await?;

        let sample_count: i64 = row.get("sample_count");
        RollingResponse {
            point_id,
            window: params.window,
            rolling_avg: if sample_count > 0 {
                row.get("rolling_avg")
            } else {
                None
            },
            rolling_min: if sample_count > 0 {
                row.get("rolling_min")
            } else {
                None
            },
            rolling_max: if sample_count > 0 {
                row.get("rolling_max")
            } else {
                None
            },
            sample_count,
        }
    };

    Ok(Json(ApiResponse::ok(response)))
}
