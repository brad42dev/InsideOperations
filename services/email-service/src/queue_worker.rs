//! Background queue worker — polls at a configurable interval (default 1 s) and processes pending emails.

use sqlx::Row;
use uuid::Uuid;

use crate::state::AppState;

/// Five-minute pre-expiry window for token refresh.
const TOKEN_REFRESH_MARGIN: std::time::Duration = std::time::Duration::from_secs(5 * 60);

pub async fn run_queue_worker(state: AppState) {
    let poll_interval = tokio::time::Duration::from_millis(state.config.queue_poll_interval_ms);
    loop {
        tokio::time::sleep(poll_interval).await;

        // Update queue depth gauge each poll cycle.
        if let Ok(depth) = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM email_queue WHERE status IN ('pending', 'retry')",
        )
        .fetch_one(&state.db)
        .await
        {
            metrics::gauge!("io_email_queue_depth").set(depth as f64);
        }

        if let Err(e) = process_batch(&state).await {
            tracing::error!(error = %e, "queue worker error");
        }
    }
}

async fn process_batch(state: &AppState) -> anyhow::Result<()> {
    // Process up to 10 emails per cycle
    for _ in 0..10 {
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
    let raw_provider_config: Option<serde_json::Value> = row.get("provider_config");
    let from_address: Option<String> = row.get("from_address");

    // Decrypt provider secrets in-memory before passing to the delivery adapters.
    let provider_config: Option<serde_json::Value> = match (provider_type.as_deref(), raw_provider_config) {
        (Some(pt), Some(mut cfg)) => {
            if let Err(e) = crate::crypto::decrypt_provider_secrets(&mut cfg, pt, &state.config.master_key) {
                tracing::warn!(queue_id = %queue_id, error = %e, "Failed to decrypt provider secrets — aborting delivery");
                return Ok(false);
            }
            Some(cfg)
        }
        (_, cfg) => cfg,
    };

    let new_attempts = attempts + 1;

    // ── Pre-send suppression check ─────────────────────────────────────────
    // Query the suppression list for each recipient. If ALL recipients are
    // suppressed we log each as 'suppressed' and mark the queue item 'sent'
    // (not retried). Suppressed deliveries do NOT increment attempts.
    let suppressed_rows = sqlx::query(
        "SELECT email_address FROM email_suppressions WHERE email_address = ANY($1)",
    )
    .bind(&to_addresses)
    .fetch_all(&state.db)
    .await?;

    let suppressed_addresses: std::collections::HashSet<String> = suppressed_rows
        .iter()
        .map(|r| r.get::<String, _>("email_address"))
        .collect();

    // Log each suppressed recipient in the delivery log (no attempt increment).
    for addr in &suppressed_addresses {
        tracing::info!(queue_id = %queue_id, address = %addr, "Skipping suppressed recipient");
        if let Some(pid) = provider_id {
            let _ = sqlx::query(
                r#"INSERT INTO email_delivery_log
                       (id, queue_id, provider_id, attempt_number, status, error_details)
                   VALUES (gen_random_uuid(), $1, $2, $3, 'suppressed', $4)"#,
            )
            .bind(queue_id)
            .bind(pid)
            .bind(attempts) // do NOT increment
            .bind(format!("Recipient {} is on the suppression list", addr))
            .execute(&state.db)
            .await;
        }
    }

    // Build the list of addresses that are not suppressed.
    let deliverable: Vec<String> = to_addresses
        .iter()
        .filter(|a| !suppressed_addresses.contains(*a))
        .cloned()
        .collect();

    if deliverable.is_empty() {
        // All recipients suppressed — mark queue item done without incrementing attempts.
        sqlx::query(
            "UPDATE email_queue SET status = 'sent', sent_at = now() WHERE id = $1",
        )
        .bind(queue_id)
        .execute(&state.db)
        .await?;
        tracing::info!(queue_id = %queue_id, "All recipients suppressed — marking sent");
        return Ok(true);
    }

    // Attempt delivery
    let delivery_result = attempt_delivery(
        state,
        provider_id,
        &deliverable,
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

            metrics::counter!("io_email_sent_total").increment(1);
            tracing::info!(queue_id = %queue_id, "Email sent successfully");
        }
        Err(primary_err) => {
            let primary_error_str = primary_err.to_string();

            // ── Fallback provider attempt ────────────────────────────────
            // If a fallback provider is configured and the primary delivery
            // failed, attempt delivery via the fallback before scheduling
            // a retry or marking the item dead.
            let fallback_row = sqlx::query(
                r#"SELECT id, provider_type, config AS provider_config, from_address, from_name
                   FROM email_providers
                   WHERE is_fallback = true AND enabled = true
                   LIMIT 1"#,
            )
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None);

            if let Some(fb_row) = fallback_row {
                let fb_provider_id: Uuid = fb_row.get("id");
                let fb_provider_type: Option<String> = fb_row.get("provider_type");
                let fb_raw_config: Option<serde_json::Value> = fb_row.get("provider_config");
                let fb_from_address: Option<String> = fb_row.get("from_address");

                let fb_provider_config: Option<serde_json::Value> = match (fb_provider_type.as_deref(), fb_raw_config) {
                    (Some(pt), Some(mut cfg)) => {
                        if let Err(e) = crate::crypto::decrypt_provider_secrets(&mut cfg, pt, &state.config.master_key) {
                            tracing::warn!(queue_id = %queue_id, error = %e, "Failed to decrypt fallback provider secrets");
                            None
                        } else {
                            Some(cfg)
                        }
                    }
                    (_, cfg) => cfg,
                };

                tracing::info!(
                    queue_id = %queue_id,
                    fallback_provider_id = %fb_provider_id,
                    primary_error = %primary_error_str,
                    "Primary provider failed — attempting fallback provider"
                );

                let fallback_result = attempt_delivery(
                    state,
                    Some(fb_provider_id),
                    &deliverable,
                    &subject,
                    &body_html,
                    body_text.as_deref(),
                    fb_from_address.as_deref(),
                    fb_provider_type.as_deref(),
                    fb_provider_config.as_ref(),
                )
                .await;

                match fallback_result {
                    Ok(msg_id) => {
                        // Fallback succeeded — mark sent
                        sqlx::query(
                            "UPDATE email_queue SET status = 'sent', sent_at = now(), attempts = $2, provider_id = $3 WHERE id = $1",
                        )
                        .bind(queue_id)
                        .bind(new_attempts)
                        .bind(fb_provider_id)
                        .execute(&state.db)
                        .await?;

                        sqlx::query(
                            r#"INSERT INTO email_delivery_log
                                   (id, queue_id, provider_id, attempt_number, status, provider_message_id, error_details)
                               VALUES (gen_random_uuid(), $1, $2, $3, 'sent', $4, $5)"#,
                        )
                        .bind(queue_id)
                        .bind(fb_provider_id)
                        .bind(new_attempts)
                        .bind(msg_id)
                        .bind(format!("Fallback used — primary error: {}", primary_error_str))
                        .execute(&state.db)
                        .await?;

                        metrics::counter!("io_email_sent_total").increment(1);
                        tracing::info!(queue_id = %queue_id, "Email sent via fallback provider");
                        return Ok(true);
                    }
                    Err(fb_err) => {
                        tracing::warn!(
                            queue_id = %queue_id,
                            fallback_error = %fb_err,
                            "Fallback provider also failed — proceeding with retry/dead logic"
                        );
                        // Fall through to normal retry/dead logic using the primary error
                    }
                }
            }

            let error_str = primary_error_str;

            // Count this as a delivery failure.
            metrics::counter!("io_email_failures_total").increment(1);

            // ── Hard bounce detection ─────────────────────────────────────
            // A hard bounce (5xx SMTP, permanent Graph/SES error) adds every
            // deliverable recipient to the suppression list. Soft bounces (4xx)
            // do NOT trigger suppression.
            let is_hard_bounce = is_hard_bounce_error(&error_str);

            if is_hard_bounce {
                for addr in &deliverable {
                    // INSERT ... ON CONFLICT DO NOTHING — idempotent
                    let log_id: Option<Uuid> = if let Some(pid) = provider_id {
                        // Insert delivery log entry first so we can reference it
                        let log_row = sqlx::query(
                            r#"INSERT INTO email_delivery_log
                                   (id, queue_id, provider_id, attempt_number, status, error_details)
                               VALUES (gen_random_uuid(), $1, $2, $3, 'failed', $4)
                               RETURNING id"#,
                        )
                        .bind(queue_id)
                        .bind(pid)
                        .bind(new_attempts)
                        .bind(&error_str)
                        .fetch_one(&state.db)
                        .await
                        .ok();
                        log_row.map(|r| r.get::<Uuid, _>("id"))
                    } else {
                        None
                    };

                    let _ = sqlx::query(
                        r#"INSERT INTO email_suppressions
                               (email_address, reason, created_by_delivery_id)
                           VALUES ($1, $2, $3)
                           ON CONFLICT (email_address) DO NOTHING"#,
                    )
                    .bind(addr)
                    .bind(format!("Hard bounce: {}", error_str))
                    .bind(log_id)
                    .execute(&state.db)
                    .await;

                    tracing::warn!(
                        queue_id = %queue_id,
                        address = %addr,
                        "Hard bounce — address added to suppression list"
                    );
                }

                // Mark as dead (hard bounce exhausts retries immediately)
                sqlx::query(
                    r#"UPDATE email_queue SET
                           status = 'dead', attempts = $2, last_error = $3
                       WHERE id = $1"#,
                )
                .bind(queue_id)
                .bind(new_attempts)
                .bind(&error_str)
                .execute(&state.db)
                .await?;
            } else {
                // Soft bounce — normal retry/failed logic
                let next_status = if new_attempts >= max_attempts {
                    "dead"
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
                    "Email delivery failed (soft bounce)"
                );
            }
        }
    }

    Ok(true)
}

