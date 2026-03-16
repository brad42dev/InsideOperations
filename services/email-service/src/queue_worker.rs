//! Background queue worker — polls every 10 seconds and processes pending emails.

use sqlx::Row;
use uuid::Uuid;

use crate::state::AppState;

pub async fn run_queue_worker(state: AppState) {
    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
        if let Err(e) = process_batch(&state).await {
            tracing::error!(error = %e, "queue worker error");
        }
    }
}

async fn process_batch(state: &AppState) -> anyhow::Result<()> {
    // Process up to 3 emails per cycle
    for _ in 0..3 {
        let processed = process_one(state).await?;
        if !processed {
            break;
        }
    }
    Ok(())
}

/// Process one email from the queue. Returns true if an item was processed.
pub async fn process_one(state: &AppState) -> anyhow::Result<bool> {
    let row = sqlx::query(
        r#"SELECT eq.id, eq.to_addresses, eq.subject, eq.body_html, eq.body_text,
                  eq.attempts, eq.max_attempts, eq.provider_id,
                  ep.provider_type, ep.config AS provider_config,
                  ep.from_address, ep.from_name
           FROM email_queue eq
           LEFT JOIN email_providers ep ON ep.id = eq.provider_id
           WHERE eq.status IN ('pending', 'retry') AND eq.next_attempt <= now()
           ORDER BY eq.priority ASC, eq.created_at ASC
           LIMIT 1
           FOR UPDATE OF eq SKIP LOCKED"#,
    )
    .fetch_optional(&state.db)
    .await?;

    let Some(row) = row else {
        return Ok(false);
    };

    let queue_id: Uuid = row.get("id");
    let to_addresses: Vec<String> = row.get("to_addresses");
    let subject: String = row.get("subject");
    let body_html: String = row.get("body_html");
    let body_text: Option<String> = row.get("body_text");
    let attempts: i16 = row.get("attempts");
    let max_attempts: i16 = row.get("max_attempts");
    let provider_id: Option<Uuid> = row.get("provider_id");
    let provider_type: Option<String> = row.get("provider_type");
    let provider_config: Option<serde_json::Value> = row.get("provider_config");
    let from_address: Option<String> = row.get("from_address");

    let new_attempts = attempts + 1;

    // Attempt delivery
    let delivery_result = attempt_delivery(
        state,
        &to_addresses,
        &subject,
        &body_html,
        body_text.as_deref(),
        from_address.as_deref(),
        provider_type.as_deref(),
        provider_config.as_ref(),
    )
    .await;

    match delivery_result {
        Ok(msg_id) => {
            // Mark sent
            sqlx::query(
                "UPDATE email_queue SET status = 'sent', sent_at = now(), attempts = $2 WHERE id = $1",
            )
            .bind(queue_id)
            .bind(new_attempts)
            .execute(&state.db)
            .await?;

            if let Some(pid) = provider_id {
                sqlx::query(
                    r#"INSERT INTO email_delivery_log
                           (id, queue_id, provider_id, attempt_number, status, provider_message_id)
                       VALUES (gen_random_uuid(), $1, $2, $3, 'sent', $4)"#,
                )
                .bind(queue_id)
                .bind(pid)
                .bind(new_attempts)
                .bind(msg_id)
                .execute(&state.db)
                .await?;
            }

            tracing::info!(queue_id = %queue_id, "Email sent successfully");
        }
        Err(e) => {
            let error_str = e.to_string();
            let next_status = if new_attempts >= max_attempts {
                "failed"
            } else {
                "retry"
            };

            // Exponential backoff: 2^attempts minutes, capped at 60 minutes
            let backoff_secs = (2_i64.pow(new_attempts as u32) * 60).min(3600);

            sqlx::query(
                r#"UPDATE email_queue SET
                       status = $2, attempts = $3, last_error = $4,
                       next_attempt = now() + ($5 || ' seconds')::interval
                   WHERE id = $1"#,
            )
            .bind(queue_id)
            .bind(next_status)
            .bind(new_attempts)
            .bind(&error_str)
            .bind(backoff_secs.to_string())
            .execute(&state.db)
            .await?;

            if let Some(pid) = provider_id {
                sqlx::query(
                    r#"INSERT INTO email_delivery_log
                           (id, queue_id, provider_id, attempt_number, status, error_details)
                       VALUES (gen_random_uuid(), $1, $2, $3, 'failed', $4)"#,
                )
                .bind(queue_id)
                .bind(pid)
                .bind(new_attempts)
                .bind(&error_str)
                .execute(&state.db)
                .await?;
            }

            tracing::warn!(
                queue_id = %queue_id,
                attempt = new_attempts,
                max_attempts,
                status = next_status,
                error = %error_str,
                "Email delivery failed"
            );
        }
    }

    Ok(true)
}

