use chrono::Utc;
use sqlx::Row;
use std::time::Duration;
use tokio_util::sync::CancellationToken;
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

/// On startup, resume escalation for all active alerts that have a policy configured.
///
/// For each active alert this function determines which tier should fire next, queries
/// `alert_deliveries` to find when the current tier was actually dispatched, computes the
/// remaining delay, and either fires the next tier immediately (if overdue) or arms a
/// cancellable timer for the remaining duration. The HTTP listener is never blocked — callers
/// must spawn this as a background task.
pub async fn recover_escalations(state: AppState) {
    let now = Utc::now();

    // Query active alerts that have an escalation policy configured.
    // `escalation_policy` is stored as JSONB containing at minimum {"policy_id": "<uuid>"}.
    let rows = match sqlx::query(
        "SELECT id, escalation_policy, current_escalation
         FROM alerts
         WHERE status = 'active' AND escalation_policy IS NOT NULL",
    )
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            error!(error = %e, "recover_escalations: failed to query active alerts");
            return;
        }
    };

    info!(
        count = rows.len(),
        "recover_escalations: found active alerts with policies"
    );

    for row in &rows {
        let alert_id: Uuid = row.get("id");
        let current_escalation: i16 = row.get("current_escalation");
        let escalation_policy: Option<serde_json::Value> = row.get("escalation_policy");

        // Extract policy_id from the JSONB escalation_policy field.
        let policy_id: Option<Uuid> = escalation_policy
            .as_ref()
            .and_then(|v| v.get("policy_id"))
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<Uuid>().ok());

        let policy_id = match policy_id {
            Some(p) => p,
            None => {
                warn!(
                    alert_id = %alert_id,
                    "recover_escalations: no valid policy_id in escalation_policy JSONB, skipping"
                );
                continue;
            }
        };

        let next_tier = current_escalation + 1;

        // Find the next tier configuration.
        let tier_row = match sqlx::query(
            "SELECT escalate_after_mins FROM escalation_tiers
             WHERE policy_id = $1 AND tier_order = $2",
        )
        .bind(policy_id)
        .bind(next_tier)
        .fetch_optional(&state.db)
        .await
        {
            Ok(r) => r,
            Err(e) => {
                error!(
                    alert_id = %alert_id,
                    error = %e,
                    "recover_escalations: failed to query next tier config"
                );
                continue;
            }
        };

        let tier_row = match tier_row {
            Some(r) => r,
            None => {
                info!(
                    alert_id = %alert_id,
                    next_tier,
                    "recover_escalations: no next tier exists, escalation chain complete"
                );
                continue;
            }
        };

        let delay_mins: i16 = tier_row.get("escalate_after_mins");

        // Determine when the current tier was actually dispatched by querying alert_deliveries.
        // We must NOT use created_at — the current tier may have been dispatched well after alert creation.
        let last_dispatch: Option<chrono::DateTime<Utc>> = match sqlx::query_scalar(
            "SELECT MAX(sent_at) FROM alert_deliveries
             WHERE alert_id = $1 AND escalation_level = $2",
        )
        .bind(alert_id)
        .bind(current_escalation)
        .fetch_one(&state.db)
        .await
        {
            Ok(v) => v,
            Err(e) => {
                warn!(
                    alert_id = %alert_id,
                    error = %e,
                    "recover_escalations: failed to query last dispatch time, treating as overdue"
                );
                None
            }
        };

        // Compute remaining seconds until next tier should fire.
        // If no delivery record exists for the current tier, treat the alert as overdue.
        let elapsed_secs = match last_dispatch {
            Some(t) => (now - t).num_seconds().max(0) as u64,
            None => {
                // No delivery record — either tier 0 never recorded or we have no data.
                // Fire immediately to avoid missing escalations.
                delay_mins as u64 * 60
            }
        };
        let total_delay_secs = delay_mins as u64 * 60;
        let remaining_secs = total_delay_secs.saturating_sub(elapsed_secs);

        info!(
            alert_id = %alert_id,
            next_tier,
            elapsed_secs,
            remaining_secs,
            "recover_escalations: scheduling recovery timer"
        );

        // Create a CancellationToken and register it so callers can cancel escalation
        // (e.g. when the alert is acknowledged).
        let token = CancellationToken::new();
        state.escalation_tokens.insert(alert_id, token.clone());

        let state_clone = state.clone();
        tokio::spawn(async move {
            tokio::select! {
                _ = token.cancelled() => {
                    info!(alert_id = %alert_id, "recover_escalations: timer cancelled");
                    state_clone.escalation_tokens.remove(&alert_id);
                    return;
                }
                _ = tokio::time::sleep(Duration::from_secs(remaining_secs)) => {}
            }

            // Remove the token before dispatching (dispatch_tier_impl will insert a new one).
            state_clone.escalation_tokens.remove(&alert_id);
            dispatch_tier(state_clone, alert_id, next_tier).await;
        });
    }
}