/// Attempt delivery via the configured provider.
/// Returns the provider message ID on success (may be None → empty string).
#[allow(clippy::too_many_arguments)]
pub async fn attempt_delivery(
    state: &AppState,
    provider_id: Option<Uuid>,
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
            send_smtp(state, provider_id, to_addresses, subject, body_html, body_text, from_address, &config).await
        }
        Some("smtp_xoauth2") => {
            // smtp_xoauth2 is handled inside send_smtp when auth_method == "xoauth2"
            let mut cfg = config.clone();
            if cfg.get("auth_method").is_none() {
                cfg["auth_method"] = serde_json::Value::String("xoauth2".to_string());
            }
            send_smtp(state, provider_id, to_addresses, subject, body_html, body_text, from_address, &cfg).await
        }
        Some("webhook") => {
            send_webhook(state, to_addresses, subject, body_html, body_text, &config).await
        }
        Some("msgraph") => {
            let pid = provider_id.ok_or_else(|| anyhow::anyhow!("MS Graph provider requires a provider UUID"))?;
            send_msgraph(state, pid, to_addresses, subject, body_html, body_text, from_address, &config).await
        }
        Some("gmail") => {
            let pid = provider_id.ok_or_else(|| anyhow::anyhow!("Gmail provider requires a provider UUID"))?;
            send_gmail(state, pid, to_addresses, subject, body_html, body_text, from_address, &config).await
        }
        Some("ses") => {
            // SES: derive SMTP credentials from AWS secret key and route through SMTP.
            send_ses(to_addresses, subject, body_html, body_text, from_address, &config).await
        }
        Some(other) => {
            Err(anyhow::anyhow!("Unsupported email provider type: '{}'. Delivery aborted.", other))
        }
        None => {
            Err(anyhow::anyhow!("No provider configured for this queue item. Delivery aborted."))
        }
    }
}