/// Attempt delivery via the configured provider.
/// Returns the provider message ID on success (may be None → empty string).
#[allow(clippy::too_many_arguments)]
async fn attempt_delivery(
    state: &AppState,
    to_addresses: &[String],
    subject: &str,
    body_html: &str,
    body_text: Option<&str>,
    from_address: Option<&str>,
    provider_type: Option<&str>,
    provider_config: Option<&serde_json::Value>,
) -> anyhow::Result<Option<String>> {
    let config = provider_config.cloned().unwrap_or(serde_json::Value::Object(Default::default()));

    match provider_type {
        Some("smtp") => {
            send_smtp(to_addresses, subject, body_html, body_text, from_address, &config).await
        }
        Some("webhook") => {
            send_webhook(state, to_addresses, subject, body_html, body_text, &config).await
        }
        Some(other) => {
            tracing::warn!(provider_type = other, "Unknown provider type — treating as no-op");
            Ok(None)
        }
        None => {
            tracing::warn!("No provider configured for queue item — treating as no-op");
            Ok(None)
        }
    }
}

async fn send_smtp(
    to_addresses: &[String],
    subject: &str,
    _body_html: &str,
    body_text: Option<&str>,
    from_address: Option<&str>,
    config: &serde_json::Value,
) -> anyhow::Result<Option<String>> {
    use lettre::{
        transport::smtp::authentication::Credentials,
        AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    };

    let host = config["host"].as_str().unwrap_or("localhost").to_string();
    let smtp_port = config["port"].as_u64().unwrap_or(587) as u16;
    let username = config["username"].as_str().unwrap_or("").to_string();
    let password = config["password"].as_str().unwrap_or("").to_string();

    let from = from_address.unwrap_or("noreply@localhost");
    let body = body_text.unwrap_or("").to_string();

    let creds = Credentials::new(username, password);
    let mailer = AsyncSmtpTransport::<Tokio1Executor>::relay(&host)?
        .port(smtp_port)
        .credentials(creds)
        .build();

    // Send to each recipient
    for to in to_addresses {
        let email = Message::builder()
            .from(from.parse()?)
            .to(to.parse()?)
            .subject(subject)
            .body(body.clone())?;

        mailer.send(email).await?;
    }

    Ok(None)
}

async fn send_webhook(
    state: &AppState,
    to_addresses: &[String],
    subject: &str,
    body_html: &str,
    body_text: Option<&str>,
    config: &serde_json::Value,
) -> anyhow::Result<Option<String>> {
    let webhook_url = config["url"].as_str().unwrap_or("").to_string();
    if webhook_url.is_empty() {
        return Err(anyhow::anyhow!("Webhook URL is not configured"));
    }

    state
        .http_client
        .post(&webhook_url)
        .json(&serde_json::json!({
            "to": to_addresses,
            "subject": subject,
            "body_html": body_html,
            "body_text": body_text,
        }))
        .send()
        .await?;

    Ok(None)
}
