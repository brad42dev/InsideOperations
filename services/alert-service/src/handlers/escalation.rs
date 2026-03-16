use chrono::Utc;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::state::AppState;

/// Dispatch notifications for a given alert at the given tier, then schedule
/// the next escalation if the alert remains unacknowledged.
///
/// This function is boxed to allow recursive calls inside `tokio::spawn`.
pub fn dispatch_tier(
    state: AppState,
    alert_id: Uuid,
    tier: i16,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + 'static>> {
    Box::pin(async move {
        dispatch_tier_impl(state, alert_id, tier).await;
    })
}

async fn dispatch_tier_impl(state: AppState, alert_id: Uuid, tier: i16) {
    // Load alert status and policy_id
    let alert_row = sqlx::query(
        "SELECT status, policy_id, title, body FROM alert_instances WHERE id = $1",
    )
    .bind(alert_id)
    .fetch_optional(&state.db)
    .await;

    let alert_row = match alert_row {
        Ok(Some(r)) => r,
        Ok(None) => {
            warn!(alert_id = %alert_id, "dispatch_tier: alert not found, skipping");
            return;
        }
        Err(e) => {
            error!(alert_id = %alert_id, error = %e, "dispatch_tier: db error loading alert");
            return;
        }
    };

    use sqlx::Row;
    let status: String = alert_row.get("status");
    let policy_id: Option<Uuid> = alert_row.get("policy_id");
    let title: String = alert_row.get("title");
    let body: Option<String> = alert_row.get("body");

    // Only dispatch if still active
    if status != "active" {
        info!(
            alert_id = %alert_id,
            status = %status,
            "dispatch_tier: alert not active, skipping escalation"
        );
        return;
    }

    let policy_id = match policy_id {
        Some(p) => p,
        None => {
            info!(alert_id = %alert_id, "dispatch_tier: no policy, skipping escalation");
            return;
        }
    };

    // Load tier config
    let tier_row = sqlx::query(
        "SELECT id, escalate_after_mins, notify_groups, notify_users, channels
         FROM escalation_tiers
         WHERE policy_id = $1 AND tier_order = $2",
    )
    .bind(policy_id)
    .bind(tier)
    .fetch_optional(&state.db)
    .await;

    let tier_row = match tier_row {
        Ok(Some(r)) => r,
        Ok(None) => {
            info!(alert_id = %alert_id, tier, "dispatch_tier: no tier config found");
            return;
        }
        Err(e) => {
            error!(alert_id = %alert_id, error = %e, "dispatch_tier: db error loading tier");
            return;
        }
    };

    let escalate_after_mins: i16 = tier_row.get("escalate_after_mins");
    let notify_users: Vec<Uuid> = tier_row.get("notify_users");
    let channels: Vec<String> = tier_row.get("channels");

    // Update current_tier on the alert instance
    if let Err(e) = sqlx::query(
        "UPDATE alert_instances SET current_tier = $1 WHERE id = $2",
    )
    .bind(tier)
    .bind(alert_id)
    .execute(&state.db)
    .await
    {
        error!(alert_id = %alert_id, error = %e, "dispatch_tier: failed to update current_tier");
    }

    // Dispatch each channel
    for channel in &channels {
        match channel.as_str() {
            "email" => {
                dispatch_email(&state, alert_id, tier, &title, body.as_deref(), &notify_users)
                    .await;
            }
            "websocket" => {
                // WebSocket push via data-broker: logged for now.
                // Full implementation would POST to data-broker's broadcast endpoint.
                info!(
                    alert_id = %alert_id,
                    tier,
                    "dispatch_tier: websocket channel — would push via data-broker"
                );
                record_delivery(&state, alert_id, tier, "websocket", None, "sent", None).await;
            }
            other => {
                warn!(alert_id = %alert_id, channel = other, "dispatch_tier: unknown channel");
            }
        }
    }

    // Schedule next escalation after escalate_after_mins
    let delay_mins = escalate_after_mins as u64;
    let next_tier = tier + 1;

    // Clone state for the background task
    let state_for_task = state.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(delay_mins * 60)).await;

        // Re-check if alert is still active before escalating
        let still_active = sqlx::query(
            "SELECT status FROM alert_instances WHERE id = $1",
        )
        .bind(alert_id)
        .fetch_optional(&state_for_task.db)
        .await;

        let current_status: Option<String> = match still_active {
            Ok(Some(row)) => {
                use sqlx::Row;
                Some(row.get("status"))
            }
            Ok(None) => {
                warn!(alert_id = %alert_id, "Alert disappeared, halting escalation");
                return;
            }
            Err(e) => {
                error!(alert_id = %alert_id, error = %e, "Failed to check alert status for escalation");
                return;
            }
        };

        match current_status.as_deref() {
            Some("active") => {
                // Check if next tier exists
                let next_exists = sqlx::query(
                    "SELECT EXISTS(SELECT 1 FROM escalation_tiers WHERE policy_id = $1 AND tier_order = $2) AS exists",
                )
                .bind(policy_id)
                .bind(next_tier)
                .fetch_one(&state_for_task.db)
                .await;

                match next_exists {
                    Ok(row) => {
                        use sqlx::Row;
                        let exists: bool = row.get("exists");
                        if exists {
                            info!(alert_id = %alert_id, next_tier, "Escalating alert to next tier");
                            dispatch_tier(state_for_task, alert_id, next_tier).await;
                        } else {
                            info!(alert_id = %alert_id, "No further tiers — escalation chain complete");
                        }
                    }
                    Err(e) => {
                        error!(alert_id = %alert_id, error = %e, "Failed to check next tier existence");
                    }
                }
            }
            Some(s) => {
                info!(alert_id = %alert_id, status = s, "Alert no longer active, halting escalation");
            }
            None => {
                warn!(alert_id = %alert_id, "Alert disappeared, halting escalation");
            }
        }
    });
}