// ─── Hard bounce detection ───────────────────────────────────────────────────

/// Returns true if the error string indicates a hard (permanent) bounce.
///
/// Hard bounces:
/// - SMTP 5xx response codes (permanent failure)
/// - MS Graph API HTTP 4xx/5xx errors for permanent rejection
/// - SES permanent bounce indicators
///
/// Soft bounces (4xx SMTP, temporary Graph/SES errors) return false.
fn is_hard_bounce_error(error: &str) -> bool {
    // SMTP: lettre surfaces the numeric code in the error message
    // Permanent failures start with 5 (5xx)
    // Temporary failures start with 4 (4xx)
    let lower = error.to_lowercase();

    // SMTP 5xx pattern: "smtp error, code: 5" or "permanent" in error
    if lower.contains("smtp") {
        // Check for explicit 5xx codes
        for code in ["500", "501", "502", "503", "504", "505",
                     "510", "511", "512", "513", "514", "515",
                     "521", "522", "523", "524", "525", "530",
                     "531", "532", "533", "534", "535", "538",
                     "541", "550", "551", "552", "553", "554", "555"] {
            if lower.contains(code) {
                return true;
            }
        }
        // Explicit 4xx means soft bounce (temporary)
        for code in ["421", "450", "451", "452"] {
            if lower.contains(code) {
                return false;
            }
        }
    }

    // MS Graph: HTTP 4xx/5xx with "permanent" or specific codes
    if lower.contains("ms graph") || lower.contains("sendmail failed") {
        if lower.contains("permanent") || lower.contains("550") || lower.contains("551")
            || lower.contains("552") || lower.contains("553") || lower.contains("554")
        {
            return true;
        }
    }

    // SES: permanent bounce keywords
    if lower.contains("ses") || lower.contains("amazon") {
        if lower.contains("permanent") || lower.contains("bounce")
            || lower.contains("address does not exist")
            || lower.contains("user unknown")
        {
            return true;
        }
    }

    // Generic permanent failure indicators
    lower.contains("permanent") && (lower.contains("fail") || lower.contains("bounce"))
        || lower.contains("user unknown")
        || lower.contains("no such user")
        || lower.contains("address rejected")
        || lower.contains("invalid address")
        || lower.contains("mailbox not found")
        || lower.contains("does not exist")
}