async fn dispatch_tier_impl(state: AppState, alert_id: Uuid, tier: i16) {
    // Load alert status and policy_id
    let alert_row = sqlx::query(
        "SELECT status, severity, escalation_policy, title, message, roster_id FROM alerts WHERE id = $1",
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
    let severity: String = alert_row.get("severity");
    let escalation_policy: Option<serde_json::Value> = alert_row.get("escalation_policy");
    let title: String = alert_row.get("title");
    let message: Option<String> = alert_row.get("message");
    let alert_roster_id: Option<Uuid> = alert_row.get("roster_id");

    // Only dispatch if still active
    if status != "active" {
        info!(
            alert_id = %alert_id,
            status = %status,
            "dispatch_tier: alert not active, skipping escalation"
        );
        return;
    }

    // Extract policy_id from escalation_policy JSONB if present
    let policy_id: Option<Uuid> = escalation_policy
        .as_ref()
        .and_then(|v| v.get("policy_id"))
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<Uuid>().ok());

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
    let channels: Vec<String> = tier_row.get("channels");

    // Resolve recipients: prefer the roster_id on the alert; fall back to notify_users
    // UUID array on the tier for backwards compatibility.
    let email_recipients: Vec<Uuid> = if let Some(roster_id) = alert_roster_id {
        // Resolve via roster — get user_ids from ChannelRecipient list
        crate::handlers::rosters::resolve_roster_members(&state, roster_id)
            .await
            .into_iter()
            .filter_map(|r| r.user_id)
            .collect()
    } else {
        // Fall back to the static notify_users array on the tier
        tier_row.get("notify_users")
    };

    // Update current_escalation on the alert
    if let Err(e) = sqlx::query("UPDATE alerts SET current_escalation = $1 WHERE id = $2")
        .bind(tier)
        .bind(alert_id)
        .execute(&state.db)
        .await
    {
        error!(alert_id = %alert_id, error = %e, "dispatch_tier: failed to update current_escalation");
    }

    // Log the escalation step in the audit table.
    // from_level is the escalation level before this dispatch; to_level is the current tier.
    let from_level = tier - 1;
    if let Err(e) = sqlx::query(
        "INSERT INTO alert_escalations (alert_id, from_level, to_level, reason)
         VALUES ($1, $2, $3, 'no_acknowledgment')",
    )
    .bind(alert_id)
    .bind(from_level)
    .bind(tier)
    .execute(&state.db)
    .await
    {
        error!(
            alert_id = %alert_id,
            error = %e,
            "dispatch_tier: failed to insert alert_escalations record"
        );
        // Non-fatal: continue delivery even if audit record fails
    }

    // Dispatch each channel
    for channel in &channels {
        match channel.as_str() {
            "email" => {
                dispatch_email(
                    &state,
                    alert_id,
                    tier,
                    &title,
                    message.as_deref(),
                    &email_recipients,
                )
                .await;
            }
            "websocket" => {
                dispatch_websocket(
                    &state,
                    alert_id,
                    tier,
                    &title,
                    message.as_deref(),
                    &severity,
                    &channels,
                )
                .await;
            }
            "sms" | "voice" | "radio" | "pa" | "browser_push" => {
                dispatch_channel_adapter(
                    &state,
                    alert_id,
                    tier,
                    channel,
                    &title,
                    message.as_deref(),
                    &severity,
                    &email_recipients,
                )
                .await;
            }
            other => {
                warn!(alert_id = %alert_id, channel = other, "dispatch_tier: unknown channel");
            }
        }
    }

    // Create a CancellationToken for this alert and register it.
    // A single token per alert covers all future tiers — cancelling it stops the chain.
    let token = CancellationToken::new();
    state.escalation_tokens.insert(alert_id, token.clone());

    // Schedule next escalation after escalate_after_mins
    let delay_mins = escalate_after_mins as u64;
    let next_tier = tier + 1;

    // Clone state for the background task
    let state_for_task = state.clone();
    tokio::spawn(async move {
        tokio::select! {
            _ = token.cancelled() => {
                info!(alert_id = %alert_id, tier, "Escalation timer cancelled");
                // Remove the token from the registry (clean up)
                state_for_task.escalation_tokens.remove(&alert_id);
                return;
            }
            _ = tokio::time::sleep(std::time::Duration::from_secs(delay_mins * 60)) => {}
        }

        // Re-check if alert is still active before escalating
        let still_active = sqlx::query("SELECT status FROM alerts WHERE id = $1")
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
                state_for_task.escalation_tokens.remove(&alert_id);
                return;
            }
            Err(e) => {
                error!(alert_id = %alert_id, error = %e, "Failed to check alert status for escalation");
                state_for_task.escalation_tokens.remove(&alert_id);
                return;
            }
        };

        match current_status.as_deref() {
            Some("active") => {
                // Remove old token before dispatching next tier (next tier will insert a new one)
                state_for_task.escalation_tokens.remove(&alert_id);

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
                            metrics::counter!("io_alert_escalated_total").increment(1);
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
                state_for_task.escalation_tokens.remove(&alert_id);
            }
            None => {
                warn!(alert_id = %alert_id, "Alert disappeared, halting escalation");
                state_for_task.escalation_tokens.remove(&alert_id);
            }
        }
    });
}

