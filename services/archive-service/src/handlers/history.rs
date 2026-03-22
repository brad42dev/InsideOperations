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
}

fn default_resolution() -> String {
    "raw".to_string()
}

fn default_limit() -> i64 {
    10_000
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
}

#[derive(Debug, Serialize)]
pub struct LatestResponse {
    pub point_id: Uuid,
    pub value: Option<f64>,
    pub quality: Option<String>,
    pub timestamp: Option<String>,
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
}

#[derive(Debug, Serialize)]
pub struct BatchHistoryResponse {
    pub points: Vec<HistoryResponse>,
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

    let rows = match params.resolution.as_str() {
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
                    }
                })
                .collect::<Vec<_>>()
        }
        "1m" => {
            let agg_rows = sqlx::query(
                "SELECT bucket AS timestamp, avg, min, max, count \
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
                        avg: r.get("avg"),
                        min: r.get("min"),
                        max: r.get("max"),
                        count: r.get("count"),
                    }
                })
                .collect::<Vec<_>>()
        }
        "5m" => {
            let agg_rows = sqlx::query(
                "SELECT bucket AS timestamp, avg, min, max, count \
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
                        avg: r.get("avg"),
                        min: r.get("min"),
                        max: r.get("max"),
                        count: r.get("count"),
                    }
                })
                .collect::<Vec<_>>()
        }
        "1h" => {
            let agg_rows = sqlx::query(
                "SELECT bucket AS timestamp, avg, min, max, count \
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
                        avg: r.get("avg"),
                        min: r.get("min"),
                        max: r.get("max"),
                        count: r.get("count"),
                    }
                })
                .collect::<Vec<_>>()
        }
        "15m" => {
            let agg_rows = sqlx::query(
                "SELECT bucket AS timestamp, avg, min, max, count \
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
                        avg: r.get("avg"),
                        min: r.get("min"),
                        max: r.get("max"),
                        count: r.get("count"),
                    }
                })
                .collect::<Vec<_>>()
        }
        "1d" => {
            let agg_rows = sqlx::query(
                "SELECT bucket AS timestamp, avg, min, max, count \
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
                        avg: r.get("avg"),
                        min: r.get("min"),
                        max: r.get("max"),
                        count: r.get("count"),
                    }
                })
                .collect::<Vec<_>>()
        }
        other => {
            return Err(IoError::BadRequest(format!(
                "Unknown resolution '{}'. Valid values: raw, 1m, 5m, 15m, 1h, 1d",
                other
            )));
        }
    };

    Ok(Json(ApiResponse::ok(HistoryResponse {
        point_id,
        resolution: params.resolution,
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
        let rows = match body.resolution.as_str() {
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
                        }
                    })
                    .collect::<Vec<_>>()
            }
            "1m" => {
                let agg_rows = sqlx::query(
                    "SELECT bucket AS timestamp, avg, min, max, count \
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
                            avg: r.get("avg"),
                            min: r.get("min"),
                            max: r.get("max"),
                            count: r.get("count"),
                        }
                    })
                    .collect::<Vec<_>>()
            }
            "5m" => {
                let agg_rows = sqlx::query(
                    "SELECT bucket AS timestamp, avg, min, max, count \
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
                            avg: r.get("avg"),
                            min: r.get("min"),
                            max: r.get("max"),
                            count: r.get("count"),
                        }
                    })
                    .collect::<Vec<_>>()
            }
            "1h" => {
                let agg_rows = sqlx::query(
                    "SELECT bucket AS timestamp, avg, min, max, count \
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
                            avg: r.get("avg"),
                            min: r.get("min"),
                            max: r.get("max"),
                            count: r.get("count"),
                        }
                    })
                    .collect::<Vec<_>>()
            }
            "15m" => {
                let agg_rows = sqlx::query(
                    "SELECT bucket AS timestamp, avg, min, max, count \
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
                            avg: r.get("avg"),
                            min: r.get("min"),
                            max: r.get("max"),
                            count: r.get("count"),
                        }
                    })
                    .collect::<Vec<_>>()
            }
            "1d" => {
                let agg_rows = sqlx::query(
                    "SELECT bucket AS timestamp, avg, min, max, count \
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
                            avg: r.get("avg"),
                            min: r.get("min"),
                            max: r.get("max"),
                            count: r.get("count"),
                        }
                    })
                    .collect::<Vec<_>>()
            }
            other => {
                return Err(IoError::BadRequest(format!(
                    "Unknown resolution '{}'. Valid values: raw, 1m, 5m, 15m, 1h, 1d",
                    other
                )));
            }
        };

        results.push(HistoryResponse {
            point_id: *point_id,
            resolution: body.resolution.clone(),
            start: start.to_rfc3339(),
            end: end.to_rfc3339(),
            rows,
        });
    }

    Ok(Json(ApiResponse::ok(BatchHistoryResponse {
        points: results,
    })))
}
