pub type DbPool = sqlx::PgPool;

/// Create a PostgreSQL connection pool.
///
/// Pool size is read from the `IO_DB_MAX_CONNECTIONS` environment variable
/// (default: 20).  For the 200-concurrent-user target with 11 services, set
/// this to 10–15 per service so the total stays under PostgreSQL's `max_connections`
/// (typically 100–200 for a default install).
pub async fn create_pool(database_url: &str) -> Result<DbPool, sqlx::Error> {
    let max_connections: u32 = std::env::var("IO_DB_MAX_CONNECTIONS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(20);

    sqlx::postgres::PgPoolOptions::new()
        .max_connections(max_connections)
        .acquire_timeout(std::time::Duration::from_secs(5))
        // Recycle connections after 30 minutes to avoid stale TCP state
        .max_lifetime(std::time::Duration::from_secs(1800))
        // Drop idle connections after 10 minutes
        .idle_timeout(std::time::Duration::from_secs(600))
        .connect(database_url)
        .await
}

/// Run all pending SQLx migrations from the workspace-level `migrations/` folder.
pub async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("../../migrations").run(pool).await
}

/// Spawn a background task that polls the pool state every 15 seconds and
/// emits `io_db_pool_size`, `io_db_pool_idle`, and `io_db_pool_active` gauges.
///
/// Call once per service after pool creation:
/// ```rust,ignore
/// io_db::spawn_pool_metrics(db.clone(), "api-gateway");
/// ```
pub fn spawn_pool_metrics(pool: DbPool, service_name: &'static str) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(15));
        loop {
            interval.tick().await;
            let total = pool.size() as f64;
            let idle = pool.num_idle() as f64;
            metrics::gauge!("io_db_pool_size",   "service" => service_name).set(total);
            metrics::gauge!("io_db_pool_idle",   "service" => service_name).set(idle);
            metrics::gauge!("io_db_pool_active", "service" => service_name).set(total - idle);
        }
    });
}

/// Execute a `SELECT 1` health check query, record latency under
/// `io_db_query_duration_seconds` with `query_type = "health"`, and
/// return `true` if the database is reachable.
pub async fn health_check(pool: &DbPool, service_name: &'static str) -> bool {
    let start = std::time::Instant::now();
    let ok = sqlx::query("SELECT 1").execute(pool).await.is_ok();
    let elapsed = start.elapsed().as_secs_f64();
    metrics::histogram!(
        "io_db_query_duration_seconds",
        "service"    => service_name,
        "query_type" => "health",
    )
    .record(elapsed);
    ok
}
