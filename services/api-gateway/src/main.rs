use axum::{
    extract::{Request, State},
    middleware,
    response::{IntoResponse, Response},
    routing::{any, delete, get, post, put},
    Extension, Json, Router,
};
use io_auth::Claims;
use std::{net::SocketAddr, sync::Arc};
use tower_http::catch_panic::CatchPanicLayer;
use axum::http::{header, Method};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::request_id::{MakeRequestUuid, SetRequestIdLayer};
use tower_http::timeout::TimeoutLayer;
use tracing::info;

mod badge;
mod broker;
mod config;
mod correlation;
mod file_scan;
mod handlers;
mod metrics_collector;
mod mw;
mod proxy;
mod report_generator;
mod seed_shapes;
mod state;
mod tiles;
mod tls;

use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let obs = io_observability::init(io_observability::ObservabilityConfig {
        service_name: "api-gateway",
        service_version: env!("CARGO_PKG_VERSION"),
        log_level: "info",
        metrics_enabled: true,
        tracing_enabled: false,
    })?;

    let cfg = config::Config::from_env()?;
    let port = cfg.port;

    // Ensure the export directory exists (used for generated report files)
    std::fs::create_dir_all(&cfg.export_dir)
        .map_err(|e| anyhow::anyhow!("Failed to create export_dir {}: {}", cfg.export_dir, e))?;
    info!(export_dir = %cfg.export_dir, "Export directory ready");

    // Ensure the tile storage directory exists
    std::fs::create_dir_all(&cfg.tile_storage_dir)
        .map_err(|e| anyhow::anyhow!("Failed to create tile_storage_dir {}: {}", cfg.tile_storage_dir, e))?;
    info!(tile_storage_dir = %cfg.tile_storage_dir, "Tile storage directory ready");

    // Ensure the backup directory exists
    std::fs::create_dir_all(&cfg.backup_dir)
        .map_err(|e| anyhow::anyhow!("Failed to create backup_dir {}: {}", cfg.backup_dir, e))?;
    info!(backup_dir = %cfg.backup_dir, "Backup directory ready");

    // Ensure the certificate directory exists
    std::fs::create_dir_all(&cfg.cert_dir)
        .map_err(|e| anyhow::anyhow!("Failed to create cert_dir {}: {}", cfg.cert_dir, e))?;
    info!(cert_dir = %cfg.cert_dir, "Certificate directory ready");

    // Auto-generate a self-signed certificate if no active cert exists yet.
    // This ensures HTTPS works immediately after a fresh install without manual setup.
    if let Err(e) = tls::ensure_active_cert(&cfg.cert_dir).await {
        tracing::warn!(error = %e, "Failed to auto-generate self-signed certificate — continuing without it");
    }

    // Initialise database pool for direct gateway queries (e.g. global search)
    let db = io_db::create_pool(&cfg.database_url).await?;

    // Emit DB pool metrics every 15s.
    io_db::spawn_pool_metrics(db.clone(), "api-gateway");

    // Seed built-in shape library (idempotent — skips existing entries)
    seed_shapes::seed_shape_library(&db).await;

    // Spawn badge polling engine (polls access_control_sources for badge events)
    {
        let badge_http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to build badge poller HTTP client");
        let badge_broker_url = cfg.broker_url.clone();
        let badge_secret = cfg.service_secret.clone();
        tokio::spawn(badge::poller::run_badge_poller(
            db.clone(),
            badge_http,
            badge_broker_url,
            badge_secret,
        ));
    }

    // Spawn hourly export-file cleanup task (deletes files older than EXPORT_RETENTION_HOURS)
    {
        let cleanup_db = db.clone();
        let cleanup_export_dir = cfg.export_dir.clone();
        tokio::spawn(handlers::exports::run_export_cleanup_task(
            cleanup_db,
            cleanup_export_dir,
        ));
    }

    // Spawn metrics collector background task (polls all service /metrics every IO_METRICS_INTERVAL).
    // Disabled when IO_METRICS_COLLECTOR_ENABLED is explicitly set to "false" or "0".
    let metrics_enabled = std::env::var("IO_METRICS_COLLECTOR_ENABLED")
        .map(|v| !matches!(v.to_lowercase().trim(), "false" | "0"))
        .unwrap_or(true);
    if metrics_enabled {
        let metrics_db = db.clone();
        // Build a dedicated HTTP client for the metrics collector with a short timeout.
        let metrics_http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to build metrics HTTP client");
        tokio::spawn(metrics_collector::run(metrics_db, metrics_http));
        info!("Metrics collector spawned");
    } else {
        info!("Metrics collector disabled (IO_METRICS_COLLECTOR_ENABLED=false)");
    }

    let cors_origins = cfg.cors_allowed_origins.clone();
    let state = AppState::new(cfg, db);

    let mut health = io_health::HealthRegistry::new("api-gateway", env!("CARGO_PKG_VERSION"));
    health.register(io_health::PgDatabaseCheck::new(state.db.clone()));
    health.mark_startup_complete();
    obs.start_watchdog_keepalive();

    // CORS: restrict to explicitly configured origins; log a warning but allow all only in
    // environments where CORS_ALLOWED_ORIGINS is absent (e.g. development behind nginx).
    // In production, always set CORS_ALLOWED_ORIGINS to the exact frontend hostname.
    let cors = {
        let allowed_methods = vec![
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ];
        let allowed_headers = vec![
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            header::ACCEPT,
            header::ORIGIN,
        ];
        if let Some(origins) = &cors_origins {
            let parsed: Vec<axum::http::HeaderValue> = origins
                .iter()
                .filter_map(|o| o.parse().ok())
                .collect();
            CorsLayer::new()
                .allow_origin(AllowOrigin::list(parsed))
                .allow_methods(allowed_methods)
                .allow_headers(allowed_headers)
                .allow_credentials(true)
        } else {
            tracing::warn!(
                "CORS_ALLOWED_ORIGINS not set — allowing all origins. \
                 Set this env var in production."
            );
            CorsLayer::permissive()
        }
    };

    // API router: all routes that use AppState. Apply middleware then call
    // with_state() to produce a Router<()> that can be merged with health/metrics.
    let api: Router = Router::new()
        // Global search — handled directly in the gateway
        .route("/api/search", get(handlers::search::search_handler))
        // Auth flow (public routes — JWT validation is skipped for these in mw.rs)
        .route("/api/auth/providers", get(proxy_auth))
        .route("/api/auth/login", post(proxy_auth))
        .route("/api/auth/refresh", post(proxy_auth))
        .route("/api/auth/logout", post(proxy_auth))
        // Session lock / lock-screen unlock (JWT-protected — not in is_public_path)
        .route("/api/auth/lock", post(proxy_auth))
        .route("/api/auth/verify-password", post(proxy_auth))
        // PIN management — set/update and delete (JWT-protected)
        .route("/api/auth/pin", post(proxy_auth).delete(proxy_auth))
        // PIN verify — lock-screen unlock via PIN (JWT-protected)
        .route("/api/auth/verify-pin", post(proxy_auth))
        .route("/api/auth/eula/current", get(proxy_auth))
        .route("/api/auth/eula/pending", get(proxy_auth))
        .route("/api/auth/eula/accept", post(proxy_auth))
        .route("/api/auth/eula/status", get(proxy_auth))
        .route("/api/auth/ws-ticket", post(proxy_auth))
        .route("/api/auth/me", get(proxy_auth))
        // OIDC / LDAP SSO (public — no JWT required; whitelisted in mw::is_public_path)
        .route("/api/auth/oidc/:config_id/login", post(proxy_auth))
        .route("/api/auth/oidc/callback", get(proxy_auth))
        .route("/api/auth/ldap/:config_id/login", post(proxy_auth))
        // SAML 2.0 SP flow (public — no JWT required; whitelisted in mw::is_public_path via /api/auth/saml/)
        // NOTE: static routes (/metadata, /acs) must be before parameterised (/:config_id/login)
        .route("/api/auth/saml/metadata", get(proxy_auth))
        .route("/api/auth/saml/acs", post(proxy_auth))
        .route("/api/auth/saml/:config_id/login", post(proxy_auth))
        // User management
        .route("/api/users", get(proxy_auth).post(proxy_auth))
        .route("/api/users/:id", get(proxy_auth).put(proxy_auth).delete(proxy_auth))
        // Role / permission management
        .route("/api/roles", get(proxy_auth).post(proxy_auth))
        .route("/api/roles/:id", get(proxy_auth).put(proxy_auth).delete(proxy_auth))
        .route("/api/permissions", get(proxy_auth))
        // Group management (RBAC groups — proxied to auth-service)
        // NOTE: static sub-paths (/members) must be before parameterised /:id
        .route("/api/groups", get(proxy_auth).post(proxy_auth))
        .route("/api/groups/:id", get(proxy_auth).put(proxy_auth).delete(proxy_auth))
        .route("/api/groups/:id/members", get(proxy_auth).post(proxy_auth))
        .route("/api/groups/:id/members/:user_id", delete(proxy_auth))
        // Settings
        .route("/api/settings", get(proxy_auth))
        .route("/api/settings/:key", put(proxy_auth))
        // Point sources (OPC UA / Modbus / MQTT data source management)
        // IMPORTANT: static /sources path must come before parameterised /:id routes
        .route(
            "/api/points/sources",
            get(handlers::points::list_sources).post(handlers::points::create_source),
        )
        .route(
            "/api/points/sources/:id",
            get(handlers::points::get_source)
                .put(handlers::points::update_source)
                .delete(handlers::points::delete_source),
        )
        // OPC UA source stats — static path MUST be before parameterised /:id routes
        .route(
            "/api/opc/sources/stats",
            get(handlers::points::list_source_stats),
        )
        .route(
            "/api/opc/sources/:id/stats",
            get(handlers::points::get_source_stats),
        )
        // OPC UA source reconnect
        .route(
            "/api/opc/sources/:id/reconnect",
            post(handlers::points::reconnect_source),
        )
        // OPC UA history recovery
        .route(
            "/api/opc/sources/:id/history-recovery",
            post(handlers::points::create_history_recovery_job),
        )
        .route(
            "/api/opc/sources/:id/history-recovery/jobs",
            get(handlers::points::list_history_recovery_jobs),
        )
        // OPC UA server certificate trust management
        .route(
            "/api/opc/server-certs",
            get(handlers::opc_certs::list_server_certs),
        )
        .route(
            "/api/opc/server-certs/:id",
            get(handlers::opc_certs::get_server_cert)
                .delete(handlers::opc_certs::delete_server_cert),
        )
        .route(
            "/api/opc/server-certs/:id/trust",
            post(handlers::opc_certs::trust_server_cert),
        )
        .route(
            "/api/opc/server-certs/:id/reject",
            post(handlers::opc_certs::reject_server_cert),
        )
        // Graphics
        .route(
            "/api/graphics",
            get(handlers::graphics::list_graphics).post(handlers::graphics::create_graphic),
        )
        // Static graphic routes MUST be before parameterised /:id routes
        .route(
            "/api/graphics/import",
            post(handlers::iographic::import_graphic),
        )
        .route(
            "/api/graphics/hierarchy",
            get(handlers::graphics::list_graphics_hierarchy),
        )
        .route(
            "/api/graphics/images/:hash",
            get(handlers::graphics::get_image_asset),
        )
        .route(
            "/api/graphics/:id",
            get(handlers::graphics::get_graphic)
                .put(handlers::graphics::update_graphic)
                .delete(handlers::graphics::delete_graphic),
        )
        .route(
            "/api/v1/design-objects/:id/export/iographic",
            post(handlers::iographic::export_graphic),
        )
        .route(
            "/api/graphics/:id/tile-info",
            get(handlers::graphics::get_tile_info),
        )
        .route(
            "/api/graphics/:id/points",
            get(handlers::graphics::get_graphic_points),
        )
        // Batch shape / stencil loaders
        .route("/api/v1/shapes/batch", post(handlers::graphics::batch_shapes))
        .route("/api/v1/stencils/batch", post(handlers::graphics::batch_stencils))
        // User (custom) shape management — static sub-paths before /:id
        .route(
            "/api/v1/shapes/user",
            get(handlers::graphics::list_user_shapes)
                .post(handlers::graphics::upload_user_shape),
        )
        .route(
            "/api/v1/shapes/user/:id",
            delete(handlers::graphics::delete_user_shape),
        )
        // iographic analyze + commit — static paths MUST be before parameterised /:id routes
        .route(
            "/api/v1/design-objects/import/iographic/analyze",
            post(handlers::iographic::analyze_iographic),
        )
        .route(
            "/api/v1/design-objects/import/iographic",
            post(handlers::iographic::commit_iographic),
        )
        // Design objects (shapes / stencils)
        // NOTE: routes registered under both /api/design-objects (legacy) and
        //       /api/v1/design-objects (doc-21 canonical) so that the frontend
        //       /v1/ prefix works without breaking any existing callers.
        .route(
            "/api/design-objects",
            get(handlers::graphics::list_design_objects)
                .post(handlers::graphics::create_design_object),
        )
        .route(
            "/api/design-objects/:id",
            get(handlers::graphics::get_design_object)
                .delete(handlers::graphics::delete_design_object),
        )
        .route(
            "/api/v1/design-objects",
            get(handlers::graphics::list_design_objects)
                .post(handlers::graphics::create_design_object),
        )
        // Static sub-paths MUST come before parameterised /:id routes
        .route(
            "/api/v1/design-objects/:id/thumbnail.png",
            get(handlers::graphics::get_thumbnail),
        )
        .route(
            "/api/v1/design-objects/:id/tiles/:z/:x/:y",
            get(handlers::graphics::get_tile),
        )
        // Image assets (content-addressed binary uploads from Designer Image Tool)
        .route(
            "/api/v1/image-assets",
            post(handlers::graphics::upload_image_asset),
        )
        .route(
            "/api/v1/image-assets/:hash",
            get(handlers::graphics::get_image_asset_v1),
        )
        .route(
            "/api/v1/design-objects/:id",
            get(handlers::graphics::get_design_object)
                .put(handlers::graphics::update_graphic)
                .delete(handlers::graphics::delete_design_object),
        )
        // Console workspaces
        .route(
            "/api/console/workspaces",
            get(handlers::console::list_workspaces)
                .post(handlers::console::create_workspace),
        )
        .route(
            "/api/console/workspaces/:id",
            get(handlers::console::get_workspace)
                .put(handlers::console::update_workspace)
                .delete(handlers::console::delete_workspace),
        )
        .route(
            "/api/console/workspaces/:id/publish",
            post(handlers::console::publish_workspace),
        )
        .route(
            "/api/console/workspaces/:id/share",
            post(handlers::console::share_workspace),
        )
        .route(
            "/api/console/workspaces/:id/duplicate",
            post(handlers::console::duplicate_workspace),
        )
        // Bookmarks
        .route(
            "/api/bookmarks",
            get(handlers::bookmarks::list_bookmarks)
                .post(handlers::bookmarks::add_bookmark),
        )
        .route(
            "/api/bookmarks/:id",
            delete(handlers::bookmarks::remove_bookmark),
        )
        // Dashboards — static routes MUST come before parameterised /:id routes
        .route(
            "/api/dashboards/playlists",
            get(handlers::dashboards::list_playlists)
                .post(handlers::dashboards::create_playlist),
        )
        .route(
            "/api/dashboards/playlists/:id",
            get(handlers::dashboards::get_playlist)
                .put(handlers::dashboards::update_playlist)
                .delete(handlers::dashboards::delete_playlist),
        )
        .route(
            "/api/dashboards",
            get(handlers::dashboards::list_dashboards)
                .post(handlers::dashboards::create_dashboard),
        )
        .route(
            "/api/dashboards/:id",
            get(handlers::dashboards::get_dashboard)
                .put(handlers::dashboards::update_dashboard)
                .delete(handlers::dashboards::delete_dashboard),
        )
        .route(
            "/api/dashboards/:id/duplicate",
            post(handlers::dashboards::duplicate_dashboard),
        )
        .route(
            "/api/dashboards/:id/export/iographic",
            post(handlers::dashboards::export_dashboard_iographic),
        )
        // MFA (proxied to auth-service)
        .route("/api/auth/mfa/enroll", post(proxy_auth))
        .route("/api/auth/mfa/verify", post(proxy_auth))
        .route("/api/auth/mfa/status", get(proxy_auth))
        .route("/api/auth/mfa/challenge", post(proxy_auth))
        .route("/api/auth/mfa/recover", post(proxy_auth))
        .route("/api/auth/mfa/totp", delete(proxy_auth))
        // API key management (proxied to auth-service)
        .route("/api/api-keys", get(proxy_auth).post(proxy_auth))
        .route("/api/api-keys/:id", delete(proxy_auth))
        // Auth provider admin (proxied to auth-service — requires system:configure)
        // NOTE: static /auth/admin/providers before parameterised /:id variants
        .route("/api/auth/admin/providers", get(proxy_auth).post(proxy_auth))
        .route("/api/auth/admin/providers/:id", get(proxy_auth).put(proxy_auth).delete(proxy_auth))
        .route("/api/auth/admin/providers/:id/mappings", get(proxy_auth).post(proxy_auth))
        .route("/api/auth/admin/providers/:id/mappings/:mapping_id", delete(proxy_auth))
        // EULA admin (proxied to auth-service — requires JWT auth; RBAC enforced by gateway)
        // NOTE: static /auth/admin/eula/versions must be before parameterised /:id/publish
        .route("/api/auth/admin/eula/versions", get(proxy_auth).post(proxy_auth))
        .route("/api/auth/admin/eula/versions/:id/publish", post(proxy_auth))
        .route("/api/auth/admin/eula/acceptances", get(proxy_auth))
        // Sessions admin (proxied to auth-service — requires system:configure)
        // NOTE: static /auth/admin/sessions/user/:user_id MUST be before parameterised /:id
        .route("/api/auth/admin/sessions", get(proxy_auth))
        .route("/api/auth/admin/sessions/user/:user_id", delete(proxy_auth))
        .route("/api/auth/admin/sessions/:id", delete(proxy_auth))
        // Sessions — current user's own sessions
        .route("/api/auth/sessions/mine", get(proxy_auth))
        .route("/api/auth/sessions/mine/:id", delete(proxy_auth))
        // Expression library (proxied to auth-service)
        .route("/api/expressions", get(proxy_auth).post(proxy_auth))
        // IMPORTANT: static sub-paths (/evaluate) must be before parameterised (/:id) routes.
        .route(
            "/api/expressions/evaluate",
            post(handlers::expressions::evaluate_expression_handler),
        )
        .route("/api/expressions/:id", get(proxy_auth).put(proxy_auth).delete(proxy_auth))
        .route(
            "/api/expressions/:id/evaluate",
            post(handlers::expressions::evaluate_saved_expression_handler),
        )
        // Alarm definitions (proxied to auth-service)
        .route("/api/alarm-definitions", get(proxy_auth).post(proxy_auth))
        .route("/api/alarm-definitions/:id", get(proxy_auth).put(proxy_auth).delete(proxy_auth))
        // Active alarms (proxied to event-service)
        .route("/api/alarms/active", get(proxy_event))
        .route("/api/alarms/history", get(proxy_event))
        .route("/api/alarms/:id/acknowledge", post(proxy_event))
        .route("/api/alarms/:id/shelve", post(proxy_event))
        // Report templates (proxied to auth-service)
        .route("/api/reports/templates", get(proxy_auth).post(proxy_auth))
        .route("/api/reports/templates/:id/presets", get(proxy_auth))
        .route("/api/reports/templates/:id", get(proxy_auth).put(proxy_auth).delete(proxy_auth))
        // Report schedules (proxied to auth-service)
        .route("/api/reports/schedules", get(proxy_auth).post(proxy_auth))
        .route("/api/reports/schedules/:id", put(proxy_auth).delete(proxy_auth))
        // Export presets (proxied to auth-service)
        .route("/api/reports/presets", post(proxy_auth))
        .route("/api/reports/presets/:id", delete(proxy_auth))
        // Report generation & job management (handled directly in gateway)
        // IMPORTANT: static segments (/generate, /history, /exports) must be
        // registered before parameterised segments (/:id/...) to avoid routing
        // ambiguity in axum.
        .route("/api/reports/generate", post(handlers::reports::generate_report))
        .route("/api/reports/history", get(handlers::reports::list_report_history))
        .route("/api/reports/exports", get(handlers::reports::list_my_exports))
        .route("/api/reports/:id/status", get(handlers::reports::get_report_status))
        .route("/api/reports/:id/download", get(handlers::reports::download_report))
        // Forensics — static paths before parameterised
        .route("/api/forensics/correlate", post(handlers::forensics::run_correlation))
        .route("/api/forensics/threshold-search", post(handlers::forensics::threshold_search))
        .route("/api/forensics/alarm-search", post(handlers::forensics::alarm_search))
        .route(
            "/api/forensics/investigations",
            get(handlers::forensics::list_investigations)
                .post(handlers::forensics::create_investigation),
        )
        .route(
            "/api/forensics/investigations/:id/close",
            put(handlers::forensics::close_investigation),
        )
        .route(
            "/api/forensics/investigations/:id/cancel",
            put(handlers::forensics::cancel_investigation),
        )
        .route(
            "/api/forensics/investigations/:id/points",
            post(handlers::forensics::add_points),
        )
        .route(
            "/api/forensics/investigations/:id/stages",
            post(handlers::forensics::add_stage),
        )
        .route(
            "/api/forensics/investigations/:id",
            get(handlers::forensics::get_investigation)
                .put(handlers::forensics::update_investigation)
                .delete(handlers::forensics::delete_investigation),
        )
        .route(
            "/api/forensics/investigations/:id/points/:point_id",
            delete(handlers::forensics::remove_point),
        )
        .route(
            "/api/forensics/investigations/:id/stages/:stage_id",
            put(handlers::forensics::update_stage)
                .delete(handlers::forensics::delete_stage),
        )
        .route(
            "/api/forensics/investigations/:id/stages/:stage_id/evidence",
            post(handlers::forensics::add_evidence),
        )
        .route(
            "/api/forensics/investigations/:id/stages/:stage_id/evidence/:evidence_id",
            put(handlers::forensics::update_evidence)
                .delete(handlers::forensics::delete_evidence),
        )
        // Log module — static paths before parameterised
        .route(
            "/api/logs/templates",
            get(handlers::logs::list_templates).post(handlers::logs::create_template),
        )
        .route(
            "/api/logs/templates/:id",
            put(handlers::logs::update_template).delete(handlers::logs::delete_template),
        )
        .route(
            "/api/logs/segments",
            get(handlers::logs::list_segments).post(handlers::logs::create_segment),
        )
        .route("/api/logs/search", get(handlers::logs::search_logs))
        .route("/api/logs/instances", get(handlers::logs::list_instances))
        .route(
            "/api/logs/instances/:id/submit",
            post(handlers::logs::submit_instance),
        )
        .route(
            "/api/logs/instances/:id",
            get(handlers::logs::get_instance).put(handlers::logs::update_instance),
        )
        // Rounds module — static paths before parameterised
        .route(
            "/api/rounds/templates",
            get(handlers::rounds::list_templates).post(handlers::rounds::create_template),
        )
        .route(
            "/api/rounds/templates/:id",
            get(handlers::rounds::get_template).put(handlers::rounds::update_template),
        )
        .route(
            "/api/rounds/schedules",
            get(handlers::rounds::list_schedules).post(handlers::rounds::create_schedule),
        )
        .route("/api/rounds/schedules/:id", put(handlers::rounds::update_schedule))
        .route("/api/rounds/history", get(handlers::rounds::get_history))
        .route("/api/rounds/instances", get(handlers::rounds::list_instances))
        .route(
            "/api/rounds/instances/:id/start",
            post(handlers::rounds::start_instance),
        )
        .route(
            "/api/rounds/instances/:id/complete",
            post(handlers::rounds::complete_instance),
        )
        .route(
            "/api/rounds/instances/:id/responses",
            post(handlers::rounds::save_responses),
        )
        .route(
            "/api/rounds/instances/:id",
            get(handlers::rounds::get_instance),
        )
        // Email service proxy
        .route("/api/email/providers", any(proxy_email))
        .route("/api/email/providers/:id", any(proxy_email))
        .route("/api/email/providers/:id/test", any(proxy_email))
        .route("/api/email/templates", any(proxy_email))
        .route("/api/email/templates/:id", any(proxy_email))
        .route("/api/email/templates/:id/render", any(proxy_email))
        .route("/api/email/queue", any(proxy_email))
        .route("/api/email/delivery-log", any(proxy_email))
        .route("/api/email/internal/send", any(proxy_email))
        // Universal Import (proxied to import-service)
        .route("/api/import/*path", any(proxy_import))
        // Recognition Service — status endpoint handled locally so it always returns
        // a valid response even when the recognition-service is not running.
        .route("/api/recognition/status", get(get_recognition_status))
        .route("/api/recognition/*path", any(proxy_recognition))
        // Alert Service (proxied to alert-service)
        .route("/api/alerts/*path", any(proxy_alerts))
        .route("/api/alerts", any(proxy_alerts))
        // Archive Service (proxied to archive-service)
        .route("/api/archive/*path", any(proxy_archive))
        // Batch historical point fetch (archive-service)
        .route("/api/points/history-batch", post(proxy_history_batch))
        // Parser Service (proxied to parser-service)
        .route("/api/parse/*path", any(proxy_parser))
        // DCS Graphics Import — legacy synchronous alias (proxies to parser-service /parse/dcs-import)
        .route("/api/dcs-import", post(proxy_dcs_import))
        // DCS Graphics Import — stateful 6-endpoint job API (doc 34 §API Endpoints)
        // IMPORTANT: static sub-paths (/tags, /symbols, /generate, /report) must be before parameterised /:id
        .route(
            "/api/designer/import/dcs",
            get(handlers::dcs_import::list_import_jobs)
                .post(handlers::dcs_import::create_import_job),
        )
        .route(
            "/api/designer/import/dcs/:id/tags",
            post(handlers::dcs_import::submit_tag_mappings),
        )
        .route(
            "/api/designer/import/dcs/:id/symbols",
            post(handlers::dcs_import::submit_symbol_mappings),
        )
        .route(
            "/api/designer/import/dcs/:id/generate",
            post(handlers::dcs_import::generate_graphic),
        )
        .route(
            "/api/designer/import/dcs/:id/report",
            get(handlers::dcs_import::get_import_report),
        )
        .route(
            "/api/designer/import/dcs/:id",
            get(handlers::dcs_import::get_import_job),
        )
        // SCIM 2.0 (public — auth-service validates Bearer token internally)
        .route("/scim/v2/*path", any(proxy_scim))
        .route("/scim/v2/ServiceProviderConfig", any(proxy_scim))
        .route("/scim/v2/Schemas", any(proxy_scim))
        .route("/scim/v2/ResourceTypes", any(proxy_scim))
        // SCIM token admin (JWT-protected — proxied to auth-service)
        .route("/api/auth/admin/scim-tokens", get(proxy_auth).post(proxy_auth))
        .route("/api/auth/admin/scim-tokens/:id", delete(proxy_auth))
        // Email MFA (public — part of auth flow)
        .route("/api/auth/mfa/email/send", post(proxy_auth))
        .route("/api/auth/mfa/email/verify", post(proxy_auth))
        // SMS MFA (public — part of auth flow)
        .route("/api/auth/mfa/sms/send", post(proxy_auth))
        .route("/api/auth/mfa/sms/verify", post(proxy_auth))
        // SMS provider management (JWT-authenticated, system:configure enforced in handler)
        .route("/api/auth/sms-providers", get(proxy_auth).post(proxy_auth))
        .route("/api/auth/sms-providers/:id", delete(proxy_auth))
        // Notifications (Alerts Module — human-initiated, Phase 14)
        // IMPORTANT: static routes (channels/enabled) registered BEFORE parameterized routes (:id)
        // to ensure they have highest priority and are matched on cold start (Axum route precedence)
        .route("/api/notifications/channels/enabled", get(handlers::notifications::get_enabled_channels))
        .route("/api/notifications/active", get(handlers::notifications::get_active_notifications))
        .route("/api/notifications/messages", get(handlers::notifications::list_messages))
        .route("/api/notifications/send", post(handlers::notifications::send_notification))
        .route("/api/notifications/messages/:id", get(handlers::notifications::get_message))
        .route(
            "/api/notifications/templates",
            get(handlers::notifications::list_templates).post(handlers::notifications::create_template),
        )
        .route(
            "/api/notifications/templates/:id",
            get(handlers::notifications::get_template)
                .put(handlers::notifications::update_template)
                .delete(handlers::notifications::delete_template),
        )
        .route(
            "/api/notifications/groups",
            get(handlers::notifications::list_groups).post(handlers::notifications::create_group),
        )
        .route(
            "/api/notifications/groups/:id",
            get(handlers::notifications::get_group)
                .put(handlers::notifications::update_group)
                .delete(handlers::notifications::delete_group),
        )
        .route(
            "/api/notifications/groups/:id/members",
            post(handlers::notifications::add_group_member),
        )
        .route(
            "/api/notifications/groups/:id/members/:user_id",
            delete(handlers::notifications::remove_group_member),
        )
        .route("/api/notifications/muster/:message_id", get(handlers::notifications::get_muster_status))
        .route(
            "/api/notifications/muster/:message_id/mark",
            post(handlers::notifications::mark_muster),
        )
        // Shifts / Access Control (Phase 15)
        .merge(handlers::shifts::shifts_routes())
        // Mobile endpoints (Phase 13 — doc 20)
        // NOTE: /api/mobile/health is public (whitelisted in mw::is_public_path).
        // Remaining mobile routes require JWT (enforced by the jwt_auth middleware layer).
        .route("/api/mobile/health", get(handlers::mobile::health))
        .route("/api/mobile/rounds/sync", post(handlers::mobile::batch_sync_rounds))
        .route("/api/mobile/rounds/active", get(handlers::mobile::get_active_rounds))
        .route("/api/mobile/presence", post(handlers::mobile::update_presence))
        .route("/api/mobile/config", get(handlers::mobile::get_config))
        // Backup & Restore (Phase 4 — doc 15)
        // IMPORTANT: static routes must come before parameterised /:filename routes.
        .route("/api/backup/list", get(handlers::backup::list_backups))
        .route("/api/backup/create", post(handlers::backup::create_backup))
        .route("/api/backup/restore", post(handlers::backup::restore_backup))
        .route("/api/backup/download/:filename", get(handlers::backup::download_backup))
        .route("/api/backup/:filename", delete(handlers::backup::delete_backup))
        // Certificates (TLS/SSL certificate lifecycle management — settings:admin)
        // IMPORTANT: static paths (/upload) must be before parameterised (/:name/...) routes
        .route("/api/certificates", get(handlers::certificates::list_certs))
        .route("/api/certificates/upload", post(handlers::certificates::upload_cert))
        .route("/api/certificates/:name/info", get(handlers::certificates::get_cert_info))
        .route("/api/certificates/:name", delete(handlers::certificates::delete_cert))
        // Internal certificate renewal — called by systemd io-cert-renew.timer (no JWT required;
        // whitelisted in mw::is_public_path so the JWT middleware skips validation).
        .route(
            "/api/internal/certs/renew",
            post(handlers::certificates::renew_cert),
        )
        // Change Snapshots (Phase 9 — doc 25)
        .route("/api/snapshots", get(handlers::bulk_update::list_snapshots).post(handlers::bulk_update::create_snapshot))
        .route("/api/snapshots/:id", get(handlers::bulk_update::get_snapshot).delete(handlers::bulk_update::delete_snapshot))
        .route("/api/snapshots/:id/restore-preview", get(handlers::bulk_update::restore_preview))
        .route("/api/snapshots/:id/restore", post(handlers::bulk_update::restore_snapshot))
        // Bulk Update (Phase 9 — doc 25)
        .route("/api/bulk-update/template/:target_type", get(handlers::bulk_update::get_template))
        .route("/api/bulk-update/preview", post(handlers::bulk_update::preview_bulk_update))
        .route("/api/bulk-update/apply", post(handlers::bulk_update::apply_bulk_update))
        .route("/api/bulk-update/:id/error-report", get(handlers::bulk_update::get_error_report))
        // Universal Export (Phase 9 — doc 25)
        // IMPORTANT: static sub-paths (/exports/:id/download) must be before parameterised (/:id)
        .route(
            "/api/exports",
            get(handlers::exports::list_exports).post(handlers::exports::create_export),
        )
        .route(
            "/api/exports/:id/download",
            get(handlers::exports::download_export),
        )
        .route(
            "/api/exports/:id",
            get(handlers::exports::get_export).delete(handlers::exports::delete_export),
        )
        // User preferences (viewport bookmarks, sidebar state, etc.)
        .route(
            "/api/user/preferences",
            get(handlers::user_preferences::get_preferences)
                .patch(handlers::user_preferences::patch_preferences),
        )
        // System info (About page data, licenses, SBOM — any authenticated user)
        .route("/api/system/about", get(handlers::system::get_about))
        .route("/api/system/licenses/backend", get(handlers::system::get_licenses_backend))
        .route("/api/system/licenses/frontend", get(handlers::system::get_licenses_frontend))
        .route("/api/system/sbom", get(handlers::system::download_sbom))
        // System health aggregation
        .route("/api/health/services", get(service_health_handler))
        // Middleware — tower layers are applied outermost-last, so the last
        // layer listed here is the FIRST to see each request.
        // Order: inject_secrets → rate_limit → jwt_auth → metrics → handler
        // metrics_middleware is placed here (inside the router, before with_state)
        // so that Axum's routing pass has already populated MatchedPath in
        // request extensions, allowing route-template labels without cardinality
        // explosion. Do NOT move it outside the router or MatchedPath will be absent.
        .layer(middleware::from_fn_with_state(state.clone(), mw::jwt_auth))
        .layer(middleware::from_fn(mw::rate_limit))
        .layer(middleware::from_fn_with_state(state.clone(), inject_secrets))
        .layer(middleware::from_fn(mw::metrics_middleware))
        .with_state(state);

    let app = api
        .merge(health.into_router())
        .merge(obs.metrics_router())
        .layer(cors)
        .layer(TimeoutLayer::new(std::time::Duration::from_secs(30)))
        .layer(RequestBodyLimitLayer::new(10 * 1024 * 1024)) // 10 MB default; upload routes override
        .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
        .layer(CatchPanicLayer::new());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!(service = "api-gateway", addr = %addr, "Listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;

    Ok(())
}

