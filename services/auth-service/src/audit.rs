use serde_json::Value;
use tracing::warn;
use uuid::Uuid;

/// Insert an audit log entry. Failures are logged as warnings but do not
/// propagate — audit logging must never cause a request to fail.
pub async fn log_event(
    db: &io_db::DbPool,
    table_name: &str,
    operation: &str,
    record_id: Option<Uuid>,
    actor_id: Option<Uuid>,
    details: Value,
) {
    let result = sqlx::query(
        "INSERT INTO audit_log (id, table_name, action, record_id, user_id, changes)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(Uuid::new_v4())
    .bind(table_name)
    .bind(operation)
    .bind(record_id)
    .bind(actor_id)
    .bind(details)
    .execute(db)
    .await;

    if let Err(e) = result {
        warn!(
            table_name = table_name,
            operation = operation,
            error = %e,
            "Audit log insert failed"
        );
    }
}
