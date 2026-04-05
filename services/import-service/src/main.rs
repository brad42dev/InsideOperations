use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::{self, Next},
    response::{IntoResponse, Response},
};
use std::{net::SocketAddr, sync::Arc, time::Duration};
use tower_http::catch_panic::CatchPanicLayer;
use tracing::{info, warn};

mod config;
mod connectors;
mod crypto;
mod handlers;
mod pipeline;
mod state;

use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let obs = io_observability::init(io_observability::ObservabilityConfig {
        service_name: "import-service",
        service_version: env!("CARGO_PKG_VERSION"),
        log_level: "info",
        metrics_enabled: true,
        tracing_enabled: false,
    })?;
    obs.start_watchdog_keepalive();

    info!(service = "import-service", "Starting up");

    let cfg = config::Config::from_env()?;
    let port = cfg.port;

    let db = io_db::create_pool(&cfg.database_url).await?;
    io_db::spawn_pool_metrics(db.clone(), "import-service");

    // Seed connector templates
    seed_connector_templates(&db).await;

    // Background task: poll DCS supplemental connectors every 5 minutes
    tokio::spawn(run_supplemental_connectors(db.clone(), cfg.master_key));

    // Background task: general import scheduler — polls import_schedules every 30 seconds
    tokio::spawn(run_import_scheduler(
        db.clone(),
        cfg.master_key,
        cfg.upload_dir.clone(),
    ));

    // Background task: drain webhook buffer every 5 seconds
    tokio::spawn(run_webhook_drain(
        db.clone(),
        cfg.master_key,
        cfg.upload_dir.clone(),
    ));

    // Streaming session supervisor — manages SSE + WebSocket connections
    let supervisor = connectors::streaming::supervisor::SupervisorHandle::new();
    tokio::spawn(connectors::streaming::supervisor::run_streaming_supervisor(
        db.clone(),
        cfg.master_key,
        supervisor.clone(),
    ));

    let app_state = AppState {
        db,
        config: Arc::new(cfg),
        supervisor,
    };

    let mut health = io_health::HealthRegistry::new("import-service", env!("CARGO_PKG_VERSION"));
    health.register(io_health::PgDatabaseCheck::new(app_state.db.clone()));
    health.mark_startup_complete();

    let api = handlers::import::import_routes()
        .merge(handlers::webhook::webhook_admin_routes())
        .merge(handlers::stream::stream_routes())
        .layer(middleware::from_fn_with_state(
            app_state.clone(),
            service_secret_middleware,
        ))
        .with_state(app_state.clone());

    // Webhook receiver — no service_secret (external systems push directly)
    // HMAC-SHA256 signature validation is performed inside receive_webhook.
    let webhook_routes = axum::Router::new()
        .route(
            "/import/webhooks/:token",
            axum::routing::post(handlers::webhook::receive_webhook),
        )
        .with_state(app_state);

    let app = api
        .merge(webhook_routes)
        .merge(health.into_router())
        .merge(obs.metrics_router())
        .layer(CatchPanicLayer::new());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!(service = "import-service", addr = %addr, "Listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
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

/// Middleware: validate x-io-service-secret header when service_secret is configured.
async fn service_secret_middleware(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Response {
    let secret = &state.config.service_secret;
    if !secret.is_empty() {
        let provided = req
            .headers()
            .get("x-io-service-secret")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        if provided != secret.as_str() {
            warn!("import-service: invalid or missing x-io-service-secret");
            return (
                StatusCode::UNAUTHORIZED,
                axum::Json(serde_json::json!({
                    "success": false,
                    "error": { "code": "UNAUTHORIZED", "message": "Invalid service secret" }
                })),
            )
                .into_response();
        }
    }
    next.run(req).await
}

// ---------------------------------------------------------------------------
// DCS supplemental connector background polling
// ---------------------------------------------------------------------------

/// Spawned at startup; checks all enabled supplemental connectors every 60 seconds.
/// Individual connectors are polled only when their configured interval has elapsed.
async fn run_supplemental_connectors(db: sqlx::PgPool, master_key: [u8; 32]) {
    // Per-connection last-poll timestamps: (last_metadata_poll, last_event_poll)
    let mut last_polls: std::collections::HashMap<
        uuid::Uuid,
        (std::time::Instant, std::time::Instant),
    > = std::collections::HashMap::new();

    let mut interval = tokio::time::interval(Duration::from_secs(60));
    loop {
        interval.tick().await;
        if let Err(e) = poll_supplemental_connectors(&db, &master_key, &mut last_polls).await {
            warn!("supplemental connector poll error: {e}");
        }
    }
}

async fn poll_supplemental_connectors(
    db: &sqlx::PgPool,
    master_key: &[u8; 32],
    last_polls: &mut std::collections::HashMap<
        uuid::Uuid,
        (std::time::Instant, std::time::Instant),
    >,
) -> anyhow::Result<()> {
    use sqlx::Row as _;

    let rows = sqlx::query(
        "SELECT id, connection_type, config, auth_type, auth_config, point_source_id \
         FROM import_connections \
         WHERE is_supplemental_connector = true AND enabled = true",
    )
    .fetch_all(db)
    .await?;

    // Evict stale entries for connections that are no longer active
    let active_ids: std::collections::HashSet<uuid::Uuid> = rows
        .iter()
        .filter_map(|r| r.try_get::<uuid::Uuid, _>("id").ok())
        .collect();
    last_polls.retain(|id, _| active_ids.contains(id));

    for row in &rows {
        let conn_id: uuid::Uuid = row.try_get("id")?;
        let conn_type: String = row.try_get("connection_type")?;
        let config: serde_json::Value = row.try_get("config")?;
        let auth_type: String = row.try_get("auth_type")?;
        let auth_config_raw: serde_json::Value = row.try_get("auth_config")?;
        // Decrypt credential fields before passing to connector
        let auth_config = crate::crypto::decrypt_sensitive_fields(&auth_config_raw, master_key);
        let point_source_id: Option<uuid::Uuid> = row.try_get("point_source_id").ok().flatten();

        let source_id = match point_source_id {
            Some(id) => id,
            None => {
                warn!(conn_id = %conn_id, "supplemental connector has no point_source_id; skipping");
                continue;
            }
        };

        let connector = match connectors::get_connector(&conn_type) {
            Some(c) => c,
            None => {
                warn!(conn_type = %conn_type, "no connector implementation for type; skipping");
                continue;
            }
        };

        // Read per-connection poll intervals from config JSONB (default 300s)
        let meta_interval_secs = config
            .get("poll_interval_seconds")
            .and_then(|v| v.as_u64())
            .unwrap_or(300);
        let event_interval_secs = config
            .get("event_poll_interval_seconds")
            .and_then(|v| v.as_u64())
            .unwrap_or(300);
        let meta_interval = Duration::from_secs(meta_interval_secs);
        let event_interval = Duration::from_secs(event_interval_secs);

        let now = std::time::Instant::now();
        let (last_meta, last_event) = last_polls.entry(conn_id).or_insert((
            now - meta_interval - Duration::from_secs(1),
            now - event_interval - Duration::from_secs(1),
        ));

        let do_metadata = now.duration_since(*last_meta) >= meta_interval;
        let do_events = connector.has_events() && now.duration_since(*last_event) >= event_interval;

        if !do_metadata && !do_events {
            continue;
        }

        let cfg = connectors::extract_connector_config(conn_id, &config, &auth_type, &auth_config);

        // Fetch and write metadata
        if do_metadata {
            match connector.fetch_metadata(&cfg).await {
                Ok(items) => {
                    let meta_count = items.len() as i32;
                    if let Err(e) =
                        connectors::db_writes::write_supplemental_metadata(db, source_id, &items)
                            .await
                    {
                        warn!(conn_id = %conn_id, "write_supplemental_metadata error: {e}");
                    }
                    let _ = sqlx::query(
                        "UPDATE import_connections SET \
                         supplemental_last_polled_at = NOW(), \
                         supplemental_last_metadata_count = $2, \
                         supplemental_last_error = NULL \
                         WHERE id = $1",
                    )
                    .bind(conn_id)
                    .bind(meta_count)
                    .execute(db)
                    .await;
                    *last_meta = now;
                }
                Err(e) => {
                    warn!(conn_id = %conn_id, conn_type = %conn_type, "fetch_metadata error: {e}");
                    let _ = sqlx::query(
                        "UPDATE import_connections SET \
                         supplemental_last_polled_at = NOW(), \
                         supplemental_last_error = $2 \
                         WHERE id = $1",
                    )
                    .bind(conn_id)
                    .bind(e.to_string())
                    .execute(db)
                    .await;
                    *last_meta = now;
                }
            }
        }

        // Fetch and write events (only if connector supports it and interval elapsed)
        if do_events {
            let since =
                chrono::Utc::now() - chrono::Duration::seconds(event_interval_secs as i64 + 60);
            match connector.fetch_events(&cfg, since).await {
                Ok(events) => {
                    let event_count = events.len() as i32;
                    if let Err(e) =
                        connectors::db_writes::write_supplemental_events(db, source_id, &events)
                            .await
                    {
                        warn!(conn_id = %conn_id, "write_supplemental_events error: {e}");
                    }
                    let _ = sqlx::query(
                        "UPDATE import_connections SET \
                         supplemental_last_event_count = $2 \
                         WHERE id = $1",
                    )
                    .bind(conn_id)
                    .bind(event_count)
                    .execute(db)
                    .await;
                    *last_event = now;
                }
                Err(e) => {
                    warn!(conn_id = %conn_id, conn_type = %conn_type, "fetch_events error: {e}");
                    *last_event = now;
                }
            }
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// General import scheduler
// ---------------------------------------------------------------------------

/// Spawned at startup; polls `import_schedules` every 30 seconds and claims
/// due schedules using `FOR UPDATE SKIP LOCKED` to prevent duplicate execution.
async fn run_import_scheduler(db: sqlx::PgPool, master_key: [u8; 32], upload_dir: String) {
    let mut interval = tokio::time::interval(Duration::from_secs(30));
    loop {
        interval.tick().await;
        if let Err(e) = poll_import_schedules(&db, master_key, &upload_dir).await {
            warn!("import scheduler error: {e}");
        }
    }
}

/// One poll cycle: claim all due schedules, execute ETL, advance next_run_at.
///
/// Each eligible schedule is claimed inside its own short transaction using
/// `FOR UPDATE SKIP LOCKED` so that concurrent instances of the service cannot
/// double-execute the same schedule. The transaction is committed immediately
/// after marking the row `running = true` so the lock is released quickly;
/// the ETL itself runs outside the claim transaction.
async fn poll_import_schedules(
    db: &sqlx::PgPool,
    master_key: [u8; 32],
    upload_dir: &str,
) -> anyhow::Result<()> {
    use sqlx::Row as _;
    use std::str::FromStr as _;

    metrics::counter!("io_import_scheduler_ticks_total").increment(1);

    loop {
        // Claim one schedule per iteration; loop until none remain.
        let mut tx = db.begin().await?;

        let row_opt = sqlx::query(
            "SELECT s.id, s.definition_id, s.schedule_type, \
                    s.cron_expression, s.interval_seconds, s.schedule_config \
             FROM import_schedules s \
             JOIN import_definitions d ON d.id = s.definition_id \
             WHERE s.enabled = true \
               AND d.enabled = true \
               AND s.schedule_type IN ('cron', 'interval', 'file_arrival') \
               AND s.next_run_at <= NOW() \
               AND (s.running = false \
                    OR s.last_heartbeat_at < NOW() - INTERVAL '5 minutes') \
             ORDER BY s.next_run_at \
             FOR UPDATE OF s SKIP LOCKED \
             LIMIT 1",
        )
        .fetch_optional(&mut *tx)
        .await?;

        let row = match row_opt {
            Some(r) => r,
            None => {
                // No eligible schedules — release the transaction and stop looping.
                tx.commit().await?;
                break;
            }
        };

        let schedule_id: uuid::Uuid = row.try_get("id")?;
        let definition_id: uuid::Uuid = row.try_get("definition_id")?;
        let schedule_type: String = row.try_get("schedule_type")?;
        let cron_expression: Option<String> = row.try_get("cron_expression").ok().flatten();
        let interval_seconds: Option<i32> = row.try_get("interval_seconds").ok().flatten();
        let schedule_config: serde_json::Value = row
            .try_get::<serde_json::Value, _>("schedule_config")
            .unwrap_or(serde_json::Value::Null);

        // Mark running before releasing the claim transaction.
        sqlx::query(
            "UPDATE import_schedules \
             SET running = true, last_heartbeat_at = NOW() \
             WHERE id = $1",
        )
        .bind(schedule_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        metrics::counter!("io_import_scheduler_due_count").increment(1);

        // --- ETL execution (outside the claim transaction) -------------------
        //
        // Create a new import_run record and execute the pipeline.
        let run_id = uuid::Uuid::new_v4();

        // Insert the run record (status: pending → pipeline::execute sets it to running).
        let insert_result = sqlx::query(
            "INSERT INTO import_runs \
             (id, import_definition_id, schedule_id, status, triggered_by, created_at) \
             VALUES ($1, $2, $3, 'pending', 'schedule', NOW())",
        )
        .bind(run_id)
        .bind(definition_id)
        .bind(schedule_id)
        .execute(db)
        .await;

        if let Err(e) = insert_result {
            warn!(
                schedule_id = %schedule_id,
                definition_id = %definition_id,
                "failed to create import_run for scheduled job: {e}"
            );
            // Clear running flag so the schedule can be retried next cycle.
            let _ = sqlx::query("UPDATE import_schedules SET running = false WHERE id = $1")
                .bind(schedule_id)
                .execute(db)
                .await;
        } else {
            // Spawn the ETL pipeline.
            // The running=false and next_run_at update happen INSIDE the spawned task
            // after pipeline::execute returns, so the schedule stays locked (running=true)
            // for the full duration of the ETL run.
            let db_inner = db.clone();
            let upload_dir_inner = upload_dir.to_string();
            let sched_type = schedule_type.clone();
            let cron_expr = cron_expression.clone();
            let interval_secs = interval_seconds;
            let sched_cfg = schedule_config.clone();
            let sched_id = schedule_id;
            tokio::spawn(async move {
                if let Err(e) = pipeline::execute(
                    &db_inner,
                    run_id,
                    definition_id,
                    false, // not dry_run
                    master_key,
                    upload_dir_inner,
                    Some(sched_id),
                )
                .await
                {
                    warn!(
                        run_id = %run_id,
                        definition_id = %definition_id,
                        "scheduled pipeline execution failed: {e}"
                    );
                }

                // --- Advance next_run_at and clear running flag --------------
                // Compute next scheduled time based on schedule_type.
                let next_run_at: Option<chrono::DateTime<chrono::Utc>> = match sched_type.as_str() {
                    "cron" => cron_expr
                        .as_deref()
                        .and_then(|expr| match cron::Schedule::from_str(expr) {
                            Ok(sched) => sched.upcoming(chrono::Utc).next(),
                            Err(e) => {
                                warn!(
                                    schedule_id = %sched_id,
                                    expression = expr,
                                    "invalid cron expression: {e}"
                                );
                                None
                            }
                        }),
                    "interval" => interval_secs
                        .map(|secs| chrono::Utc::now() + chrono::Duration::seconds(secs as i64)),
                    "file_arrival" => {
                        let poll_interval = sched_cfg
                            .get("poll_interval_seconds")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(60);
                        Some(chrono::Utc::now() + chrono::Duration::seconds(poll_interval))
                    }
                    other => {
                        warn!(
                            schedule_id = %sched_id,
                            schedule_type = other,
                            "unknown schedule_type in completion handler"
                        );
                        None
                    }
                };

                if let Some(next) = next_run_at {
                    let _ = sqlx::query(
                        "UPDATE import_schedules \
                         SET running = false, next_run_at = $2 \
                         WHERE id = $1",
                    )
                    .bind(sched_id)
                    .bind(next)
                    .execute(&db_inner)
                    .await
                    .map_err(
                        |e| warn!(schedule_id = %sched_id, "failed to advance next_run_at: {e}"),
                    );
                } else {
                    let _ = sqlx::query(
                        "UPDATE import_schedules SET running = false WHERE id = $1",
                    )
                    .bind(sched_id)
                    .execute(&db_inner)
                    .await
                    .map_err(
                        |e| warn!(schedule_id = %sched_id, "failed to clear running flag: {e}"),
                    );
                }
            });
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Webhook drain background task
// ---------------------------------------------------------------------------

/// Spawned at startup; drains pending webhook buffer rows every 5 seconds.
async fn run_webhook_drain(db: sqlx::PgPool, master_key: [u8; 32], upload_dir: String) {
    let mut interval = tokio::time::interval(Duration::from_secs(5));
    loop {
        interval.tick().await;
        if let Err(e) = drain_webhook_buffer(&db, master_key, &upload_dir).await {
            warn!("webhook drain error: {e}");
        }
    }
}

/// One drain cycle: claim and process pending webhook buffer rows one at a time.
async fn drain_webhook_buffer(
    db: &sqlx::PgPool,
    master_key: [u8; 32],
    upload_dir: &str,
) -> anyhow::Result<()> {
    use sqlx::Row as _;

    loop {
        // Claim one pending row atomically using FOR UPDATE SKIP LOCKED.
        let row = sqlx::query(
            "UPDATE import_webhook_buffer \
             SET processing_status = 'processing' \
             WHERE id = ( \
                 SELECT id FROM import_webhook_buffer \
                 WHERE processing_status = 'pending' \
                 ORDER BY received_at \
                 FOR UPDATE SKIP LOCKED \
                 LIMIT 1 \
             ) RETURNING id, import_definition_id, payload",
        )
        .fetch_optional(db)
        .await?;

        let row = match row {
            Some(r) => r,
            None => break, // No pending items
        };

        let buffer_id: uuid::Uuid = row.try_get("id")?;
        let def_id: uuid::Uuid = row.try_get("import_definition_id")?;

        let run_id = uuid::Uuid::new_v4();
        let insert_ok = sqlx::query(
            "INSERT INTO import_runs \
             (id, import_definition_id, status, triggered_by, created_at) \
             VALUES ($1, $2, 'pending', 'webhook', NOW())",
        )
        .bind(run_id)
        .bind(def_id)
        .execute(db)
        .await;

        if let Err(e) = insert_ok {
            warn!(buffer_id = %buffer_id, "failed to create run for webhook buffer row: {e}");
            let _ = sqlx::query(
                "UPDATE import_webhook_buffer \
                 SET processing_status = 'failed', error_message = $2 \
                 WHERE id = $1",
            )
            .bind(buffer_id)
            .bind(e.to_string())
            .execute(db)
            .await;
            continue;
        }

        match pipeline::execute(
            db,
            run_id,
            def_id,
            false,
            master_key,
            upload_dir.to_string(),
            None,
        )
        .await
        {
            Ok(()) => {
                let _ = sqlx::query(
                    "UPDATE import_webhook_buffer \
                     SET processing_status = 'done', processed_at = NOW() \
                     WHERE id = $1",
                )
                .bind(buffer_id)
                .execute(db)
                .await;
            }
            Err(e) => {
                let _ = sqlx::query(
                    "UPDATE import_webhook_buffer \
                     SET processing_status = 'failed', error_message = $2, \
                         retry_count = retry_count + 1 \
                     WHERE id = $1",
                )
                .bind(buffer_id)
                .bind(e.to_string())
                .execute(db)
                .await;
            }
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------

/// Seed the 40 connector templates on startup.
/// Uses ON CONFLICT (slug) DO UPDATE to refresh required_fields on every startup,
/// so that new required_fields values are applied to existing rows.
async fn seed_connector_templates(db: &sqlx::PgPool) {
    #[derive(Debug)]
    struct TemplateSpec {
        slug: &'static str,
        name: &'static str,
        domain: &'static str,
        vendor: &'static str,
        description: &'static str,
        target_tables: &'static [&'static str],
        /// JSON array of required field descriptors, e.g.
        /// [{"key":"base_url","label":"Instance URL","type":"text"},...]
        required_fields: &'static str,
    }

    let templates: &[TemplateSpec] = &[
        // ── Maintenance (5) ───────────────────────────────────────────────────
        TemplateSpec {
            slug: "sap-pm-work-orders",
            name: "SAP Plant Maintenance Work Orders",
            domain: "maintenance",
            vendor: "SAP SE",
            description: "Import work orders, maintenance notifications, and PM schedules from SAP Plant Maintenance (ECC/S4HANA) via OData API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"SAP Server URL","placeholder":"https://your-sap-server","type":"text"},{"key":"sap_client","label":"SAP Client","placeholder":"100","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "ibm-maximo-work-orders",
            name: "IBM Maximo Work Orders",
            domain: "maintenance",
            vendor: "IBM",
            description: "Import work orders, preventive maintenance schedules, and failure reports from IBM Maximo / Maximo Application Suite via OSLC REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Maximo Server URL","placeholder":"https://your-maximo/maximo","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "emaint-fiix-cmms",
            name: "eMaint / Fiix Work Orders",
            domain: "maintenance",
            vendor: "Fluke Reliability / Rockwell Automation",
            description: "Import work orders and maintenance records from eMaint CMMS (Fluke Reliability) or Fiix CMMS (Rockwell Automation) via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "hxgn-eam-work-orders",
            name: "HxGN EAM Work Orders",
            domain: "maintenance",
            vendor: "Hexagon",
            description: "Import work orders, service requests, and maintenance data from Hexagon EAM (formerly Infor EAM) via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "oracle-eam-work-orders",
            name: "Oracle EAM Work Orders",
            domain: "maintenance",
            vendor: "Oracle",
            description: "Import asset records and maintenance work orders from Oracle Enterprise Asset Management (EBS/Fusion) via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Oracle Instance URL","placeholder":"https://your-oracle-server","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        // ── Equipment (5) ─────────────────────────────────────────────────────
        TemplateSpec {
            slug: "aveva-aim-equipment",
            name: "AVEVA Asset Information Management",
            domain: "equipment",
            vendor: "AVEVA",
            description: "Import equipment hierarchy, asset metadata, and tag lists from AVEVA AIM / PI Asset Framework via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "ge-apm-equipment",
            name: "GE APM Equipment Records",
            domain: "equipment",
            vendor: "GE Vernova",
            description: "Import equipment records, risk-based inspection data, and asset health metrics from GE APM via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "hxgn-spf-equipment",
            name: "Hexagon SmartPlant Foundation Equipment",
            domain: "equipment",
            vendor: "Hexagon",
            description: "Import equipment and tag data from Hexagon SmartPlant Foundation / HxGN SDx via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "sap-pm-equipment",
            name: "SAP PM Equipment Register",
            domain: "equipment",
            vendor: "SAP SE",
            description: "Import equipment master records and functional location hierarchies from SAP Plant Maintenance / S/4HANA via OData API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"SAP Server URL","placeholder":"https://your-sap-server","type":"text"},{"key":"sap_client","label":"SAP Client","placeholder":"100","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "ibm-maximo-assets",
            name: "IBM Maximo Asset Register",
            domain: "equipment",
            vendor: "IBM",
            description: "Import asset records, operating locations, and equipment hierarchy from IBM Maximo / MAS via OSLC REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Maximo Server URL","placeholder":"https://your-maximo/maximo","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        // ── ERP / Financial (5) ───────────────────────────────────────────────
        TemplateSpec {
            slug: "hitachi-ellipse-erp",
            name: "Hitachi EAM (Ellipse) ERP",
            domain: "erp_financial",
            vendor: "Hitachi Energy",
            description: "Import financial, maintenance, and procurement data from Hitachi EAM (formerly ABB Ellipse) via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "infor-cloudsuite-erp",
            name: "Infor CloudSuite Industrial ERP",
            domain: "erp_financial",
            vendor: "Infor",
            description: "Import financial transactions, purchase orders, and maintenance records from Infor CloudSuite Industrial (SyteLine) via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "microsoft-dynamics-365",
            name: "Microsoft Dynamics 365 F&O",
            domain: "erp_financial",
            vendor: "Microsoft",
            description: "Import financial transactions, purchase orders, and work orders from Microsoft Dynamics 365 Finance & Operations via OData API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Dynamics 365 URL","placeholder":"https://yourorg.crm.dynamics.com","type":"text"},{"key":"tenant_id","label":"Azure Tenant ID","type":"text"},{"key":"client_id","label":"Client ID (App Registration)","type":"text"},{"key":"client_secret","label":"Client Secret","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "oracle-fusion-ebs",
            name: "Oracle Fusion / E-Business Suite",
            domain: "erp_financial",
            vendor: "Oracle",
            description: "Import financial data, purchase orders, and maintenance records from Oracle Fusion Cloud or E-Business Suite via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Oracle Instance URL","placeholder":"https://your-oracle-server","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "sap-s4hana-erp",
            name: "SAP S/4HANA ERP Financials",
            domain: "erp_financial",
            vendor: "SAP SE",
            description: "Import financial records, purchase orders, and procurement data from SAP S/4HANA Finance module via OData API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"SAP Server URL","placeholder":"https://your-sap-server","type":"text"},{"key":"sap_client","label":"SAP Client","placeholder":"100","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        // ── Ticketing (5) ─────────────────────────────────────────────────────
        TemplateSpec {
            slug: "bmc-helix-tickets",
            name: "BMC Helix ITSM",
            domain: "ticketing",
            vendor: "BMC Software",
            description: "Import incidents, change requests, and service tickets from BMC Helix ITSM (formerly Remedy) via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "ivanti-neurons-tickets",
            name: "Ivanti Neurons ITSM",
            domain: "ticketing",
            vendor: "Ivanti",
            description: "Import incident tickets, change requests, and problem records from Ivanti Neurons for ITSM via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "jira-service-management",
            name: "Jira Service Management",
            domain: "ticketing",
            vendor: "Atlassian",
            description: "Import service requests, incidents, and change tickets from Atlassian Jira Service Management via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Jira Instance URL","placeholder":"https://yourcompany.atlassian.net","type":"text"},{"key":"username","label":"Email Address","type":"text"},{"key":"api_token","label":"API Token","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "manageengine-servicedesk",
            name: "ManageEngine ServiceDesk Plus",
            domain: "ticketing",
            vendor: "ManageEngine (Zoho)",
            description: "Import service requests and ITSM tickets from ManageEngine ServiceDesk Plus via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"ServiceDesk Plus URL","placeholder":"https://your-sdp/api/v3","type":"text"},{"key":"api_key","label":"API Key (Technician Key)","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "servicenow-itsm",
            name: "ServiceNow ITSM",
            domain: "ticketing",
            vendor: "ServiceNow",
            description: "Import incidents, change requests, and CMDB records from ServiceNow IT Service Management via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"ServiceNow Instance URL","placeholder":"https://yourcompany.service-now.com","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        // ── Environmental (5) ─────────────────────────────────────────────────
        TemplateSpec {
            slug: "cority-ehs",
            name: "Cority EHS Management",
            domain: "environmental",
            vendor: "Cority",
            description: "Import environmental incidents, compliance events, and monitoring data from Cority EHS platform via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "enablon-environmental",
            name: "Enablon Environmental Management",
            domain: "environmental",
            vendor: "Wolters Kluwer",
            description: "Import environmental monitoring data, permit conditions, and compliance records from Enablon via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "intelex-environmental",
            name: "Intelex Environmental Management",
            domain: "environmental",
            vendor: "Intelex Technologies",
            description: "Import environmental incidents, audit findings, and compliance data from Intelex EHSQ platform via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "sap-ehs-environmental",
            name: "SAP EHS Environmental Compliance",
            domain: "environmental",
            vendor: "SAP SE",
            description: "Import environmental compliance records, waste management data, and permit data from SAP Environment Health & Safety via OData API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"SAP Server URL","placeholder":"https://your-sap-server","type":"text"},{"key":"sap_client","label":"SAP Client","placeholder":"100","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "sphera-environmental",
            name: "Sphera Environmental Compliance",
            domain: "environmental",
            vendor: "Sphera Solutions",
            description: "Import emissions monitoring, environmental KPIs, and compliance records from Sphera Operations Management via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        // ── LIMS / Lab (5) ────────────────────────────────────────────────────
        TemplateSpec {
            slug: "labvantage-lims",
            name: "LabVantage LIMS",
            domain: "lims_lab",
            vendor: "LabVantage Solutions",
            description: "Import laboratory samples, test results, and QC data from LabVantage LIMS via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "labware-lims",
            name: "LabWare LIMS / ELN",
            domain: "lims_lab",
            vendor: "LabWare",
            description: "Import sample results, stability studies, and QC data from LabWare LIMS or Electronic Lab Notebook via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "siemens-opcenter-quality",
            name: "Siemens Opcenter Quality",
            domain: "lims_lab",
            vendor: "Siemens",
            description: "Import quality control data, non-conformances, and inspection results from Siemens Opcenter Quality (formerly Camstar) via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "starlims-lims",
            name: "Abbott STARLIMS",
            domain: "lims_lab",
            vendor: "Abbott Informatics",
            description: "Import laboratory data, sample workflow results, and audit records from Abbott STARLIMS via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "thermo-samplemanager-lims",
            name: "Thermo Fisher SampleManager LIMS",
            domain: "lims_lab",
            vendor: "Thermo Fisher Scientific",
            description: "Import sample test results, specifications, and QC records from Thermo Fisher SampleManager LIMS via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        // ── Access Control (5) ────────────────────────────────────────────────
        TemplateSpec {
            slug: "ccure-9000-access",
            name: "C\u{2022}CURE 9000 Access Control",
            domain: "access_control",
            vendor: "Software House (Johnson Controls)",
            description: "Import badge events, access permissions, and cardholder data from C\u{2022}CURE 9000 security management system via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "gallagher-command-centre",
            name: "Gallagher Command Centre",
            domain: "access_control",
            vendor: "Gallagher Security",
            description: "Import cardholder events, access zones, and alarm events from Gallagher Command Centre via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Command Centre URL","placeholder":"https://gallagher-server/api","type":"text"},{"key":"api_key","label":"API Key","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "genetec-security-center",
            name: "Genetec Security Center",
            domain: "access_control",
            vendor: "Genetec",
            description: "Import cardholder access events and credential data from Genetec Security Center via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Security Center URL","placeholder":"https://your-genetec-server","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "honeywell-prowatch",
            name: "Honeywell Pro-Watch",
            domain: "access_control",
            vendor: "Honeywell Building Technologies",
            description: "Import access control events, badge transactions, and cardholder records from Honeywell Pro-Watch via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "lenel-onguard",
            name: "LenelS2 OnGuard",
            domain: "access_control",
            vendor: "LenelS2 (Carrier)",
            description: "Import cardholder access events and credential data from LenelS2 OnGuard physical security platform via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        // ── Regulatory (5) ────────────────────────────────────────────────────
        TemplateSpec {
            slug: "cority-regulatory",
            name: "Cority Regulatory Compliance",
            domain: "regulatory",
            vendor: "Cority",
            description: "Import regulatory filings, inspection records, and compliance tracking data from Cority regulatory modules via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "enablon-regulatory",
            name: "Enablon Regulatory Intelligence",
            domain: "regulatory",
            vendor: "Wolters Kluwer",
            description: "Import regulatory obligation tracking, compliance schedules, and audit records from Enablon via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "intelex-regulatory",
            name: "Intelex Regulatory Management",
            domain: "regulatory",
            vendor: "Intelex Technologies",
            description: "Import regulatory compliance records, inspection findings, and submission data from Intelex EHSQ platform via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "sap-ehs-regulatory",
            name: "SAP EHS Regulatory Compliance",
            domain: "regulatory",
            vendor: "SAP SE",
            description: "Import regulatory compliance requirements, substance records, and EHS reports from SAP EHS via OData API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"SAP Server URL","placeholder":"https://your-sap-server","type":"text"},{"key":"sap_client","label":"SAP Client","placeholder":"100","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "sphera-regulatory",
            name: "Sphera Regulatory Compliance",
            domain: "regulatory",
            vendor: "Sphera Solutions",
            description: "Import process safety management data, regulatory submissions, and compliance records from Sphera Operations Management via REST API.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        // ── DCS Supplemental (8) ──────────────────────────────────────────────────
        TemplateSpec {
            slug: "pi-web-api",
            name: "AVEVA PI Web API",
            domain: "dcs_supplemental",
            vendor: "AVEVA/OSIsoft",
            description: "Supplement OPC UA with PI tag metadata, engineering units, alarm limits, and alarm event frames from PI Web API. Primary integration path for PI Data Archive (no native OPC UA server).",
            target_tables: &["points_metadata", "events"],
            required_fields: r##"[{"key":"base_url","label":"PI Web API URL","placeholder":"https://pi-server/piwebapi","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "honeywell-experion-epdoc",
            name: "Honeywell Experion EPDOC REST",
            domain: "dcs_supplemental",
            vendor: "Honeywell",
            description: "Supplement OPC UA with full tag metadata, alarm limits, and alarm history from Honeywell Experion PKS via EPDOC REST API (R500+).",
            target_tables: &["points_metadata", "events"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "siemens-sph-rest",
            name: "Siemens SIMATIC Process Historian REST",
            domain: "dcs_supplemental",
            vendor: "Siemens",
            description: "Supplement OPC UA with tag metadata and alarm history from Siemens SIMATIC Process Historian (SPH 2019 Update 3+).",
            target_tables: &["points_metadata", "events"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "siemens-wincc-oa-rest",
            name: "Siemens WinCC OA REST",
            domain: "dcs_supplemental",
            vendor: "Siemens",
            description: "Supplement OPC UA with tag metadata and alarm history from Siemens WinCC OA (3.18+) via built-in REST API.",
            target_tables: &["points_metadata", "events"],
            required_fields: r##"[{"key":"hostname","label":"WinCC OA Server Hostname","type":"text"},{"key":"port","label":"REST API Port","placeholder":"8443","type":"number"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "abb-information-manager-rest",
            name: "ABB Information Manager REST",
            domain: "dcs_supplemental",
            vendor: "ABB",
            description: "Supplement OPC UA with tag metadata and alarm/event records from ABB 800xA Information Manager (3.5+) REST API.",
            target_tables: &["points_metadata", "events"],
            required_fields: r##"[{"key":"base_url","label":"Base URL","placeholder":"https://your-server/api","type":"text"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "kepware-rest",
            name: "Kepware KEPServerEX REST",
            domain: "dcs_supplemental",
            vendor: "PTC Kepware",
            description: "Supplement OPC UA with tag engineering units and descriptions from Kepware KEPServerEX Configuration REST API.",
            target_tables: &["points_metadata"],
            required_fields: r##"[{"key":"hostname","label":"KEPServerEX Hostname","placeholder":"kepware-server","type":"text"},{"key":"port","label":"Configuration API Port","placeholder":"57412","type":"number"},{"key":"username","label":"Username","type":"text"},{"key":"password","label":"Password","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "canary-labs-rest",
            name: "Canary Labs Historian REST",
            domain: "dcs_supplemental",
            vendor: "Canary Labs",
            description: "Supplement OPC UA with tag metadata and historical values from Canary Labs Historian (v22+) REST API.",
            target_tables: &["points_metadata"],
            required_fields: r##"[{"key":"base_url","label":"Canary Historian URL","placeholder":"http://canary-server:55236","type":"text"},{"key":"api_key","label":"API Token","type":"secret"}]"##,
        },
        TemplateSpec {
            slug: "deltav-event-chronicle",
            name: "Emerson DeltaV Event Chronicle (SQL)",
            domain: "dcs_supplemental",
            vendor: "Emerson",
            description: "Supplement OPC UA with alarm history and tag metadata from the DeltaV Event Chronicle SQL Server database on the Application Station. Uses mssql connection type.",
            target_tables: &["points_metadata", "events"],
            required_fields: r##"[{"key":"hostname","label":"SQL Server Hostname","placeholder":"deltav-appstation","type":"text"},{"key":"database","label":"Database Name","placeholder":"DeltaVEventChronicle","type":"text"},{"key":"username","label":"SQL Username","type":"text"},{"key":"password","label":"SQL Password","type":"secret"}]"##,
        },
    ];

    for t in templates {
        let target_tables: Vec<String> = t.target_tables.iter().map(|s| s.to_string()).collect();
        let required_fields_json: serde_json::Value =
            serde_json::from_str(t.required_fields).unwrap_or(serde_json::Value::Array(vec![]));
        let result = sqlx::query(
            "INSERT INTO connector_templates \
             (slug, name, domain, vendor, description, template_config, required_fields, target_tables, version) \
             VALUES ($1, $2, $3, $4, $5, '{}', $6, $7, '1.0') \
             ON CONFLICT (slug) DO UPDATE SET \
                 required_fields = EXCLUDED.required_fields, \
                 template_config = EXCLUDED.template_config, \
                 description = EXCLUDED.description",
        )
        .bind(t.slug)
        .bind(t.name)
        .bind(t.domain)
        .bind(t.vendor)
        .bind(t.description)
        .bind(&required_fields_json)
        .bind(&target_tables)
        .execute(db)
        .await;

        if let Err(e) = result {
            warn!(slug = t.slug, error = %e, "Failed to seed connector template");
        }
    }

    // ── Generic connector templates (with full template_config) ───────────────
    #[derive(Debug)]
    struct GenericTemplateSpec {
        slug: &'static str,
        name: &'static str,
        domain: &'static str,
        vendor: &'static str,
        description: &'static str,
        target_tables: &'static [&'static str],
        required_fields: &'static str,
        template_config: &'static str,
    }

    let generic_templates: &[GenericTemplateSpec] = &[
        GenericTemplateSpec {
            slug: "generic-csv-file",
            name: "CSV File Import",
            domain: "generic_file",
            vendor: "Generic",
            description: "Import data from an uploaded CSV file with configurable delimiter and header row.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[
                {"key":"file_id","label":"Uploaded File ID","placeholder":"UUID of the uploaded file","type":"text"},
                {"key":"delimiter","label":"Delimiter","type":"select","options":[
                    {"value":",","label":"Comma (,)"},
                    {"value":";","label":"Semicolon (;)"},
                    {"value":"|","label":"Pipe (|)"}
                ]},
                {"key":"has_header","label":"First Row is Header","type":"select","options":[
                    {"value":"true","label":"Yes"},
                    {"value":"false","label":"No"}
                ]}
            ]"##,
            template_config: r##"{
                "connection": {},
                "auth_type": "none",
                "auth_config": {},
                "definitions": [{
                    "name": "CSV File Import",
                    "source_config": {
                        "source_type": "csv_file",
                        "file_id": "{{file_id}}",
                        "delimiter": "{{delimiter}}",
                        "has_header": true,
                        "skip_rows": 0
                    },
                    "target_table": "custom_import_data"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "generic-tsv-file",
            name: "TSV File Import",
            domain: "generic_file",
            vendor: "Generic",
            description: "Import data from an uploaded tab-separated values (TSV) file.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[
                {"key":"file_id","label":"Uploaded File ID","placeholder":"UUID of the uploaded file","type":"text"},
                {"key":"has_header","label":"First Row is Header","type":"select","options":[
                    {"value":"true","label":"Yes"},
                    {"value":"false","label":"No"}
                ]}
            ]"##,
            template_config: r##"{
                "connection": {},
                "auth_type": "none",
                "auth_config": {},
                "definitions": [{
                    "name": "TSV File Import",
                    "source_config": {
                        "source_type": "tsv_file",
                        "file_id": "{{file_id}}",
                        "has_header": true,
                        "skip_rows": 0
                    },
                    "target_table": "custom_import_data"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "generic-excel-file",
            name: "Excel (XLSX) File Import",
            domain: "generic_file",
            vendor: "Generic",
            description: "Import data from an uploaded Excel xlsx or xls file. Specify a sheet name or leave blank to use the first sheet.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[
                {"key":"file_id","label":"Uploaded File ID","placeholder":"UUID of the uploaded file","type":"text"},
                {"key":"sheet_name","label":"Sheet Name","placeholder":"Sheet1 (blank = first sheet)","type":"text"},
                {"key":"header_row","label":"Header Row Index","placeholder":"0","type":"number"}
            ]"##,
            template_config: r##"{
                "connection": {},
                "auth_type": "none",
                "auth_config": {},
                "definitions": [{
                    "name": "Excel File Import",
                    "source_config": {
                        "source_type": "excel_file",
                        "file_id": "{{file_id}}",
                        "sheet_name": "{{sheet_name}}",
                        "header_row": 0
                    },
                    "target_table": "custom_import_data"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "generic-json-file",
            name: "JSON File Import",
            domain: "generic_file",
            vendor: "Generic",
            description: "Import data from an uploaded JSON file (array or NDJSON). Use records_path to navigate to a nested array.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[
                {"key":"file_id","label":"Uploaded File ID","placeholder":"UUID of the uploaded file","type":"text"},
                {"key":"format","label":"Format","type":"select","options":[
                    {"value":"array","label":"JSON Array"},
                    {"value":"ndjson","label":"NDJSON (one object per line)"}
                ]},
                {"key":"records_path","label":"Records Path","placeholder":"data.items (blank = root)","type":"text"}
            ]"##,
            template_config: r##"{
                "connection": {},
                "auth_type": "none",
                "auth_config": {},
                "definitions": [{
                    "name": "JSON File Import",
                    "source_config": {
                        "source_type": "json_file",
                        "file_id": "{{file_id}}",
                        "format": "{{format}}",
                        "records_path": "{{records_path}}"
                    },
                    "target_table": "custom_import_data"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "generic-xml-file",
            name: "XML File Import",
            domain: "generic_file",
            vendor: "Generic",
            description: "Import data from an uploaded XML file. Specify the element name that wraps each record and which child elements to extract as fields.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[
                {"key":"file_id","label":"Uploaded File ID","placeholder":"UUID of the uploaded file","type":"text"},
                {"key":"record_element","label":"Record Element Name","placeholder":"item","type":"text"},
                {"key":"field_elements","label":"Field Elements (comma-separated, blank = all)","placeholder":"Name,Value,Status","type":"text"}
            ]"##,
            template_config: r##"{
                "connection": {},
                "auth_type": "none",
                "auth_config": {},
                "definitions": [{
                    "name": "XML File Import",
                    "source_config": {
                        "source_type": "xml_file",
                        "file_id": "{{file_id}}",
                        "record_element": "{{record_element}}"
                    },
                    "target_table": "custom_import_data"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "generic-postgresql",
            name: "PostgreSQL Database",
            domain: "generic_database",
            vendor: "Generic",
            description: "Import data from a PostgreSQL database by executing a custom SQL query. Credentials are stored encrypted.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[
                {"key":"host","label":"Host","placeholder":"localhost","type":"text"},
                {"key":"port","label":"Port","placeholder":"5432","type":"number"},
                {"key":"database","label":"Database Name","placeholder":"mydb","type":"text"},
                {"key":"username","label":"Username","placeholder":"postgres","type":"text"},
                {"key":"password","label":"Password","type":"secret"},
                {"key":"ssl_mode","label":"SSL Mode","type":"select","options":[
                    {"value":"prefer","label":"Prefer"},
                    {"value":"require","label":"Require"},
                    {"value":"disable","label":"Disable"}
                ]},
                {"key":"query","label":"SQL Query","placeholder":"SELECT * FROM my_table WHERE updated_at > '2024-01-01'","type":"textarea"}
            ]"##,
            template_config: r##"{
                "connection": {
                    "host": "{{host}}",
                    "port": 5432,
                    "database": "{{database}}",
                    "username": "{{username}}",
                    "ssl_mode": "{{ssl_mode}}"
                },
                "auth_type": "password",
                "auth_config": {"password": "{{password}}"},
                "definitions": [{
                    "name": "PostgreSQL Query",
                    "source_config": {
                        "source_type": "postgresql",
                        "query": "{{query}}"
                    },
                    "target_table": "custom_import_data"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "generic-mysql",
            name: "MySQL / MariaDB Database",
            domain: "generic_database",
            vendor: "Generic",
            description: "Import data from a MySQL or MariaDB database by executing a custom SQL query. Credentials are stored encrypted.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[
                {"key":"host","label":"Host","placeholder":"localhost","type":"text"},
                {"key":"port","label":"Port","placeholder":"3306","type":"number"},
                {"key":"database","label":"Database Name","placeholder":"mydb","type":"text"},
                {"key":"username","label":"Username","placeholder":"root","type":"text"},
                {"key":"password","label":"Password","type":"secret"},
                {"key":"query","label":"SQL Query","placeholder":"SELECT * FROM my_table","type":"textarea"}
            ]"##,
            template_config: r##"{
                "connection": {
                    "host": "{{host}}",
                    "port": 3306,
                    "database": "{{database}}",
                    "username": "{{username}}"
                },
                "auth_type": "password",
                "auth_config": {"password": "{{password}}"},
                "definitions": [{
                    "name": "MySQL Query",
                    "source_config": {
                        "source_type": "mysql",
                        "query": "{{query}}"
                    },
                    "target_table": "custom_import_data"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "generic-mssql",
            name: "Microsoft SQL Server",
            domain: "generic_database",
            vendor: "Generic",
            description: "Import data from a Microsoft SQL Server database by executing a custom SQL query. Credentials are stored encrypted.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[
                {"key":"host","label":"Host","placeholder":"localhost","type":"text"},
                {"key":"port","label":"Port","placeholder":"1433","type":"number"},
                {"key":"database","label":"Database Name","placeholder":"master","type":"text"},
                {"key":"username","label":"Username","placeholder":"sa","type":"text"},
                {"key":"password","label":"Password","type":"secret"},
                {"key":"ssl_mode","label":"Encryption","type":"select","options":[
                    {"value":"required","label":"Required"},
                    {"value":"disable","label":"Disable"}
                ]},
                {"key":"query","label":"SQL Query","placeholder":"SELECT * FROM dbo.MyTable","type":"textarea"}
            ]"##,
            template_config: r##"{
                "connection": {
                    "host": "{{host}}",
                    "port": 1433,
                    "database": "{{database}}",
                    "username": "{{username}}",
                    "ssl_mode": "{{ssl_mode}}"
                },
                "auth_type": "password",
                "auth_config": {"password": "{{password}}"},
                "definitions": [{
                    "name": "MSSQL Query",
                    "source_config": {
                        "source_type": "mssql",
                        "query": "{{query}}"
                    },
                    "target_table": "custom_import_data"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "generic-odbc",
            name: "ODBC Database (Snowflake, DB2, Teradata, etc.)",
            domain: "generic_database",
            vendor: "Generic",
            description: "Import data from any ODBC-accessible database (Snowflake, IBM DB2, Teradata, SAP HANA, etc.) using a DSN-less connection string and a custom SQL query. Requires unixODBC and the appropriate driver installed on the server.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[
                {"key":"connection_string","label":"ODBC Connection String","placeholder":"Driver={ODBC Driver 18 for SQL Server};Server=host;Database=db;","type":"textarea"},
                {"key":"query","label":"SQL Query","placeholder":"SELECT * FROM my_table","type":"textarea"}
            ]"##,
            template_config: r##"{
                "connection": {"connection_string": "{{connection_string}}"},
                "auth_type": "none",
                "auth_config": {},
                "definitions": [{
                    "name": "ODBC Query",
                    "source_config": {
                        "source_type": "odbc",
                        "query": "{{query}}",
                        "max_rows": 50000
                    },
                    "target_table": "custom_import_data"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "generic-sftp",
            name: "SFTP / FTP File Import",
            domain: "generic_file",
            vendor: "Generic",
            description: "Download a file from a remote SFTP server and import it using the appropriate file parser (CSV, TSV, JSON, XML, Excel). Password authentication only; key-based auth planned for a future release.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[
                {"key":"host","label":"SFTP Host","placeholder":"sftp.example.com","type":"text"},
                {"key":"port","label":"Port","placeholder":"22","type":"number"},
                {"key":"username","label":"Username","type":"text"},
                {"key":"password","label":"Password","type":"secret"},
                {"key":"remote_path","label":"Remote File Path","placeholder":"/exports/daily.csv","type":"text"},
                {"key":"file_format","label":"File Format","type":"select","options":[
                    {"value":"csv","label":"CSV"},
                    {"value":"tsv","label":"TSV"},
                    {"value":"json","label":"JSON"},
                    {"value":"xml","label":"XML"},
                    {"value":"excel","label":"Excel (XLSX)"}
                ]}
            ]"##,
            template_config: r##"{
                "connection": {
                    "host": "{{host}}",
                    "port": 22,
                    "protocol": "sftp",
                    "username": "{{username}}"
                },
                "auth_type": "password",
                "auth_config": {"password": "{{password}}"},
                "definitions": [{
                    "name": "SFTP File Import",
                    "source_config": {
                        "source_type": "sftp",
                        "remote_path": "{{remote_path}}",
                        "file_format": "{{file_format}}"
                    },
                    "target_table": "custom_import_data"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "generic-mongodb",
            name: "MongoDB Collection Import",
            domain: "generic_database",
            vendor: "Generic",
            description: "Import documents from a MongoDB collection with optional filter and projection. Connection string may include credentials; stored encrypted.",
            target_tables: &["custom_import_data"],
            required_fields: r##"[
                {"key":"connection_string","label":"MongoDB Connection String","placeholder":"mongodb://host:27017","type":"textarea"},
                {"key":"database","label":"Database Name","placeholder":"production","type":"text"},
                {"key":"collection","label":"Collection Name","placeholder":"work_orders","type":"text"},
                {"key":"filter","label":"Filter (JSON, optional)","placeholder":"{\"status\":\"open\"}","type":"textarea"}
            ]"##,
            template_config: r##"{
                "connection": {
                    "connection_string": "{{connection_string}}",
                    "database": "{{database}}"
                },
                "auth_type": "none",
                "auth_config": {},
                "definitions": [{
                    "name": "MongoDB Collection Import",
                    "source_config": {
                        "source_type": "mongodb",
                        "collection": "{{collection}}",
                        "filter": {},
                        "max_rows": 50000
                    },
                    "target_table": "custom_import_data"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "generic-shift-csv",
            name: "Shift Schedule CSV Import",
            domain: "shift_management",
            vendor: "Generic",
            description: "Import shift schedules from a CSV file. Expected columns: shift_name, employee_id, start_time (ISO-8601), end_time (ISO-8601), role_label, crew_name, external_id.",
            target_tables: &["shifts", "shift_assignments"],
            required_fields: r##"[
                {"key":"file_id","label":"Uploaded File ID","placeholder":"UUID of the uploaded CSV file","type":"text"},
                {"key":"source_system","label":"Source System Name","placeholder":"e.g. kronos, sap","type":"text"},
                {"key":"delimiter","label":"Delimiter","type":"select","options":[
                    {"value":",","label":"Comma (,)"},
                    {"value":";","label":"Semicolon (;)"},
                    {"value":"|","label":"Pipe (|)"}
                ]}
            ]"##,
            template_config: r##"{
                "connection": {},
                "auth_type": "none",
                "auth_config": {},
                "definitions": [{
                    "name": "Shift Schedule CSV Import",
                    "source_config": {
                        "source_type": "csv_file",
                        "file_id": "{{file_id}}",
                        "delimiter": "{{delimiter}}",
                        "has_header": true,
                        "skip_rows": 0,
                        "source_system": "{{source_system}}"
                    },
                    "field_mappings": [
                        {"source": "shift_name", "target": "name"},
                        {"source": "employee_id", "target": "employee_id"},
                        {"source": "start_time", "target": "start_time"},
                        {"source": "end_time", "target": "end_time"},
                        {"source": "role_label", "target": "role_label"},
                        {"source": "crew_name", "target": "crew_name"},
                        {"source": "external_id", "target": "external_id"}
                    ],
                    "target_table": "shifts"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "generic-shift-rest",
            name: "Shift Schedule REST Import",
            domain: "shift_management",
            vendor: "Generic",
            description: "Import shift schedules from a REST API endpoint. Configure the endpoint URL, authentication, and JSON path to records array.",
            target_tables: &["shifts", "shift_assignments"],
            required_fields: r##"[
                {"key":"base_url","label":"Base URL","placeholder":"https://your-wfm-server/api","type":"text"},
                {"key":"endpoint","label":"Schedule Endpoint","placeholder":"/shifts","type":"text"},
                {"key":"records_path","label":"JSON Path to Records","placeholder":"data.shifts","type":"text"},
                {"key":"source_system","label":"Source System Name","placeholder":"e.g. kronos, custom","type":"text"},
                {"key":"username","label":"Username (optional)","type":"text"},
                {"key":"password","label":"Password (optional)","type":"secret"}
            ]"##,
            template_config: r##"{
                "connection": {
                    "base_url": "{{base_url}}"
                },
                "auth_type": "basic",
                "auth_config": {
                    "username": "{{username}}",
                    "password": "{{password}}"
                },
                "definitions": [{
                    "name": "Shift Schedule REST Import",
                    "source_config": {
                        "source_type": "generic_rest",
                        "endpoint": "{{endpoint}}",
                        "method": "GET",
                        "records_path": "{{records_path}}",
                        "pagination": "none",
                        "source_system": "{{source_system}}"
                    },
                    "field_mappings": [
                        {"source": "name", "target": "name"},
                        {"source": "employee_id", "target": "employee_id"},
                        {"source": "start_time", "target": "start_time"},
                        {"source": "end_time", "target": "end_time"},
                        {"source": "role_label", "target": "role_label"},
                        {"source": "crew_name", "target": "crew_name"},
                        {"source": "external_id", "target": "external_id"}
                    ],
                    "target_table": "shifts"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "ukg-pro-wfm-shifts",
            name: "UKG Pro WFM Shift Schedules",
            domain: "shift_management",
            vendor: "UKG (Kronos)",
            description: "Import shift schedules and personnel assignments from UKG Pro Workforce Management (formerly Kronos Workforce Central/Dimensions) via the REST API.",
            target_tables: &["shifts", "shift_assignments"],
            required_fields: r##"[
                {"key":"base_url","label":"UKG Tenant URL","placeholder":"https://your-tenant.mykronos.com","type":"text"},
                {"key":"username","label":"API Username","type":"text"},
                {"key":"password","label":"API Password","type":"secret"},
                {"key":"client_id","label":"OAuth Client ID","type":"text"},
                {"key":"client_secret","label":"OAuth Client Secret","type":"secret"},
                {"key":"app_key","label":"App Key (optional, older tenants)","type":"text"},
                {"key":"hyperfind","label":"Hyperfind Qualifier","placeholder":"All Home","type":"text"},
                {"key":"source_system","label":"Source System Name","placeholder":"ukg","type":"text"}
            ]"##,
            template_config: r##"{
                "connection": {
                    "base_url": "{{base_url}}",
                    "app_key": "{{app_key}}"
                },
                "auth_type": "custom_token",
                "auth_config": {
                    "username": "{{username}}",
                    "password": "{{password}}",
                    "client_id": "{{client_id}}",
                    "client_secret": "{{client_secret}}"
                },
                "definitions": [{
                    "name": "UKG Shift Schedules",
                    "source_config": {
                        "source_type": "ukg_wfm",
                        "hyperfind_qualifier": "{{hyperfind}}",
                        "source_system": "{{source_system}}",
                        "watermark_column": "end_time",
                        "watermark_type": "timestamp"
                    },
                    "field_mappings": [
                        {"source": "name", "target": "name"},
                        {"source": "external_id", "target": "external_id"},
                        {"source": "start_time", "target": "start_time"},
                        {"source": "end_time", "target": "end_time"},
                        {"source": "employee_id", "target": "employee_id"},
                        {"source": "role_label", "target": "role_label"},
                        {"source": "shift_external_id", "target": "shift_external_id"}
                    ],
                    "target_table": "shifts"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "shiftboard-shifts",
            name: "Shiftboard SchedulePro Shifts",
            domain: "shift_management",
            vendor: "Shiftboard",
            description: "Import shift schedules from Shiftboard SchedulePro via JSON-RPC 2.0 API with HMAC-SHA1 authentication.",
            target_tables: &["shifts", "shift_assignments"],
            required_fields: r##"[
                {"key":"access_key_id","label":"Access Key ID","type":"text"},
                {"key":"secret_key","label":"Secret Key","type":"secret"},
                {"key":"base_url","label":"API Base URL","placeholder":"https://api.shiftboard.com/","type":"text"},
                {"key":"source_system","label":"Source System Name","placeholder":"shiftboard","type":"text"}
            ]"##,
            template_config: r##"{
                "connection": {
                    "base_url": "{{base_url}}"
                },
                "auth_type": "custom_token",
                "auth_config": {
                    "access_key_id": "{{access_key_id}}",
                    "secret_key": "{{secret_key}}"
                },
                "definitions": [{
                    "name": "Shiftboard Shift Schedules",
                    "source_config": {
                        "source_type": "shiftboard_jsonrpc",
                        "source_system": "{{source_system}}",
                        "watermark_column": "end_time",
                        "watermark_type": "timestamp"
                    },
                    "field_mappings": [
                        {"source": "name", "target": "name"},
                        {"source": "external_id", "target": "external_id"},
                        {"source": "start_time", "target": "start_time"},
                        {"source": "end_time", "target": "end_time"},
                        {"source": "employee_id", "target": "employee_id"},
                        {"source": "role_label", "target": "role_label"},
                        {"source": "shift_external_id", "target": "shift_external_id"},
                        {"source": "crew_name", "target": "crew_name"}
                    ],
                    "target_table": "shifts"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "sap-sf-shift-schedules",
            name: "SAP SuccessFactors Work Schedules",
            domain: "shift_management",
            vendor: "SAP SE",
            description: "Import employee work schedules and roster data from SAP SuccessFactors Employee Central via OData V2 API.",
            target_tables: &["shifts", "shift_assignments"],
            required_fields: r##"[
                {"key":"api_server","label":"API Server","placeholder":"https://apiN.successfactors.com","type":"text"},
                {"key":"company_id","label":"Company ID (Tenant)","type":"text"},
                {"key":"username","label":"API Username","type":"text"},
                {"key":"password","label":"Password","type":"secret"},
                {"key":"source_system","label":"Source System Name","placeholder":"sap_sf","type":"text"}
            ]"##,
            template_config: r##"{
                "connection": {
                    "base_url": "{{api_server}}/odata/v2"
                },
                "auth_type": "basic",
                "auth_config": {
                    "username": "{{username}}@{{company_id}}",
                    "password": "{{password}}"
                },
                "definitions": [{
                    "name": "SAP SF Work Schedules",
                    "source_config": {
                        "source_type": "generic_rest",
                        "endpoint": "/EmpJob?$expand=workScheduleNav,userNav&$filter=emplStatus eq 'A'&$select=userId,startDate,department,jobTitle,workScheduleCode,workScheduleNav/externalCode,workScheduleNav/startTime,workScheduleNav/endTime,userNav/firstName,userNav/lastName&$format=json",
                        "method": "GET",
                        "records_path": "d.results",
                        "pagination": "offset_limit",
                        "page_size": 100,
                        "offset_param": "$skip",
                        "limit_param": "$top",
                        "source_system": "{{source_system}}"
                    },
                    "field_mappings": [
                        {"source": "userId", "target": "employee_id"},
                        {"source": "workScheduleNav.externalCode", "target": "external_id"},
                        {"source": "workScheduleNav.startTime", "target": "start_time"},
                        {"source": "workScheduleNav.endTime", "target": "end_time"},
                        {"source": "jobTitle", "target": "role_label"},
                        {"source": "department", "target": "crew_name"},
                        {"source": "workScheduleCode", "target": "name"}
                    ],
                    "target_table": "shifts"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "oracle-p6-turnaround-schedules",
            name: "Oracle Primavera P6 Turnaround Schedules",
            domain: "shift_management",
            vendor: "Oracle",
            description: "Import turnaround/shutdown craft labor schedules from Oracle Primavera P6 EPPM. Activities map to shifts; labor resource assignments map to personnel assignments.",
            target_tables: &["shifts", "shift_assignments"],
            required_fields: r##"[
                {"key":"server_url","label":"P6 Server URL","placeholder":"https://your-p6-server/p6ws/restapi","type":"text"},
                {"key":"username","label":"Username","type":"text"},
                {"key":"password","label":"Password","type":"secret"},
                {"key":"project_filter","label":"Project Filter (optional)","placeholder":"Status:eq:'Active'","type":"text"},
                {"key":"source_system","label":"Source System Name","placeholder":"oracle_p6","type":"text"}
            ]"##,
            template_config: r##"{
                "connection": {
                    "base_url": "{{server_url}}"
                },
                "auth_type": "basic",
                "auth_config": {
                    "username": "{{username}}",
                    "password": "{{password}}"
                },
                "definitions": [{
                    "name": "P6 Resource Assignments (Labor)",
                    "source_config": {
                        "source_type": "generic_rest",
                        "endpoint": "/resourceAssignment?Fields=ResourceName,ActivityName,PlannedStartDate,PlannedFinishDate,ActualStartDate,ActualFinishDate,ResourceType,ResourceObjectId&Filter=ResourceType:eq:'Labor'",
                        "method": "GET",
                        "records_path": "",
                        "pagination": "none",
                        "source_system": "{{source_system}}"
                    },
                    "field_mappings": [
                        {"source": "ActivityName", "target": "name"},
                        {"source": "ResourceObjectId", "target": "external_id"},
                        {"source": "PlannedStartDate", "target": "start_time"},
                        {"source": "PlannedFinishDate", "target": "end_time"},
                        {"source": "ResourceName", "target": "employee_id"},
                        {"source": "ActivityName", "target": "role_label"}
                    ],
                    "target_table": "shifts"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "hexagon-j5-logbook",
            name: "Hexagon j5 Shift Logbook",
            domain: "shift_management",
            vendor: "Hexagon",
            description: "Import shift logbook entries, handover notes, and operator rounds from Hexagon j5 Operations Management Suite. Entries are correlated to shifts by timestamp.",
            target_tables: &["shift_log_entries"],
            required_fields: r##"[
                {"key":"server_url","label":"j5 Server URL","placeholder":"https://your-j5-server/restserver/28.0","type":"text"},
                {"key":"username","label":"Username","type":"text"},
                {"key":"password","label":"Password","type":"secret"},
                {"key":"logbook_name","label":"Logbook Name","placeholder":"general_logbook","type":"text"},
                {"key":"source_system","label":"Source System Name","placeholder":"hexagon_j5","type":"text"}
            ]"##,
            template_config: r##"{
                "connection": {
                    "base_url": "{{server_url}}"
                },
                "auth_type": "basic",
                "auth_config": {
                    "username": "{{username}}",
                    "password": "{{password}}"
                },
                "definitions": [{
                    "name": "j5 Logbook Entries",
                    "source_config": {
                        "source_type": "generic_rest",
                        "endpoint": "/industraform/logbook-query-v2/{{logbook_name}}?attribute_names=$Form.Area,$Form.Status,EventTime,CreatedByUser.DisplayValue,Summary",
                        "method": "GET",
                        "records_path": "values",
                        "pagination": "cursor",
                        "cursor_field": "nextLink",
                        "source_system": "{{source_system}}"
                    },
                    "field_mappings": [
                        {"source": "EventTime", "target": "event_time"},
                        {"source": "$Form.Area", "target": "area"},
                        {"source": "CreatedByUser.DisplayValue", "target": "author"},
                        {"source": "Summary", "target": "summary"},
                        {"source": "$Form.Status", "target": "status"}
                    ],
                    "target_table": "shift_log_entries"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "generic-rest-api",
            name: "Generic REST API",
            domain: "generic_api",
            vendor: "Generic",
            description: "Import data from any REST API endpoint with configurable authentication (none, basic, bearer token, API key header) and pagination (none, cursor, offset/limit).",
            target_tables: &["custom_import_data"],
            required_fields: r##"[
                {"key":"base_url","label":"Base URL","placeholder":"https://api.example.com","type":"text"},
                {"key":"auth_type","label":"Authentication Type","type":"select","options":[
                    {"value":"none","label":"None"},
                    {"value":"basic","label":"Basic Auth"},
                    {"value":"bearer_token","label":"Bearer Token"},
                    {"value":"api_key_header","label":"API Key (Header)"}
                ]},
                {"key":"username","label":"Username (Basic Auth)","type":"text"},
                {"key":"password","label":"Password (Basic Auth)","type":"secret"},
                {"key":"bearer_token","label":"Bearer Token","type":"secret"},
                {"key":"api_key","label":"API Key","type":"secret"},
                {"key":"api_key_header_name","label":"API Key Header Name","placeholder":"X-Api-Key","type":"text"}
            ]"##,
            template_config: r##"{
                "connection": {"base_url": "{{base_url}}"},
                "auth_type": "{{auth_type}}",
                "auth_config": {
                    "username": "{{username}}",
                    "password": "{{password}}",
                    "bearer_token": "{{bearer_token}}",
                    "api_key": "{{api_key}}",
                    "api_key_header_name": "{{api_key_header_name}}"
                },
                "definitions": [{
                    "name": "REST API Import",
                    "source_config": {
                        "source_type": "generic_rest",
                        "endpoint": "",
                        "method": "GET",
                        "records_path": "",
                        "pagination_type": "none",
                        "max_pages": 100
                    },
                    "target_table": "custom_import_data"
                }]
            }"##,
        },
    ];

    for t in generic_templates {
        let target_tables: Vec<String> = t.target_tables.iter().map(|s| s.to_string()).collect();
        let required_fields_json: serde_json::Value =
            serde_json::from_str(t.required_fields).unwrap_or(serde_json::Value::Array(vec![]));
        let template_config_json: serde_json::Value = serde_json::from_str(t.template_config)
            .unwrap_or(serde_json::Value::Object(Default::default()));
        let result = sqlx::query(
            "INSERT INTO connector_templates \
             (slug, name, domain, vendor, description, template_config, required_fields, target_tables, version) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '1.0') \
             ON CONFLICT (slug) DO UPDATE SET \
                 required_fields = EXCLUDED.required_fields, \
                 template_config = EXCLUDED.template_config, \
                 description = EXCLUDED.description",
        )
        .bind(t.slug)
        .bind(t.name)
        .bind(t.domain)
        .bind(t.vendor)
        .bind(t.description)
        .bind(&template_config_json)
        .bind(&required_fields_json)
        .bind(&target_tables)
        .execute(db)
        .await;

        if let Err(e) = result {
            warn!(slug = t.slug, error = %e, "Failed to seed generic connector template");
        }
    }

    info!("Connector templates seeded");
}