async fn shutdown_signal() {
    use tokio::signal;
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("shutdown signal received, draining in-flight requests…");
}

/// Injects JWT secret and service secret into request extensions.
async fn inject_secrets(
    State(state): State<AppState>,
    mut req: Request,
    next: middleware::Next,
) -> Response {
    req.extensions_mut().insert(Arc::new(state.config.jwt_secret.clone()));
    req.extensions_mut()
        .insert(Arc::new(mw::ServiceSecret(state.config.service_secret.clone())));
    next.run(req).await
}

/// Proxy all `/api/...` requests to the auth-service, stripping the `/api` prefix.
async fn proxy_auth(State(state): State<AppState>, req: Request) -> Response {
    let path = req.uri().path().to_string();
    let downstream = path.strip_prefix("/api").unwrap_or(&path).to_string();
    proxy::proxy(&state, req, &state.config.auth_service_url, &downstream).await
}

/// Proxy all `/api/...` requests to the event-service, stripping the `/api` prefix.
async fn proxy_event(State(state): State<AppState>, req: Request) -> Response {
    let path = req.uri().path().to_string();
    let downstream = path.strip_prefix("/api").unwrap_or(&path).to_string();
    proxy::proxy(&state, req, &state.config.event_service_url, &downstream).await
}

/// Proxy all `/api/email/...` requests to the email-service, stripping `/api/email`.
async fn proxy_email(State(state): State<AppState>, req: Request) -> Response {
    let path = req.uri().path().to_string();
    let downstream = path.strip_prefix("/api/email").unwrap_or(&path).to_string();
    proxy::proxy(&state, req, &state.config.email_service_url, &downstream).await
}