// ─── SMTP / SMTP+XOAUTH2 ────────────────────────────────────────────────────

async fn send_smtp(
    state: &AppState,
    provider_id: Option<Uuid>,
    to_addresses: &[String],
    subject: &str,
    _body_html: &str,
    body_text: Option<&str>,
    from_address: Option<&str>,
    config: &serde_json::Value,
) -> anyhow::Result<Option<String>> {
    use lettre::{
        transport::smtp::authentication::{Credentials, Mechanism},
        AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    };

    let host = config["host"].as_str().unwrap_or("localhost").to_string();
    let smtp_port = config["port"].as_u64().unwrap_or(587) as u16;
    let username = config["username"].as_str().unwrap_or("").to_string();
    let from = from_address.unwrap_or("noreply@localhost");
    let body = body_text.unwrap_or("").to_string();

    let auth_method = config["auth_method"].as_str().unwrap_or("plain");

    let (creds, mechanisms) = if auth_method == "xoauth2" {
        // Acquire OAuth2 token for XOAUTH2
        let pid = provider_id.ok_or_else(|| anyhow::anyhow!("XOAUTH2 requires a provider UUID for token caching"))?;
        let token = acquire_client_credentials_token(state, pid, config).await?;
        let creds = Credentials::new(username, token);
        (creds, vec![Mechanism::Xoauth2])
    } else {
        let password = config["password"].as_str().unwrap_or("").to_string();
        let creds = Credentials::new(username, password);
        (creds, vec![Mechanism::Plain, Mechanism::Login])
    };

    let mailer = AsyncSmtpTransport::<Tokio1Executor>::relay(&host)?
        .port(smtp_port)
        .credentials(creds)
        .authentication(mechanisms)
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

// ─── Webhook ─────────────────────────────────────────────────────────────────

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

// ─── Microsoft Graph API ─────────────────────────────────────────────────────

async fn send_msgraph(
    state: &AppState,
    provider_id: Uuid,
    to_addresses: &[String],
    subject: &str,
    body_html: &str,
    _body_text: Option<&str>,
    from_address: Option<&str>,
    config: &serde_json::Value,
) -> anyhow::Result<Option<String>> {
    let tenant_id = config["tenant_id"].as_str()
        .ok_or_else(|| anyhow::anyhow!("MS Graph: tenant_id not configured"))?;
    let send_as_user = config["send_as_user"].as_str()
        .ok_or_else(|| anyhow::anyhow!("MS Graph: send_as_user not configured"))?;
    let _save_to_sent = config["save_to_sent"].as_bool().unwrap_or(false);

    let access_token = acquire_msgraph_token(state, provider_id, tenant_id, config).await?;

    // Build the sendMail request body
    let from_addr = from_address.unwrap_or(send_as_user);
    let to_recipients: Vec<serde_json::Value> = to_addresses
        .iter()
        .map(|addr| serde_json::json!({ "emailAddress": { "address": addr } }))
        .collect();

    let send_mail_body = serde_json::json!({
        "message": {
            "subject": subject,
            "body": {
                "contentType": "HTML",
                "content": body_html,
            },
            "toRecipients": to_recipients,
            "from": {
                "emailAddress": { "address": from_addr }
            },
        },
        "saveToSentItems": _save_to_sent,
    });

    let url = format!(
        "https://graph.microsoft.com/v1.0/users/{}/sendMail",
        send_as_user
    );

    let resp = state
        .http_client
        .post(&url)
        .bearer_auth(&access_token)
        .json(&send_mail_body)
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body: serde_json::Value = resp.json().await.unwrap_or(serde_json::Value::Null);
        return Err(anyhow::anyhow!(
            "MS Graph sendMail failed: HTTP {} — {}",
            status,
            body
        ));
    }

    Ok(None)
}

