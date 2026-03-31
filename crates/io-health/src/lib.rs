use async_trait::async_trait;
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Instant,
};
use tracing::warn;

/// Status of an individual health check.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckStatus {
    Ok,
    Timeout,
    Error,
}

/// Result of running one health check.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct HealthStatus {
    pub status: CheckStatus,
    pub latency_ms: u64,
    pub error: Option<String>,
}

/// Trait implemented by anything that can be health-checked.
#[async_trait]
pub trait HealthCheckable: Send + Sync {
    fn name(&self) -> &str;
    async fn check(&self) -> HealthStatus;
    /// If true, a failure marks the service as not_ready rather than degraded.
    fn critical(&self) -> bool {
        true
    }
}

/// Shared state passed into axum handlers.
#[derive(Clone)]
struct HealthState {
    service_name: String,
    version: String,
    started_at: Instant,
    checks: Arc<Vec<Box<dyn HealthCheckable>>>,
    startup_complete: Arc<AtomicBool>,
}

/// Registry that owns all health checks and vends an axum Router.
pub struct HealthRegistry {
    service_name: String,
    version: String,
    started_at: Instant,
    checks: Vec<Box<dyn HealthCheckable>>,
    startup_complete: Arc<AtomicBool>,
}

impl HealthRegistry {
    pub fn new(service_name: &str, version: &str) -> Self {
        Self {
            service_name: service_name.to_string(),
            version: version.to_string(),
            started_at: Instant::now(),
            checks: Vec::new(),
            startup_complete: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn register<C: HealthCheckable + 'static>(&mut self, check: C) {
        self.checks.push(Box::new(check));
    }

    pub fn mark_startup_complete(&self) {
        self.startup_complete.store(true, Ordering::SeqCst);
    }

    /// Consume the registry and produce an axum Router.
    pub fn into_router(self) -> Router {
        let checks: Arc<Vec<Box<dyn HealthCheckable>>> = Arc::new(self.checks);
        let state = HealthState {
            service_name: self.service_name,
            version: self.version,
            started_at: self.started_at,
            checks,
            startup_complete: self.startup_complete,
        };

        Router::new()
            .route("/health/live", get(handle_live))
            .route("/health/ready", get(handle_ready))
            .route("/health/startup", get(handle_startup))
            .with_state(state)
    }
}

/// GET /health/live — always 200
async fn handle_live() -> impl IntoResponse {
    Json(serde_json::json!({ "status": "alive" }))
}

/// GET /health/ready — runs all checks
async fn handle_ready(State(state): State<HealthState>) -> Response {
    let uptime = state.started_at.elapsed().as_secs();
    let mut checks_result: HashMap<String, serde_json::Value> = HashMap::new();
    let mut any_critical_failed = false;
    let mut any_failed = false;

    for check in state.checks.iter() {
        let t0 = Instant::now();
        let result = tokio::time::timeout(std::time::Duration::from_secs(5), check.check())
            .await
            .unwrap_or_else(|_| HealthStatus {
                status: CheckStatus::Timeout,
                latency_ms: 5000,
                error: Some("check timed out".to_string()),
            });

        let elapsed = t0.elapsed().as_millis() as u64;
        let name = check.name().to_string();

        if result.status != CheckStatus::Ok {
            any_failed = true;
            if check.critical() {
                any_critical_failed = true;
            }
            warn!(check = %name, status = ?result.status, "health check failed");
        }

        checks_result.insert(
            name,
            serde_json::json!({
                "status": result.status,
                "latency_ms": elapsed,
                "error": result.error,
            }),
        );
    }

    let overall = if any_critical_failed {
        "not_ready"
    } else if any_failed {
        "degraded"
    } else {
        "ready"
    };

    let status_code = if any_critical_failed {
        StatusCode::SERVICE_UNAVAILABLE
    } else {
        StatusCode::OK
    };

    let body = serde_json::json!({
        "status": overall,
        "service": state.service_name,
        "version": state.version,
        "uptime_seconds": uptime,
        "checks": checks_result,
    });

    (status_code, Json(body)).into_response()
}

/// GET /health/startup — 503 until startup complete
async fn handle_startup(State(state): State<HealthState>) -> Response {
    if state.startup_complete.load(Ordering::SeqCst) {
        (
            StatusCode::OK,
            Json(serde_json::json!({ "status": "started" })),
        )
            .into_response()
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "status": "starting" })),
        )
            .into_response()
    }
}

// ---------------------------------------------------------------------------
// PgDatabaseCheck — pings PostgreSQL with SELECT 1
// ---------------------------------------------------------------------------

/// Health check that pings the PostgreSQL database with `SELECT 1`.
pub struct PgDatabaseCheck {
    pool: sqlx::PgPool,
    name: String,
    critical: bool,
}

impl PgDatabaseCheck {
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self {
            pool,
            name: "database".to_string(),
            critical: true,
        }
    }

    /// Override the default `critical = true` so a failure yields `degraded`
    /// instead of `not_ready`.
    pub fn non_critical(mut self) -> Self {
        self.critical = false;
        self
    }
}

#[async_trait]
impl HealthCheckable for PgDatabaseCheck {
    fn name(&self) -> &str {
        &self.name
    }

    fn critical(&self) -> bool {
        self.critical
    }

    async fn check(&self) -> HealthStatus {
        let start = Instant::now();
        // Use a short internal timeout (2 s) so that serial check stacking
        // does not approach the outer 5 s handler deadline.
        match tokio::time::timeout(
            std::time::Duration::from_secs(2),
            sqlx::query("SELECT 1").execute(&self.pool),
        )
        .await
        {
            Ok(Ok(_)) => HealthStatus {
                status: CheckStatus::Ok,
                latency_ms: start.elapsed().as_millis() as u64,
                error: None,
            },
            Ok(Err(e)) => HealthStatus {
                status: CheckStatus::Error,
                latency_ms: start.elapsed().as_millis() as u64,
                error: Some(e.to_string()),
            },
            Err(_) => HealthStatus {
                status: CheckStatus::Timeout,
                latency_ms: start.elapsed().as_millis() as u64,
                error: Some("database check timed out".to_string()),
            },
        }
    }
}