/// Proxy all `/api/import/...` requests to the import-service, enforcing RBAC.
///
/// Permission matrix (doc 24 §15):
///   system:import_connections  — /connections (all methods), /connector-templates (GET)
///   system:import_definitions  — /definitions (all methods)
///   system:import_execute      — /definitions/:id/runs (POST), /runs/:id/cancel (POST)
///   system:import_history      — /runs (GET), /runs/:id (GET), /runs/:id/errors (GET)
async fn proxy_import(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    req: Request,
) -> Response {
    use axum::http::StatusCode;

    let path = req.uri().path().to_string();
    let method = req.method().clone();

    // Determine the required permission based on path and HTTP method.
    // Path segments after /api/import: e.g. /connections, /definitions, /runs, /connector-templates
    let sub = path.strip_prefix("/api/import").unwrap_or("");

    let required: &str = if sub.starts_with("/connector-templates") {
        // Browsing connector templates requires connections permission
        "system:import_connections"
    } else if sub.starts_with("/connections") {
        "system:import_connections"
    } else if sub.contains("/runs") {
        // POST to /definitions/:id/runs  → execute
        // POST to /runs/:id/cancel       → execute
        // GET  /runs* or /definitions/:id/runs → history
        if method == Method::GET {
            "system:import_history"
        } else {
            "system:import_execute"
        }
    } else if sub.starts_with("/definitions") {
        "system:import_definitions"
    } else {
        // Any unrecognised sub-path under /api/import defaults to connections permission
        "system:import_connections"
    };

    let has_permission = claims.permissions.iter().any(|p| p == "*" || p == required);
    if !has_permission {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "error": {
                    "code": "FORBIDDEN",
                    "message": "Insufficient permissions"
                }
            })),
        )
            .into_response();
    }

    let downstream = path.strip_prefix("/api/import").unwrap_or(&path).to_string();
    proxy::proxy(&state, req, &state.config.import_service_url, &downstream).await
}