/// Acquire (or return cached) MS Graph OAuth2 client-credentials token.
async fn acquire_msgraph_token(
    state: &AppState,
    provider_id: Uuid,
    tenant_id: &str,
    config: &serde_json::Value,
) -> anyhow::Result<String> {
    // Check cache first
    {
        let cache = state.token_cache.lock().await;
        if let Some(cached) = cache.get(&provider_id) {
            if cached.expires_at > std::time::Instant::now() + TOKEN_REFRESH_MARGIN {
                return Ok(cached.access_token.clone());
            }
        }
    }

    let client_id = config["client_id"].as_str()
        .ok_or_else(|| anyhow::anyhow!("MS Graph: client_id not configured"))?;
    let client_secret = config["client_secret"].as_str()
        .ok_or_else(|| anyhow::anyhow!("MS Graph: client_secret not configured"))?;

    let token_url = format!(
        "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
        tenant_id
    );

    let params = [
        ("grant_type", "client_credentials"),
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("scope", "https://graph.microsoft.com/.default"),
    ];

    let resp = state
        .http_client
        .post(&token_url)
        .form(&params)
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body: serde_json::Value = resp.json().await.unwrap_or(serde_json::Value::Null);
        return Err(anyhow::anyhow!(
            "MS Graph token request failed: HTTP {} — {}",
            status,
            body
        ));
    }

    let token_resp: serde_json::Value = resp.json().await?;
    let access_token = token_resp["access_token"].as_str()
        .ok_or_else(|| anyhow::anyhow!("MS Graph token response missing access_token"))?
        .to_string();
    let expires_in = token_resp["expires_in"].as_u64().unwrap_or(3600);

    // Store in cache
    {
        let mut cache = state.token_cache.lock().await;
        cache.insert(provider_id, crate::state::CachedToken {
            access_token: access_token.clone(),
            expires_at: std::time::Instant::now() + std::time::Duration::from_secs(expires_in),
        });
    }

    Ok(access_token)
}

// ─── Gmail API ───────────────────────────────────────────────────────────────

async fn send_gmail(
    state: &AppState,
    provider_id: Uuid,
    to_addresses: &[String],
    subject: &str,
    body_html: &str,
    body_text: Option<&str>,
    from_address: Option<&str>,
    config: &serde_json::Value,
) -> anyhow::Result<Option<String>> {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
    use lettre::{Message, message::header::ContentType};

    let send_as_user = config["send_as_user"].as_str()
        .ok_or_else(|| anyhow::anyhow!("Gmail: send_as_user not configured"))?;

    let access_token = acquire_gmail_token(state, provider_id, config).await?;

    let from = from_address.unwrap_or(send_as_user);

    // Build RFC 2822 message for each recipient and send
    let mut last_msg_id: Option<String> = None;
    for to in to_addresses {
        let text_body = body_text.unwrap_or("").to_string();

        let email = Message::builder()
            .from(from.parse()?)
            .to(to.parse()?)
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(body_html.to_string())?;

        // lettre formats as RFC 2822 bytes
        let raw_bytes = email.formatted();
        let _ = text_body; // HTML preferred; text_body available if multipart needed
        let encoded = URL_SAFE_NO_PAD.encode(&raw_bytes);

        let url = format!(
            "https://gmail.googleapis.com/gmail/v1/users/{}/messages/send",
            send_as_user
        );

        let resp = state
            .http_client
            .post(&url)
            .bearer_auth(&access_token)
            .json(&serde_json::json!({ "raw": encoded }))
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body: serde_json::Value = resp.json().await.unwrap_or(serde_json::Value::Null);
            return Err(anyhow::anyhow!(
                "Gmail API send failed: HTTP {} — {}",
                status,
                body
            ));
        }

        let resp_json: serde_json::Value = resp.json().await?;
        last_msg_id = resp_json["id"].as_str().map(|s| s.to_string());
    }

    Ok(last_msg_id)
}