/// Broadcast an alert_notification WebSocket message to ALL connected sessions
/// via the data-broker's /internal/broadcast HTTP endpoint.
///
/// For EMERGENCY severity, `full_screen_takeover` is set to `true`.
/// Delivery is recorded as "sent" on HTTP 200, "failed" otherwise.
async fn dispatch_websocket(
    state: &AppState,
    alert_id: Uuid,
    tier: i16,
    title: &str,
    body: Option<&str>,
    severity: &str,
    channels_active: &[String],
) {
    let payload = serde_json::json!({
        "type": "alert_notification",
        "payload": {
            "alert_id": alert_id,
            "severity": severity,
            "title": title,
            "message": body.unwrap_or(""),
            "triggered_at": Utc::now(),
            "triggered_by": "Alert Service",
            "requires_acknowledgment": true,
            "full_screen_takeover": severity == "emergency",
            "channels_active": channels_active,
        }
    });

    let url = format!("{}/internal/broadcast", state.config.data_broker_url);
    let result = state
        .http
        .post(&url)
        .header("x-io-service-secret", &state.config.service_secret)
        .json(&payload)
        .send()
        .await;

    let (delivery_status, failure_reason): (&str, Option<String>) = match result {
        Ok(resp) if resp.status().is_success() => {
            info!(
                alert_id = %alert_id,
                tier,
                "dispatch_websocket: alert_notification broadcast sent"
            );
            ("sent", None)
        }
        Ok(resp) => {
            let code = resp.status().as_u16();
            let msg = format!("data-broker returned HTTP {}", code);
            warn!(alert_id = %alert_id, tier, status_code = code, "dispatch_websocket: broadcast failed");
            ("failed", Some(msg))
        }
        Err(e) => {
            let msg = e.to_string();
            error!(alert_id = %alert_id, error = %msg, "dispatch_websocket: request error");
            ("failed", Some(msg))
        }
    };

    record_delivery(
        state,
        alert_id,
        tier,
        "websocket",
        None,
        None,
        None,
        delivery_status,
        failure_reason.as_deref(),
    )
    .await;
}

