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