/// Acquire (or return cached) Gmail service-account JWT exchange token.
async fn acquire_gmail_token(
    state: &AppState,
    provider_id: Uuid,
    config: &serde_json::Value,
) -> anyhow::Result<String> {
    // Check cache first
    {
        let cache = state.token_cache.lock().await;
        if let Some(cached) = cache.get(&provider_id) {
            if cached.expires_at > std::time::Instant::now() + TOKEN_REFRESH_MARGIN {
                return Ok(cached.access_token.clone());
            }
        }
    }

    let service_account_key = config["service_account_key"].as_str()
        .ok_or_else(|| anyhow::anyhow!("Gmail: service_account_key not configured"))?;
    let subject_email = config["send_as_user"].as_str()
        .ok_or_else(|| anyhow::anyhow!("Gmail: send_as_user not configured for impersonation"))?;

    // Parse the service account JSON key
    let key_json: serde_json::Value = serde_json::from_str(service_account_key)?;
    let private_key_pem = key_json["private_key"].as_str()
        .ok_or_else(|| anyhow::anyhow!("Gmail: service_account_key missing private_key field"))?;
    let client_email = key_json["client_email"].as_str()
        .ok_or_else(|| anyhow::anyhow!("Gmail: service_account_key missing client_email field"))?;

    let now = chrono::Utc::now().timestamp();
    let expiry = now + 3600;

    #[derive(serde::Serialize)]
    struct ServiceAccountClaims<'a> {
        iss: &'a str,
        sub: &'a str,
        scope: &'a str,
        aud: &'a str,
        iat: i64,
        exp: i64,
    }

    let claims = ServiceAccountClaims {
        iss: client_email,
        sub: subject_email,
        scope: "https://www.googleapis.com/auth/gmail.send",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: expiry,
    };

    let encoding_key = jsonwebtoken::EncodingKey::from_rsa_pem(private_key_pem.as_bytes())?;
    let header = jsonwebtoken::Header::new(jsonwebtoken::Algorithm::RS256);
    let jwt = jsonwebtoken::encode(&header, &claims, &encoding_key)?;

    // Exchange JWT for access token
    let params = [
        ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
        ("assertion", &jwt),
    ];

    let resp = state
        .http_client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body: serde_json::Value = resp.json().await.unwrap_or(serde_json::Value::Null);
        return Err(anyhow::anyhow!(
            "Gmail token exchange failed: HTTP {} — {}",
            status,
            body
        ));
    }

    let token_resp: serde_json::Value = resp.json().await?;
    let access_token = token_resp["access_token"].as_str()
        .ok_or_else(|| anyhow::anyhow!("Gmail token response missing access_token"))?
        .to_string();
    let expires_in = token_resp["expires_in"].as_u64().unwrap_or(3600);

    // Store in cache
    {
        let mut cache = state.token_cache.lock().await;
        cache.insert(provider_id, crate::state::CachedToken {
            access_token: access_token.clone(),
            expires_at: std::time::Instant::now() + std::time::Duration::from_secs(expires_in),
        });
    }

    Ok(access_token)
}

// ─── Amazon SES (via derived SMTP credentials) ───────────────────────────────

/// SES SMTP password derivation per AWS specification:
/// HMAC-SHA256("AWS4" + secret_access_key, "SendRawEmail") then base64-encode.
/// Reference: https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html
fn derive_ses_smtp_password(secret_access_key: &str, region: &str) -> anyhow::Result<String> {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    // Step 1: date key — HMAC-SHA256("AWS4" + secret, date)
    let date = "11111111"; // SES uses a fixed date string "11111111" per spec
    let k_secret = format!("AWS4{}", secret_access_key);
    let mut mac = Hmac::<Sha256>::new_from_slice(k_secret.as_bytes())?;
    mac.update(date.as_bytes());
    let k_date = mac.finalize().into_bytes();

    // Step 2: region key
    let mut mac = Hmac::<Sha256>::new_from_slice(&k_date)?;
    mac.update(region.as_bytes());
    let k_region = mac.finalize().into_bytes();

    // Step 3: service key
    let mut mac = Hmac::<Sha256>::new_from_slice(&k_region)?;
    mac.update(b"ses");
    let k_service = mac.finalize().into_bytes();

    // Step 4: signing key
    let mut mac = Hmac::<Sha256>::new_from_slice(&k_service)?;
    mac.update(b"aws4_request");
    let k_signing = mac.finalize().into_bytes();

    // Step 5: HMAC-SHA256(k_signing, "SendRawEmail")
    let mut mac = Hmac::<Sha256>::new_from_slice(&k_signing)?;
    mac.update(b"SendRawEmail");
    let smtp_key = mac.finalize().into_bytes();

    // Step 6: prepend version byte (0x02) and base64-encode
    let mut versioned = vec![0x02u8];
    versioned.extend_from_slice(&smtp_key);

    Ok(STANDARD.encode(&versioned))
}