/// GET /api/recognition/status — local handler that always returns a valid response.
///
/// Tries to fetch status from the recognition-service. If the service is not running
/// (connection refused, timeout, or non-2xx), returns a stub response with both domains
/// disabled rather than propagating a 404/502 to the client.
/// This ensures the Designer's "Recognize Image" button is always shown (in disabled state)
/// rather than being hidden due to an API error.
async fn get_recognition_status(State(state): State<AppState>) -> Response {
    let url = format!("{}/recognition/status", state.config.recognition_service_url);
    match state.http_client
        .get(&url)
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            // Forward the recognition service response verbatim.
            match resp.json::<serde_json::Value>().await {
                Ok(body) => Json(body).into_response(),
                Err(_) => Json(serde_json::json!({
                    "success": true,
                    "data": {
                        "domains": {
                            "pid": { "model_loaded": false, "hardware": "cpu", "mode": "disabled" },
                            "dcs": { "model_loaded": false, "hardware": "cpu", "mode": "disabled" }
                        }
                    }
                })).into_response(),
            }
        }
        _ => {
            // Recognition service is not reachable — return a valid stub so the frontend
            // can show the "Recognize Image" button in a disabled/unavailable state.
            Json(serde_json::json!({
                "success": true,
                "data": {
                    "domains": {
                        "pid": { "model_loaded": false, "hardware": "cpu", "mode": "disabled" },
                        "dcs": { "model_loaded": false, "hardware": "cpu", "mode": "disabled" }
                    }
                }
            })).into_response()
        }
    }
}

