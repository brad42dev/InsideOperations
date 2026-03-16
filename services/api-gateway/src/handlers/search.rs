use axum::{
    extract::{Query, State},
    response::IntoResponse,
    Json,
};
use io_auth::Claims;
use io_error::IoError;
use io_models::ApiResponse;
use serde::{Deserialize, Serialize};

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct SearchParams {
    /// Search query string (min 2, max 200 chars)
    pub q: Option<String>,
    /// Comma-separated result types to include
    pub types: Option<String>,
    /// Maximum number of results to return (default 20, max 50)
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    pub id: String,
    #[serde(rename = "type")]
    pub result_type: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub href: String,
}

#[derive(Debug, Serialize)]
pub struct SearchData {
    pub results: Vec<SearchResult>,
    pub total: usize,
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

pub async fn search_handler(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
    Query(params): Query<SearchParams>,
) -> impl IntoResponse {
    // --- Validate query string ---
    let q = match params.q {
        Some(ref s) if s.trim().len() >= 2 => s.trim().to_string(),
        Some(_) => {
            return IoError::BadRequest("Query must be at least 2 characters".into())
                .into_response()
        }
        None => {
            return IoError::BadRequest("Query parameter 'q' is required".into()).into_response()
        }
    };

    if q.len() > 200 {
        return IoError::BadRequest("Query must be at most 200 characters".into()).into_response();
    }

    // --- Limit ---
    let limit = params.limit.unwrap_or(20).clamp(1, 50) as i64;

    // --- Determine enabled types ---
    let requested_types: Option<Vec<String>> = params.types.as_deref().map(|t| {
        t.split(',')
            .map(|s| s.trim().to_string())
            .collect()
    });

    let type_enabled = |name: &str| -> bool {
        requested_types
            .as_ref()
            .map(|types| types.iter().any(|t| t == name))
            .unwrap_or(true)
    };

    // --- Permission check ---
    let has_users_read = claims.permissions.contains(&"users:read".to_string())
        || claims.permissions.contains(&"*".to_string());

    let db = &state.db;
    let pattern = format!("%{}%", q);

    let mut results: Vec<SearchResult> = Vec::new();

    // --- 1. Points ---
    if type_enabled("point") {
        match sqlx::query(
            r#"
            SELECT
                id::text AS id,
                tagname AS name,
                description
            FROM points_metadata
            WHERE active = true
              AND (tagname ILIKE $1 OR description ILIKE $1)
            LIMIT $2
            "#,
        )
        .bind(&pattern)
        .bind(limit)
        .fetch_all(db)
        .await
        {
            Ok(rows) => {
                use sqlx::Row;
                for row in rows {
                    let id: String = row.try_get("id").unwrap_or_default();
                    let name: String = row.try_get("name").unwrap_or_default();
                    let description: Option<String> = row.try_get("description").ok().flatten();
                    let href = format!("/forensics?point={}", id);
                    results.push(SearchResult {
                        id,
                        result_type: "point".to_string(),
                        name,
                        description,
                        href,
                    });
                }
            }
            Err(e) => {
                tracing::warn!(error = %e, "points search failed");
            }
        }
    }

    // --- 2. Equipment ---
    if type_enabled("equipment") {
        match sqlx::query(
            r#"
            SELECT
                id::text AS id,
                name,
                tag_number,
                description
            FROM equipment
            WHERE name ILIKE $1 OR tag_number ILIKE $1 OR description ILIKE $1
            LIMIT $2
            "#,
        )
        .bind(&pattern)
        .bind(limit)
        .fetch_all(db)
        .await
        {
            Ok(rows) => {
                use sqlx::Row;
                for row in rows {
                    let id: String = row.try_get("id").unwrap_or_default();
                    let name: String = row.try_get("name").unwrap_or_default();
                    let tag_number: Option<String> = row.try_get("tag_number").ok().flatten();
                    let description: Option<String> = row.try_get("description").ok().flatten();
                    let display_name = match tag_number {
                        Some(tag) => format!("{} — {}", tag, name),
                        None => name,
                    };
                    let href = format!("/process?equipment={}", id);
                    results.push(SearchResult {
                        id,
                        result_type: "equipment".to_string(),
                        name: display_name,
                        description,
                        href,
                    });
                }
            }
            Err(e) => {
                tracing::warn!(error = %e, "equipment search failed");
            }
        }
    }

    // --- 3. Users — requires users:read ---
    if type_enabled("user") && has_users_read {
        match sqlx::query(
            r#"
            SELECT
                id::text AS id,
                username,
                full_name,
                email
            FROM users
            WHERE username ILIKE $1 OR full_name ILIKE $1 OR email ILIKE $1
            LIMIT $2
            "#,
        )
        .bind(&pattern)
        .bind(limit)
        .fetch_all(db)
        .await
        {
            Ok(rows) => {
                use sqlx::Row;
                for row in rows {
                    let id: String = row.try_get("id").unwrap_or_default();
                    let username: String = row.try_get("username").unwrap_or_default();
                    let full_name: Option<String> = row.try_get("full_name").ok().flatten();
                    let email: Option<String> = row.try_get("email").ok().flatten();
                    let display_name = full_name.unwrap_or(username);
                    results.push(SearchResult {
                        id,
                        result_type: "user".to_string(),
                        name: display_name,
                        description: email,
                        href: "/settings/users".to_string(),
                    });
                }
            }
            Err(e) => {
                tracing::warn!(error = %e, "users search failed");
            }
        }
    }

    // --- 4. Roles — requires users:read ---
    if type_enabled("role") && has_users_read {
        match sqlx::query(
            r#"
            SELECT
                id::text AS id,
                name,
                description
            FROM roles
            WHERE name ILIKE $1 OR description ILIKE $1
            LIMIT $2
            "#,
        )
        .bind(&pattern)
        .bind(limit)
        .fetch_all(db)
        .await
        {
            Ok(rows) => {
                use sqlx::Row;
                for row in rows {
                    let id: String = row.try_get("id").unwrap_or_default();
                    let name: String = row.try_get("name").unwrap_or_default();
                    let description: Option<String> = row.try_get("description").ok().flatten();
                    results.push(SearchResult {
                        id,
                        result_type: "role".to_string(),
                        name,
                        description,
                        href: "/settings/roles".to_string(),
                    });
                }
            }
            Err(e) => {
                tracing::warn!(error = %e, "roles search failed");
            }
        }
    }

    // --- Sort: exact name match first, then contains, then alphabetical ---
    let q_lower = q.to_lowercase();
    results.sort_by(|a, b| {
        let a_exact = a.name.to_lowercase() == q_lower;
        let b_exact = b.name.to_lowercase() == q_lower;
        match (a_exact, b_exact) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });

    // --- Truncate to limit ---
    results.truncate(limit as usize);

    let total = results.len();
    let data = SearchData { results, total };

    Json(ApiResponse::ok(data)).into_response()
}
