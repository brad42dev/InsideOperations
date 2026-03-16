use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use serde_json::json;
use thiserror::Error;

// ---------------------------------------------------------------------------
// Error wire format (doc 37 §2)
// ---------------------------------------------------------------------------

/// Field-level validation error detail.
#[derive(Debug, Clone, Serialize)]
pub struct FieldError {
    pub field: String,
    pub message: String,
}

impl FieldError {
    pub fn new(field: impl Into<String>, message: impl Into<String>) -> Self {
        Self { field: field.into(), message: message.into() }
    }
}

// ---------------------------------------------------------------------------
// Application error type
// ---------------------------------------------------------------------------

#[derive(Debug, Error)]
pub enum IoError {
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("not found: {0}")]
    NotFound(String),

    #[error("unauthorized")]
    Unauthorized,

    #[error("forbidden: {0}")]
    Forbidden(String),

    #[error("validation failed")]
    Validation(Vec<FieldError>),

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("conflict: {0}")]
    Conflict(String),

    #[error("gone: {0}")]
    Gone(String),

    #[error("rate limited")]
    RateLimited { retry_after_secs: u64 },

    #[error("internal error: {0}")]
    Internal(String),

    #[error("service unavailable: {0}")]
    ServiceUnavailable(String),
}

impl IoError {
    /// Convenience: single-field validation error.
    pub fn field(field: impl Into<String>, msg: impl Into<String>) -> Self {
        IoError::Validation(vec![FieldError::new(field, msg)])
    }
}

impl IntoResponse for IoError {
    fn into_response(self) -> Response {
        let (status, code, message, details, retry_after) = match &self {
            IoError::Database(e) => {
                tracing::error!(error = %e, "database error");
                (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
                 "A database error occurred".to_string(), None, None)
            }
            IoError::NotFound(msg) => {
                (StatusCode::NOT_FOUND, "NOT_FOUND", msg.clone(), None, None)
            }
            IoError::Unauthorized => (
                StatusCode::UNAUTHORIZED, "UNAUTHORIZED",
                "Authentication required".to_string(), None, None,
            ),
            IoError::Forbidden(msg) => {
                (StatusCode::FORBIDDEN, "FORBIDDEN", msg.clone(), None, None)
            }
            IoError::Validation(fields) => {
                let details: Vec<serde_json::Value> = fields
                    .iter()
                    .map(|f| json!({ "field": f.field, "message": f.message }))
                    .collect();
                (StatusCode::BAD_REQUEST, "VALIDATION_ERROR",
                 "Validation failed".to_string(), Some(details), None)
            }
            IoError::BadRequest(msg) => {
                (StatusCode::BAD_REQUEST, "VALIDATION_ERROR", msg.clone(), None, None)
            }
            IoError::Conflict(msg) => {
                (StatusCode::CONFLICT, "CONFLICT", msg.clone(), None, None)
            }
            IoError::Gone(msg) => {
                (StatusCode::GONE, "GONE", msg.clone(), None, None)
            }
            IoError::RateLimited { retry_after_secs } => (
                StatusCode::TOO_MANY_REQUESTS, "RATE_LIMITED",
                format!("Too many requests. Retry after {} seconds.", retry_after_secs),
                None, Some(*retry_after_secs),
            ),
            IoError::Internal(msg) => {
                tracing::error!(error = %msg, "internal error");
                (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", msg.clone(), None, None)
            }
            IoError::ServiceUnavailable(msg) => (
                StatusCode::SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE", msg.clone(), None, None,
            ),
        };

        let mut body = json!({
            "success": false,
            "error": {
                "code": code,
                "message": message,
            }
        });

        if let Some(d) = details {
            body["error"]["details"] = serde_json::Value::Array(d);
        }

        let mut resp = (status, Json(body)).into_response();

        if let Some(secs) = retry_after {
            resp.headers_mut().insert(
                "retry-after",
                secs.to_string().parse().unwrap(),
            );
        }

        resp
    }
}

pub type IoResult<T> = Result<T, IoError>;

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use axum::response::IntoResponse;

    fn status_of(e: IoError) -> StatusCode {
        e.into_response().status()
    }

    // ------------------------------------------------------------------
    // Status codes
    // ------------------------------------------------------------------

    #[test]
    fn not_found_error_yields_404() {
        assert_eq!(status_of(IoError::NotFound("thing".into())), StatusCode::NOT_FOUND);
    }

    #[test]
    fn unauthorized_error_yields_401() {
        assert_eq!(status_of(IoError::Unauthorized), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn forbidden_error_yields_403() {
        assert_eq!(status_of(IoError::Forbidden("no".into())), StatusCode::FORBIDDEN);
    }

    #[test]
    fn bad_request_error_yields_400() {
        assert_eq!(status_of(IoError::BadRequest("bad".into())), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn validation_error_yields_400() {
        let e = IoError::field("name", "too short");
        assert_eq!(status_of(e), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn internal_error_yields_500() {
        assert_eq!(status_of(IoError::Internal("oops".into())), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[test]
    fn rate_limited_yields_429() {
        assert_eq!(
            status_of(IoError::RateLimited { retry_after_secs: 60 }),
            StatusCode::TOO_MANY_REQUESTS,
        );
    }

    #[test]
    fn conflict_yields_409() {
        assert_eq!(status_of(IoError::Conflict("dup".into())), StatusCode::CONFLICT);
    }

    #[test]
    fn service_unavailable_yields_503() {
        assert_eq!(
            status_of(IoError::ServiceUnavailable("down".into())),
            StatusCode::SERVICE_UNAVAILABLE,
        );
    }

    // ------------------------------------------------------------------
    // From<sqlx::Error>
    // ------------------------------------------------------------------

    #[test]
    fn sqlx_row_not_found_maps_to_database_variant() {
        // sqlx::Error does not have a public RecordNotFound constructor.
        // The From impl wraps any sqlx::Error as IoError::Database.
        // We verify the conversion compiles and produces the Database variant.
        let sqlx_err = sqlx::Error::RowNotFound;
        let io_err = IoError::from(sqlx_err);
        // RowNotFound → IoError::Database (which then serialises to 500)
        assert_eq!(status_of(io_err), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[test]
    fn sqlx_decode_error_maps_to_database_variant() {
        let sqlx_err = sqlx::Error::ColumnNotFound("col".into());
        let io_err = IoError::from(sqlx_err);
        assert_eq!(status_of(io_err), StatusCode::INTERNAL_SERVER_ERROR);
    }

    // ------------------------------------------------------------------
    // retry-after header on RateLimited
    // ------------------------------------------------------------------

    #[test]
    fn rate_limited_response_includes_retry_after_header() {
        let resp = IoError::RateLimited { retry_after_secs: 30 }.into_response();
        let header_val = resp.headers().get("retry-after").expect("retry-after header must be present");
        assert_eq!(header_val, "30");
    }
}
