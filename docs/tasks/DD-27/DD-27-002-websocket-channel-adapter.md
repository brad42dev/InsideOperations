---
id: DD-27-002
title: Implement WebSocket alert fanout via data-broker HTTP broadcast endpoint
unit: DD-27
status: pending
priority: high
depends-on: [DD-27-001]
---

## What This Feature Should Do

When an alert is triggered, the alert-service must broadcast an `alert_notification` WebSocket message to ALL connected sessions through the data-broker. For EMERGENCY severity, the message must include `full_screen_takeover: true`. When any client acknowledges the alert, the service must broadcast `alert_acknowledged` so all windows can dismiss the overlay. Currently the WebSocket "channel" is a log statement that records `"sent"` without sending anything.

## Spec Excerpt (verbatim)

> **Broadcast semantics**: Alert messages are sent to ALL connected WebSocket sessions — not filtered by point subscription. This is a different fanout pattern than point updates. The WebSocket broker adds an `alert` topic that all sessions auto-subscribe to.
>
> **Server → Client message**:
> ```json
> {
>   "type": "alert_notification",
>   "payload": {
>     "alert_id": "uuid",
>     "severity": "emergency",
>     "title": "...",
>     "message": "...",
>     "triggered_at": "...",
>     "triggered_by": "Event Service",
>     "requires_acknowledgment": true,
>     "full_screen_takeover": true,
>     "channels_active": ["websocket", "sms", "email", "radio", "pa"]
>   }
> }
> ```
> — design-docs/27_ALERT_SYSTEM.md, §Channel Adapters — WebSocket (Built-in)

## Where to Look in the Codebase

Primary files:
- `services/alert-service/src/handlers/escalation.rs:107-126` — the stub WebSocket "dispatch" (logs + records sent, no HTTP call)
- `services/alert-service/src/config.rs:8` — `data_broker_url` is already in config but marked `#[allow(dead_code)]`
- `services/alert-service/src/state.rs` — `AppState` already has `http: reqwest::Client`
- `services/data-broker/src/` — check what broadcast endpoint exists (if any)

## Verification Checklist

- [ ] `dispatch_websocket` makes an HTTP POST to `{data_broker_url}/internal/broadcast` (or equivalent) with the `alert_notification` JSON body
- [ ] The `"alert_notification"` message shape matches spec: `alert_id`, `severity`, `title`, `message`, `triggered_at`, `triggered_by`, `requires_acknowledgment`, `full_screen_takeover` (true for EMERGENCY), `channels_active`
- [ ] `full_screen_takeover` is set to `true` only when `severity == "emergency"`
- [ ] `acknowledge_alert` handler (alerts.rs:269) broadcasts `"alert_acknowledged"` message with `alert_id`, `acknowledged_by`, `acknowledged_by_name`, `acknowledged_at` via data-broker after DB update
- [ ] Delivery status is recorded as `"sent"` on successful HTTP 200 from data-broker, `"failed"` otherwise

## Assessment

- **Status**: ❌ Missing — current code at `escalation.rs:113-120` logs and records "sent" without any HTTP call

## Fix Instructions (if needed)

1. Remove the `#[allow(dead_code)]` on `data_broker_url` in `config.rs:8`.

2. In `escalation.rs`, replace the WebSocket stub (lines 113-120) with a `dispatch_websocket` async function:
   ```rust
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
               "requires_acknowledgment": true,
               "full_screen_takeover": severity == "emergency",
               "channels_active": channels_active,
           }
       });
       let url = format!("{}/internal/broadcast", state.config.data_broker_url);
       let result = state.http.post(&url)
           .header("x-io-service-secret", &state.config.service_secret)
           .json(&payload)
           .send()
           .await;
       // record delivery based on result status
   }
   ```

3. In `alerts.rs`, after the `UPDATE alert_instances SET status = 'acknowledged'` (line 301-318), add a call to broadcast `"alert_acknowledged"` to the data-broker:
   ```json
   { "type": "alert_acknowledged", "payload": { "alert_id": "...", "acknowledged_by": "...", "acknowledged_at": "..." } }
   ```

4. Check `services/data-broker/src/` to confirm the broadcast endpoint path. If no broadcast endpoint exists yet, create a stub `POST /internal/broadcast` in the data-broker that publishes to all connected WebSocket sessions on the `alert` topic.

Do NOT:
- Open a direct WebSocket connection from the alert-service to each browser client — always go through the data-broker
- Record the delivery as "sent" if the data-broker HTTP call fails