/// Proxy all `/api/recognition/...` requests to the recognition-service, stripping `/api/recognition`.
async fn proxy_recognition(State(state): State<AppState>, req: Request) -> Response {
    let path = req.uri().path().to_string();
    let downstream = path.strip_prefix("/api/recognition").unwrap_or(&path).to_string();
    proxy::proxy(&state, req, &state.config.recognition_service_url, &downstream).await
}

/// Proxy all `/api/alerts/...` requests to the alert-service, stripping `/api`.
async fn proxy_alerts(State(state): State<AppState>, req: Request) -> Response {
    let path = req.uri().path().to_string();
    let downstream = path.strip_prefix("/api").unwrap_or(&path).to_string();
    proxy::proxy(&state, req, &state.config.alert_service_url, &downstream).await
}

/// Proxy all `/api/parse/...` requests to the parser-service, stripping `/api/parse`.
async fn proxy_parser(State(state): State<AppState>, req: Request) -> Response {
    let path = req.uri().path().to_string();
    let downstream = path.strip_prefix("/api/parse").unwrap_or(&path).to_string();
    proxy::proxy(&state, req, &state.config.parser_service_url, &downstream).await
}

/// Proxy all `/scim/v2/...` requests to the auth-service (SCIM handles its own Bearer auth).
async fn proxy_scim(State(state): State<AppState>, req: Request) -> Response {
    let path = req.uri().path().to_string();
    proxy::proxy(&state, req, &state.config.auth_service_url, &path).await
}

