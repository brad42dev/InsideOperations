use axum::{
    body::Body,
    http::{HeaderMap, HeaderName, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};
use std::str::FromStr;
use tracing::error;

use axum::extract::Request;

use crate::state::AppState;

/// Forward an incoming axum `Request` to `target_url`, adding the service
/// secret header. Returns the upstream response as an axum `Response`.
pub async fn proxy(
    state: &AppState,
    req: Request,
    target_base: &str,
    path_suffix: &str,
) -> Response {
    let method = req.method().clone();
    let uri = req.uri();

    // Build target URL: base + path + query string
    let query = uri.query().map(|q| format!("?{q}")).unwrap_or_default();
    let target_url = format!("{target_base}{path_suffix}{query}");

    // Collect body bytes
    let (parts, body) = req.into_parts();
    let body_bytes = match axum::body::to_bytes(body, 16 * 1024 * 1024).await {
        Ok(b) => b,
        Err(e) => {
            error!(error = %e, "Failed to read request body");
            return (StatusCode::BAD_REQUEST, "Failed to read request body").into_response();
        }
    };

    // Build upstream request
    let mut builder = state.http_client.request(
        reqwest::Method::from_str(method.as_str()).unwrap_or(reqwest::Method::GET),
        &target_url,
    );

    // Forward select headers (skip hop-by-hop)
    for (name, value) in parts.headers.iter() {
        let name_str = name.as_str().to_lowercase();
        if matches!(
            name_str.as_str(),
            "content-type"
                | "accept"
                | "accept-language"
                | "authorization"
                | "cookie"
                | "x-request-id"
                | "x-forwarded-for"
                | "x-real-ip"
                | "user-agent"
                | "x-io-user-id"
                | "x-io-username"
                | "x-io-permissions"
        ) {
            if let Ok(v) = reqwest::header::HeaderValue::from_bytes(value.as_bytes()) {
                builder = builder.header(name.as_str(), v);
            }
        }
    }

    // Add service secret so downstream knows this is from the gateway
    builder = builder.header("x-io-service-secret", &state.config.service_secret);

    // Forward body
    if !body_bytes.is_empty() {
        builder = builder.body(body_bytes);
    }

    // Execute
    let upstream = match builder.send().await {
        Ok(r) => r,
        Err(e) => {
            error!(url = %target_url, error = %e, "Upstream request failed");
            return (
                StatusCode::BAD_GATEWAY,
                axum::Json(serde_json::json!({
                    "success": false,
                    "error": {
                        "code": "SERVICE_UNAVAILABLE",
                        "message": "Upstream service unavailable"
                    }
                })),
            )
                .into_response();
        }
    };

    // Convert reqwest response → axum response
    let status = StatusCode::from_u16(upstream.status().as_u16())
        .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);

    let mut headers = HeaderMap::new();
    for (name, value) in upstream.headers() {
        if let (Ok(n), Ok(v)) = (
            HeaderName::from_str(name.as_str()),
            HeaderValue::from_bytes(value.as_bytes()),
        ) {
            headers.insert(n, v);
        }
    }

    let body_bytes = match upstream.bytes().await {
        Ok(b) => b,
        Err(e) => {
            error!(error = %e, "Failed to read upstream response body");
            return StatusCode::BAD_GATEWAY.into_response();
        }
    };

    let mut response = Response::new(Body::from(body_bytes));
    *response.status_mut() = status;
    *response.headers_mut() = headers;
    response
}