/// Send email notifications via the email-service /internal/send endpoint.
async fn dispatch_email(
    state: &AppState,
    alert_id: Uuid,
    tier: i16,
    title: &str,
    message: Option<&str>,
    recipients: &[Uuid],
) {
    if recipients.is_empty() {
        info!(alert_id = %alert_id, "dispatch_email: no recipients, skipping");
        return;
    }

    for &recipient_id in recipients {
        // Look up the user's email address and display name
        let email_row = sqlx::query("SELECT email, display_name FROM users WHERE id = $1")
            .bind(recipient_id)
            .fetch_optional(&state.db)
            .await;

        let (email_addr, recipient_name): (String, Option<String>) = match email_row {
            Ok(Some(row)) => {
                use sqlx::Row;
                (
                    row.get("email"),
                    row.try_get("display_name").unwrap_or(None),
                )
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
                    None,
                    None,
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
                    None,
                    None,
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
            "text": message.unwrap_or(title),
            "html": format!(
                "<p><strong>Alert:</strong> {}</p><p>{}</p>",
                title,
                message.unwrap_or("")
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
                    recipient_name.as_deref(),
                    Some(&email_addr),
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
                    recipient_name.as_deref(),
                    Some(&email_addr),
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
                    recipient_name.as_deref(),
                    Some(&email_addr),
                    "failed",
                    Some(&err_str),
                )
                .await;
            }
        }
    }
}