/// Proxy `POST /api/dcs-import` to parser-service at `/parse/dcs-import`.
/// This is a dedicated top-level alias for the DCS Graphics Import wizard.
/// Requires the `designer:import` RBAC permission (doc 34 §Permissions).
async fn proxy_dcs_import(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    req: Request,
) -> Response {
    let has_permission = claims
        .permissions
        .iter()
        .any(|p| p == "*" || p == "designer:import");
    if !has_permission {
        return (
            axum::http::StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "success": false,
                "error": {
                    "code": "FORBIDDEN",
                    "message": "designer:import permission required"
                }
            })),
        )
            .into_response();
    }

    proxy::proxy(&state, req, &state.config.parser_service_url, "/parse/dcs-import").await
}

/// Proxy all `/api/archive/...` requests to the archive-service, stripping `/api/archive`.
async fn proxy_archive(State(state): State<AppState>, req: Request) -> Response {
    let path = req.uri().path().to_string();
    let downstream = path.strip_prefix("/api/archive").unwrap_or(&path).to_string();
    proxy::proxy(&state, req, &state.config.archive_service_url, &downstream).await
}

/// Proxy `POST /api/points/history-batch` → archive-service `/history/points/batch`.
/// Convenience alias for batch historical data fetching (Console §8.4, Process §8.3).
async fn proxy_history_batch(State(state): State<AppState>, req: Request) -> Response {
    proxy::proxy(&state, req, &state.config.archive_service_url, "/history/points/batch").await
}

