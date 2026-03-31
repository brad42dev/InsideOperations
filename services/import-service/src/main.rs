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
    tokio::spawn(run_import_scheduler(db.clone()));

    let app_state = AppState {
        db,
        config: Arc::new(cfg),
    };

    let mut health = io_health::HealthRegistry::new("import-service", env!("CARGO_PKG_VERSION"));
    health.register(io_health::PgDatabaseCheck::new(app_state.db.clone()));
    health.mark_startup_complete();

    let api = handlers::import::import_routes()
        .layer(middleware::from_fn_with_state(
            app_state.clone(),
            service_secret_middleware,
        ))
        .with_state(app_state);

    let app = api
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

/// Spawned at startup; polls all enabled supplemental connectors every 5 minutes.
async fn run_supplemental_connectors(db: sqlx::PgPool, master_key: [u8; 32]) {
    let mut interval = tokio::time::interval(Duration::from_secs(300));
    loop {
        interval.tick().await;
        if let Err(e) = poll_supplemental_connectors(&db, &master_key).await {
            warn!("supplemental connector poll error: {e}");
        }
    }
}

async fn poll_supplemental_connectors(
    db: &sqlx::PgPool,
    master_key: &[u8; 32],
) -> anyhow::Result<()> {
    use sqlx::Row as _;

    let rows = sqlx::query(
        "SELECT id, connection_type, config, auth_type, auth_config, point_source_id \
         FROM import_connections \
         WHERE is_supplemental_connector = true AND enabled = true",
    )
    .fetch_all(db)
    .await?;

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

        let cfg = connectors::extract_connector_config(conn_id, &config, &auth_type, &auth_config);
        let since = chrono::Utc::now() - chrono::Duration::minutes(10);

        // Fetch and write metadata
        match connector.fetch_metadata(&cfg).await {
            Ok(items) => {
                if let Err(e) =
                    connectors::db_writes::write_supplemental_metadata(db, source_id, &items).await
                {
                    warn!(conn_id = %conn_id, "write_supplemental_metadata error: {e}");
                }
            }
            Err(e) => {
                warn!(conn_id = %conn_id, conn_type = %conn_type, "fetch_metadata error: {e}")
            }
        }

        // Fetch and write events
        match connector.fetch_events(&cfg, since).await {
            Ok(events) => {
                if let Err(e) =
                    connectors::db_writes::write_supplemental_events(db, source_id, &events).await
                {
                    warn!(conn_id = %conn_id, "write_supplemental_events error: {e}");
                }
            }
            Err(e) => warn!(conn_id = %conn_id, conn_type = %conn_type, "fetch_events error: {e}"),
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// General import scheduler
// ---------------------------------------------------------------------------

/// Spawned at startup; polls `import_schedules` every 30 seconds and claims
/// due schedules using `FOR UPDATE SKIP LOCKED` to prevent duplicate execution.
async fn run_import_scheduler(db: sqlx::PgPool) {
    let mut interval = tokio::time::interval(Duration::from_secs(30));
    loop {
        interval.tick().await;
        if let Err(e) = poll_import_schedules(&db).await {
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
async fn poll_import_schedules(db: &sqlx::PgPool) -> anyhow::Result<()> {
    use sqlx::Row as _;
    use std::str::FromStr as _;

    loop {
        // Claim one schedule per iteration; loop until none remain.
        let mut tx = db.begin().await?;

        let row_opt = sqlx::query(
            "SELECT s.id, s.definition_id, s.schedule_type, \
                    s.cron_expression, s.interval_seconds \
             FROM import_schedules s \
             WHERE s.enabled = true \
               AND s.next_run_at <= NOW() \
               AND (s.running = false \
                    OR s.last_heartbeat_at < NOW() - INTERVAL '5 minutes') \
             ORDER BY s.next_run_at \
             FOR UPDATE SKIP LOCKED \
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
        let interval_seconds: Option<i64> = row.try_get("interval_seconds").ok().flatten();

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

        // --- ETL execution (outside the claim transaction) -------------------
        //
        // Create a new import_run record and execute the pipeline.
        let run_id = uuid::Uuid::new_v4();

        // Insert the run record (status: pending → pipeline::execute sets it to running).
        let insert_result = sqlx::query(
            "INSERT INTO import_runs \
             (id, import_definition_id, status, trigger, created_at) \
             VALUES ($1, $2, 'pending', 'scheduled', NOW())",
        )
        .bind(run_id)
        .bind(definition_id)
        .execute(db)
        .await;

        if let Err(e) = insert_result {
            warn!(
                schedule_id = %schedule_id,
                definition_id = %definition_id,
                "failed to create import_run for scheduled job: {e}"
            );
        } else {
            // Spawn the ETL pipeline; heartbeat updates run inside the spawned task.
            let db_clone = db.clone();
            tokio::spawn(async move {
                if let Err(e) = pipeline::execute(&db_clone, run_id, definition_id, false).await {
                    warn!(
                        run_id = %run_id,
                        definition_id = %definition_id,
                        "scheduled pipeline execution failed: {e}"
                    );
                }
            });
        }

        // --- Advance next_run_at and clear running flag ----------------------
        //
        // Compute the next scheduled time based on schedule_type.
        let next_run_at: Option<chrono::DateTime<chrono::Utc>> = match schedule_type.as_str() {
            "cron" => {
                cron_expression
                    .as_deref()
                    .and_then(|expr| match cron::Schedule::from_str(expr) {
                        Ok(sched) => sched.upcoming(chrono::Utc).next(),
                        Err(e) => {
                            warn!(
                                schedule_id = %schedule_id,
                                expression = expr,
                                "invalid cron expression: {e}"
                            );
                            None
                        }
                    })
            }
            "interval" => {
                interval_seconds.map(|secs| chrono::Utc::now() + chrono::Duration::seconds(secs))
            }
            other => {
                warn!(schedule_id = %schedule_id, schedule_type = other, "unknown schedule_type; skipping next_run_at update");
                None
            }
        };

        if let Some(next) = next_run_at {
            let _ = sqlx::query(
                "UPDATE import_schedules \
                 SET running = false, last_heartbeat_at = NOW(), next_run_at = $2 \
                 WHERE id = $1",
            )
            .bind(schedule_id)
            .bind(next)
            .execute(db)
            .await
            .map_err(|e| warn!(schedule_id = %schedule_id, "failed to advance next_run_at: {e}"));
        } else {
            // Could not compute next run — just clear the running flag.
            let _ = sqlx::query(
                "UPDATE import_schedules \
                 SET running = false, last_heartbeat_at = NOW() \
                 WHERE id = $1",
            )
            .bind(schedule_id)
            .execute(db)
            .await
            .map_err(|e| warn!(schedule_id = %schedule_id, "failed to clear running flag: {e}"));
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
             ON CONFLICT (slug) DO UPDATE SET required_fields = EXCLUDED.required_fields",
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

    info!("Connector templates seeded");
}