/// Insert a delivery record into alert_deliveries.
#[allow(clippy::too_many_arguments)]
async fn record_delivery(
    state: &AppState,
    alert_id: Uuid,
    escalation_level: i16,
    channel_type: &str,
    recipient_user_id: Option<Uuid>,
    recipient_name: Option<&str>,
    recipient_contact: Option<&str>,
    status: &str,
    failure_reason: Option<&str>,
) {
    let sent_at: Option<chrono::DateTime<Utc>> = if status == "sent" {
        Some(Utc::now())
    } else {
        None
    };

    if let Err(e) = sqlx::query(
        "INSERT INTO alert_deliveries
             (alert_id, escalation_level, channel_type, recipient_user_id,
              recipient_name, recipient_contact, status, sent_at, failure_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(alert_id)
    .bind(escalation_level)
    .bind(channel_type)
    .bind(recipient_user_id)
    .bind(recipient_name)
    .bind(recipient_contact)
    .bind(status)
    .bind(sent_at)
    .bind(failure_reason)
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

/// Dispatch an alert via one of the pluggable channel adapters (sms, voice, radio, pa, browser_push).
///
/// The function loads the channel configuration from `alert_channels`, decrypts secrets,
/// enriches the recipient list with channel-specific contact data (phone, talkgroup, push
/// subscriptions), constructs the adapter, calls `deliver`, and persists delivery records.
#[allow(clippy::too_many_arguments)]
async fn dispatch_channel_adapter(
    state: &AppState,
    alert_id: Uuid,
    tier: i16,
    channel_type_str: &str,
    title: &str,
    message: Option<&str>,
    _severity: &str,
    recipient_ids: &[Uuid],
) {
    use crate::channels::{
        browser_push::{BrowserPushAdapter, BrowserPushConfig},
        pa::{PaAdapter, PaConfig},
        radio::{RadioAdapter, RadioConfig},
        sms::{SmsAdapter, SmsConfig},
        voice::{VoiceAdapter, VoiceConfig},
        AlertChannel, AlertSummary,
    };

    // Load channel config from DB.
    let row = sqlx::query("SELECT enabled, config FROM alert_channels WHERE channel_type = $1")
        .bind(channel_type_str)
        .fetch_optional(&state.db)
        .await;

    let row = match row {
        Ok(Some(r)) => r,
        Ok(None) => {
            info!(
                alert_id = %alert_id,
                channel = channel_type_str,
                "dispatch_channel_adapter: channel not configured, skipping"
            );
            return;
        }
        Err(e) => {
            error!(alert_id = %alert_id, error = %e, "dispatch_channel_adapter: db error loading channel");
            return;
        }
    };

    let enabled: bool = row.get("enabled");
    if !enabled {
        info!(
            alert_id = %alert_id,
            channel = channel_type_str,
            "dispatch_channel_adapter: channel disabled, skipping"
        );
        return;
    }

    let config_val: Option<serde_json::Value> = row.get("config");
    let mut config_val = match config_val {
        Some(c) => c,
        None => {
            warn!(alert_id = %alert_id, channel = channel_type_str, "dispatch_channel_adapter: no config");
            return;
        }
    };

    // Decrypt secrets in config.
    if let Err(e) =
        crate::handlers::channel_config::decrypt_secrets_for_dispatch(state, &mut config_val)
    {
        error!(alert_id = %alert_id, error = %e, "dispatch_channel_adapter: failed to decrypt config");
        return;
    }

    let alert_summary = AlertSummary {
        id: alert_id,
        title: title.to_string(),
        message: message.map(|s| s.to_string()),
        severity: _severity.to_string(),
    };

    // Enrich recipients: load channel-specific contact data for each user.
    let recipients = enrich_recipients(state, recipient_ids, channel_type_str).await;

    // Build adapter and deliver.
    let results: Vec<crate::channels::DeliveryResult> = match channel_type_str {
        "sms" => match serde_json::from_value::<SmsConfig>(config_val) {
            Ok(cfg) => {
                SmsAdapter::new(cfg, state.http.clone())
                    .deliver(&alert_summary, &recipients)
                    .await
            }
            Err(e) => {
                error!(alert_id = %alert_id, error = %e, "dispatch_channel_adapter/sms: invalid config");
                return;
            }
        },
        "voice" => match serde_json::from_value::<VoiceConfig>(config_val) {
            Ok(cfg) => {
                VoiceAdapter::new(cfg, state.http.clone())
                    .deliver(&alert_summary, &recipients)
                    .await
            }
            Err(e) => {
                error!(alert_id = %alert_id, error = %e, "dispatch_channel_adapter/voice: invalid config");
                return;
            }
        },
        "radio" => match serde_json::from_value::<RadioConfig>(config_val) {
            Ok(cfg) => {
                RadioAdapter::new(cfg, state.http.clone())
                    .deliver(&alert_summary, &recipients)
                    .await
            }
            Err(e) => {
                error!(alert_id = %alert_id, error = %e, "dispatch_channel_adapter/radio: invalid config");
                return;
            }
        },
        "pa" => match serde_json::from_value::<PaConfig>(config_val) {
            Ok(cfg) => {
                PaAdapter::new(cfg, state.http.clone())
                    .deliver(&alert_summary, &recipients)
                    .await
            }
            Err(e) => {
                error!(alert_id = %alert_id, error = %e, "dispatch_channel_adapter/pa: invalid config");
                return;
            }
        },
        "browser_push" => match serde_json::from_value::<BrowserPushConfig>(config_val) {
            Ok(cfg) => {
                BrowserPushAdapter::new(cfg, state)
                    .deliver(&alert_summary, &recipients)
                    .await
            }
            Err(e) => {
                error!(alert_id = %alert_id, error = %e, "dispatch_channel_adapter/browser_push: invalid config");
                return;
            }
        },
        other => {
            warn!(alert_id = %alert_id, channel = other, "dispatch_channel_adapter: unhandled channel type");
            return;
        }
    };

    // Persist delivery records.
    for result in &results {
        record_delivery(
            state,
            alert_id,
            tier,
            channel_type_str,
            result.recipient_user_id,
            None, // recipient_name not carried through DeliveryResult
            result.recipient_contact.as_deref(),
            &result.status,
            result.failure_reason.as_deref(),
        )
        .await;
        // Store external_id (e.g. Twilio call SID) as a note in the failure_reason field if present.
        // A future task can add a dedicated `external_id` column to alert_deliveries.
        if let Some(ref ext_id) = result.external_id {
            info!(
                alert_id = %alert_id,
                channel = channel_type_str,
                external_id = %ext_id,
                "dispatch_channel_adapter: delivery external_id"
            );
        }
    }
}

/// Enrich a list of user IDs with channel-specific contact data loaded from the database.
///
/// - SMS/Voice: loads the `phone` column from the `users` table
/// - Radio: loads the `talkgroup_id` from `user_profiles` or channel config mapping
/// - PA: loads `pa_zone` from user profile data
/// - BrowserPush: does NOT preload here — `BrowserPushAdapter` queries `push_subscriptions` directly
async fn enrich_recipients(
    state: &AppState,
    user_ids: &[Uuid],
    channel_type_str: &str,
) -> Vec<crate::channels::ChannelRecipient> {
    use crate::channels::ChannelRecipient;

    if user_ids.is_empty() {
        // For broadcast channels (radio, pa) return an empty vec — the adapter handles
        // no-recipient case by broadcasting to the default talkgroup/zone.
        return vec![];
    }

    match channel_type_str {
        "sms" | "voice" => {
            // Load email, display_name, phone for each user.
            let mut result = Vec::with_capacity(user_ids.len());
            for &uid in user_ids {
                let row = sqlx::query("SELECT display_name, email, phone FROM users WHERE id = $1")
                    .bind(uid)
                    .fetch_optional(&state.db)
                    .await;

                let recipient = match row {
                    Ok(Some(r)) => ChannelRecipient {
                        user_id: Some(uid),
                        name: r.try_get("display_name").unwrap_or(None),
                        email: r.try_get("email").ok(),
                        phone: r.try_get("phone").unwrap_or(None),
                        ..Default::default()
                    },
                    Ok(None) => {
                        warn!(user_id = %uid, "enrich_recipients: user not found");
                        ChannelRecipient {
                            user_id: Some(uid),
                            ..Default::default()
                        }
                    }
                    Err(e) => {
                        error!(user_id = %uid, error = %e, "enrich_recipients: db error");
                        ChannelRecipient {
                            user_id: Some(uid),
                            ..Default::default()
                        }
                    }
                };
                result.push(recipient);
            }
            result
        }
        "browser_push" => {
            // BrowserPushAdapter loads subscriptions itself from push_subscriptions.
            // We just need user_id in the recipient.
            user_ids
                .iter()
                .map(|&uid| ChannelRecipient {
                    user_id: Some(uid),
                    ..Default::default()
                })
                .collect()
        }
        "radio" | "pa" => {
            // Radio/PA typically broadcast to a zone/talkgroup regardless of per-user routing.
            // Return recipients with user_id set; the adapter will fall back to default zone/talkgroup.
            user_ids
                .iter()
                .map(|&uid| ChannelRecipient {
                    user_id: Some(uid),
                    ..Default::default()
                })
                .collect()
        }
        _ => user_ids
            .iter()
            .map(|&uid| ChannelRecipient {
                user_id: Some(uid),
                ..Default::default()
            })
            .collect(),
    }
}