async fn send_ses(
    to_addresses: &[String],
    subject: &str,
    _body_html: &str,
    body_text: Option<&str>,
    from_address: Option<&str>,
    config: &serde_json::Value,
) -> anyhow::Result<Option<String>> {
    use lettre::{
        transport::smtp::authentication::{Credentials, Mechanism},
        AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    };

    let region = config["region"].as_str().unwrap_or("us-east-1");
    let access_key_id = config["access_key_id"].as_str()
        .ok_or_else(|| anyhow::anyhow!("SES: access_key_id not configured"))?;
    let secret_access_key = config["secret_access_key"].as_str()
        .ok_or_else(|| anyhow::anyhow!("SES: secret_access_key not configured"))?;

    let smtp_host = format!("email-smtp.{}.amazonaws.com", region);
    let smtp_password = derive_ses_smtp_password(secret_access_key, region)?;

    let from = from_address.unwrap_or("noreply@localhost");
    let body = body_text.unwrap_or("").to_string();

    let creds = Credentials::new(access_key_id.to_string(), smtp_password);
    let mailer = AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp_host)?
        .port(587)
        .credentials(creds)
        .authentication(vec![Mechanism::Plain, Mechanism::Login])
        .build();

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

// ─── OAuth2 client-credentials token helper (for XOAUTH2) ───────────────────

/// Acquire an OAuth2 access token via the client-credentials flow.
/// Used by SMTP+XOAUTH2. Token is cached per provider UUID.
async fn acquire_client_credentials_token(
    state: &AppState,
    provider_id: Uuid,
    config: &serde_json::Value,
) -> anyhow::Result<String> {
    // Check cache first
    {
        let cache = state.token_cache.lock().await;
        if let Some(cached) = cache.get(&provider_id) {
            if cached.expires_at > std::time::Instant::now() + TOKEN_REFRESH_MARGIN {
                return Ok(cached.access_token.clone());
            }
        }
    }

    let token_endpoint = config["token_endpoint"].as_str()
        .ok_or_else(|| anyhow::anyhow!("XOAUTH2: token_endpoint not configured"))?;
    let client_id = config["client_id"].as_str()
        .ok_or_else(|| anyhow::anyhow!("XOAUTH2: client_id not configured"))?;
    let client_secret = config["client_secret"].as_str()
        .ok_or_else(|| anyhow::anyhow!("XOAUTH2: client_secret not configured"))?;
    let scope = config["scope"].as_str().unwrap_or("");

    let params: Vec<(&str, &str)> = if scope.is_empty() {
        vec![
            ("grant_type", "client_credentials"),
            ("client_id", client_id),
            ("client_secret", client_secret),
        ]
    } else {
        vec![
            ("grant_type", "client_credentials"),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("scope", scope),
        ]
    };

    let resp = state
        .http_client
        .post(token_endpoint)
        .form(&params)
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body: serde_json::Value = resp.json().await.unwrap_or(serde_json::Value::Null);
        return Err(anyhow::anyhow!(
            "XOAUTH2 token request failed: HTTP {} — {}",
            status,
            body
        ));
    }

    let token_resp: serde_json::Value = resp.json().await?;
    let access_token = token_resp["access_token"].as_str()
        .ok_or_else(|| anyhow::anyhow!("XOAUTH2 token response missing access_token"))?
        .to_string();
    let expires_in = token_resp["expires_in"].as_u64().unwrap_or(3600);

    // Store in cache
    {
        let mut cache = state.token_cache.lock().await;
        cache.insert(provider_id, crate::state::CachedToken {
            access_token: access_token.clone(),
            expires_at: std::time::Instant::now() + std::time::Duration::from_secs(expires_in),
        });
    }

    Ok(access_token)
}