// ---------------------------------------------------------------------------
// UnixSocketCheck — attempts a connect to a Unix domain socket
// ---------------------------------------------------------------------------

/// Health check that verifies a Unix domain socket path is connectable.
///
/// Non-critical by default — a UDS being unavailable yields `degraded`, not
/// `not_ready`, so that e.g. the data-broker can still accept traffic while
/// the OPC service socket is starting.
pub struct UnixSocketCheck {
    path: String,
    name: String,
    critical: bool,
}

impl UnixSocketCheck {
    pub fn new(path: impl Into<String>) -> Self {
        let path = path.into();
        let name = format!("uds:{}", path);
        Self {
            path,
            name,
            critical: false,
        }
    }

    /// Override the default `critical = false` so a failure yields `not_ready`.
    pub fn non_critical(mut self) -> Self {
        self.critical = false;
        self
    }
}

#[async_trait]
impl HealthCheckable for UnixSocketCheck {
    fn name(&self) -> &str {
        &self.name
    }

    fn critical(&self) -> bool {
        self.critical
    }

    async fn check(&self) -> HealthStatus {
        let start = Instant::now();
        // Use a short internal timeout (1 s) for socket connects.
        match tokio::time::timeout(
            std::time::Duration::from_secs(1),
            tokio::net::UnixStream::connect(&self.path),
        )
        .await
        {
            Ok(Ok(_)) => HealthStatus {
                status: CheckStatus::Ok,
                latency_ms: start.elapsed().as_millis() as u64,
                error: None,
            },
            Ok(Err(e)) => HealthStatus {
                status: CheckStatus::Error,
                latency_ms: start.elapsed().as_millis() as u64,
                error: Some(e.to_string()),
            },
            Err(_) => HealthStatus {
                status: CheckStatus::Timeout,
                latency_ms: start.elapsed().as_millis() as u64,
                error: Some("unix socket check timed out".to_string()),
            },
        }
    }
}

// ---------------------------------------------------------------------------
// RedisCheck — stub (not currently used by any service but fulfils the spec)
// ---------------------------------------------------------------------------

/// Stub health check for Redis. Returns `Ok` unconditionally until a real
/// Redis client dependency is added to the workspace.
pub struct RedisCheck {
    name: String,
    critical: bool,
}

impl RedisCheck {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            critical: false,
        }
    }

    pub fn non_critical(mut self) -> Self {
        self.critical = false;
        self
    }
}

#[async_trait]
impl HealthCheckable for RedisCheck {
    fn name(&self) -> &str {
        &self.name
    }

    fn critical(&self) -> bool {
        self.critical
    }

    async fn check(&self) -> HealthStatus {
        // Stub — always reports Ok. Replace with real PING once Redis is added.
        HealthStatus {
            status: CheckStatus::Ok,
            latency_ms: 0,
            error: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- CheckStatus equality ---

    #[test]
    fn check_status_variants_are_distinguishable() {
        assert_ne!(CheckStatus::Ok, CheckStatus::Error);
        assert_ne!(CheckStatus::Ok, CheckStatus::Timeout);
        assert_ne!(CheckStatus::Timeout, CheckStatus::Error);
    }

    // --- HealthStatus serialization round-trip ---

    #[test]
    fn health_status_ok_serializes_to_snake_case() {
        let status = HealthStatus {
            status: CheckStatus::Ok,
            latency_ms: 5,
            error: None,
        };
        let json = serde_json::to_string(&status).expect("must serialize");
        assert!(
            json.contains("\"ok\""),
            "CheckStatus::Ok must serialize as \"ok\": {json}"
        );
    }

    #[test]
    fn health_status_error_carries_message() {
        let status = HealthStatus {
            status: CheckStatus::Error,
            latency_ms: 100,
            error: Some("connection refused".to_string()),
        };
        let json = serde_json::to_string(&status).expect("must serialize");
        assert!(json.contains("connection refused"));
    }

    #[test]
    fn health_status_timeout_round_trips_through_json() {
        let original = HealthStatus {
            status: CheckStatus::Timeout,
            latency_ms: 5000,
            error: Some("check timed out".to_string()),
        };
        let json = serde_json::to_string(&original).expect("serialise");
        let restored: HealthStatus = serde_json::from_str(&json).expect("deserialise");
        assert_eq!(restored.status, CheckStatus::Timeout);
        assert_eq!(restored.latency_ms, 5000);
    }

    // --- HealthRegistry ---

    #[test]
    fn health_registry_starts_with_startup_incomplete() {
        let reg = HealthRegistry::new("test-service", "0.1.0");
        // startup_complete flag starts as false; mark_startup_complete flips it.
        // We can observe this indirectly via the startup atomic before marking.
        assert_eq!(reg.service_name, "test-service");
        assert_eq!(reg.version, "0.1.0");
        assert!(
            !reg.startup_complete
                .load(std::sync::atomic::Ordering::SeqCst),
            "Startup must not be marked complete before mark_startup_complete() is called"
        );
    }

    #[test]
    fn mark_startup_complete_flips_flag() {
        let reg = HealthRegistry::new("svc", "1.0.0");
        reg.mark_startup_complete();
        assert!(
            reg.startup_complete
                .load(std::sync::atomic::Ordering::SeqCst),
            "mark_startup_complete must set the atomic flag"
        );
    }
}
