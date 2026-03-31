use axum::{extract::State, response::IntoResponse, Extension, Json};
use io_auth::Claims;
use io_error::IoError;
use io_models::ApiResponse;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::Row;
use uuid::Uuid;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct UserPreferences {
    pub user_id: Uuid,
    pub preferences: JsonValue,
}

#[derive(Debug, Deserialize)]
pub struct PatchPreferencesBody {
    /// Partial preferences object — merged into existing preferences via jsonb ||
    pub preferences: JsonValue,
}

// ---------------------------------------------------------------------------
// GET /api/user/preferences — get user preferences
// ---------------------------------------------------------------------------

pub async fn get_preferences(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let row = sqlx::query(
        r#"
        SELECT preferences
        FROM user_preferences
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await;

    let prefs = match row {
        Ok(Some(r)) => r
            .try_get::<JsonValue, _>("preferences")
            .unwrap_or_else(|_| JsonValue::Object(Default::default())),
        Ok(None) => JsonValue::Object(Default::default()),
        Err(e) => {
            tracing::error!(error = %e, "get_preferences query failed");
            return IoError::Database(e).into_response();
        }
    };

    Json(ApiResponse::ok(UserPreferences {
        user_id,
        preferences: prefs,
    }))
    .into_response()
}

// ---------------------------------------------------------------------------
// PATCH /api/user/preferences — merge-update user preferences
// ---------------------------------------------------------------------------

pub async fn patch_preferences(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<PatchPreferencesBody>,
) -> impl IntoResponse {
    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let row = sqlx::query(
        r#"
        INSERT INTO user_preferences (user_id, preferences)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE
            SET preferences = user_preferences.preferences || $2,
                updated_at  = now()
        RETURNING preferences
        "#,
    )
    .bind(user_id)
    .bind(&body.preferences)
    .fetch_one(&state.db)
    .await;

    let prefs = match row {
        Ok(r) => r
            .try_get::<JsonValue, _>("preferences")
            .unwrap_or(body.preferences),
        Err(e) => {
            tracing::error!(error = %e, "patch_preferences upsert failed");
            return IoError::Database(e).into_response();
        }
    };

    Json(ApiResponse::ok(UserPreferences {
        user_id,
        preferences: prefs,
    }))
    .into_response()
}