/// Send email notifications via the email-service /internal/send endpoint.
async fn dispatch_email(
    state: &AppState,
    alert_id: Uuid,
    tier: i16,
    title: &str,
    body: Option<&str>,
    recipients: &[Uuid],
) {
    if recipients.is_empty() {
        info!(alert_id = %alert_id, "dispatch_email: no recipients, skipping");
        return;
    }

    for &recipient_id in recipients {
        // Look up the user's email address
        let email_row = sqlx::query("SELECT email FROM users WHERE id = $1")
            .bind(recipient_id)
            .fetch_optional(&state.db)
            .await;

        let email_addr: String = match email_row {
            Ok(Some(row)) => {
                use sqlx::Row;
                row.get("email")
            }
            Ok(None) => {
                warn!(
                    alert_id = %alert_id,
                    recipient_id = %recipient_id,
                    "dispatch_email: user not found"
                );
                record_delivery(
                    state,
                    alert_id,
                    tier,
                    "email",
                    Some(recipient_id),
                    "failed",
                    Some("User not found"),
                )
                .await;
                continue;
            }
            Err(e) => {
                error!(alert_id = %alert_id, error = %e, "dispatch_email: db error");
                let err_str = e.to_string();
                record_delivery(
                    state,
                    alert_id,
                    tier,
                    "email",
                    Some(recipient_id),
                    "failed",
                    Some(&err_str),
                )
                .await;
                continue;
            }
        };

        let payload = serde_json::json!({
            "to": email_addr,
            "subject": format!("[Alert] {}", title),
            "text": body.unwrap_or(title),
            "html": format!(
                "<p><strong>Alert:</strong> {}</p><p>{}</p>",
                title,
                body.unwrap_or("")
            ),
        });

        let url = format!("{}/internal/send", state.config.email_service_url);
        let result = state
            .http
            .post(&url)
            .header("x-io-service-secret", &state.config.service_secret)
            .json(&payload)
            .send()
            .await;

        match result {
            Ok(resp) if resp.status().is_success() => {
                info!(
                    alert_id = %alert_id,
                    recipient_id = %recipient_id,
                    "dispatch_email: sent"
                );
                record_delivery(
                    state,
                    alert_id,
                    tier,
                    "email",
                    Some(recipient_id),
                    "sent",
                    None,
                )
                .await;
            }
            Ok(resp) => {
                let status_code = resp.status().as_u16();
                let err_msg = format!("email-service returned HTTP {}", status_code);
                warn!(
                    alert_id = %alert_id,
                    recipient_id = %recipient_id,
                    status_code,
                    "dispatch_email: delivery failed"
                );
                record_delivery(
                    state,
                    alert_id,
                    tier,
                    "email",
                    Some(recipient_id),
                    "failed",
                    Some(&err_msg),
                )
                .await;
            }
            Err(e) => {
                error!(alert_id = %alert_id, error = %e, "dispatch_email: request error");
                let err_str = e.to_string();
                record_delivery(
                    state,
                    alert_id,
                    tier,
                    "email",
                    Some(recipient_id),
                    "failed",
                    Some(&err_str),
                )
                .await;
            }
        }
    }
}

/// Insert a delivery record into alert_deliveries.
async fn record_delivery(
    state: &AppState,
    alert_id: Uuid,
    tier: i16,
    channel: &str,
    recipient_id: Option<Uuid>,
    status: &str,
    error: Option<&str>,
) {
    let sent_at: Option<chrono::DateTime<Utc>> =
        if status == "sent" { Some(Utc::now()) } else { None };

    if let Err(e) = sqlx::query(
        "INSERT INTO alert_deliveries
             (alert_id, tier, channel, recipient_id, status, sent_at, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(alert_id)
    .bind(tier)
    .bind(channel)
    .bind(recipient_id)
    .bind(status)
    .bind(sent_at)
    .bind(error)
    .execute(&state.db)
    .await
    {
        error!(
            alert_id = %alert_id,
            error = %e,
            "record_delivery: failed to insert delivery record"
        );
    }
}