/// GET /api/health/services — fan out to all 11 service /health/live endpoints
/// and return their aggregated status. Requires authentication (JWT middleware).
async fn service_health_handler(State(state): State<AppState>) -> impl axum::response::IntoResponse {
    use serde_json::{json, Value};

    let services: &[(&str, &str)] = &[
        ("api-gateway",         "http://127.0.0.1:3000"),
        ("data-broker",         "http://127.0.0.1:3001"),
        ("opc-service",         "http://127.0.0.1:3002"),
        ("event-service",       "http://127.0.0.1:3003"),
        ("parser-service",      "http://127.0.0.1:3004"),
        ("archive-service",     "http://127.0.0.1:3005"),
        ("import-service",      "http://127.0.0.1:3006"),
        ("alert-service",       "http://127.0.0.1:3007"),
        ("email-service",       "http://127.0.0.1:3008"),
        ("auth-service",        "http://127.0.0.1:3009"),
        ("recognition-service", "http://127.0.0.1:3010"),
    ];

    let client = &state.http_client;
    let mut results: Vec<Value> = Vec::with_capacity(services.len());

    for (name, base) in services {
        let url = format!("{}/health/live", base);
        let status = match client.get(&url)
            .timeout(std::time::Duration::from_secs(2))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => "healthy",
            Ok(_)                                   => "unhealthy",
            Err(_)                                   => "unhealthy",
        };
        results.push(json!({ "name": name, "status": status }));
    }

    let _ = state; // keep borrow checker happy
    axum::Json(json!({ "success": true, "data": results }))
}
