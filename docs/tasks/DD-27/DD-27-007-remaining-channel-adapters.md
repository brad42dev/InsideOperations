---
id: DD-27-007
title: Implement SMS, Voice, Radio, PA, and BrowserPush channel adapters
unit: DD-27
status: pending
priority: medium
depends-on: [DD-27-001, DD-27-006]
---

## What This Feature Should Do

The spec defines a pluggable `AlertChannel` trait with 7 adapter types. The alert-service must implement the trait and concrete adapters for all 7 channels. Only the email adapter is real; the WebSocket adapter needs wiring (DD-27-002). This task covers the five remaining adapters: SMS (Twilio REST), Voice Call (Twilio Calls API), Radio Dispatch (generic HTTP), PA System (REST/SIP/relay), and Browser Push (web-push-native VAPID). Adapters that are disabled via `alert_channels` configuration should no-op gracefully.

## Spec Excerpt (verbatim)

> ```rust
> #[async_trait]
> pub trait AlertChannel: Send + Sync {
>     fn channel_type(&self) -> ChannelType;
>     fn display_name(&self) -> &str;
>     async fn deliver(&self, alert: &Alert, recipients: &[ChannelRecipient]) -> Vec<DeliveryResult>;
>     async fn health_check(&self) -> Result<(), ChannelError>;
> }
> ```
>
> **SMS**: `POST https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json` via reqwest. MiniJinja template for body. Fallback provider config supported.
>
> **Browser Push**: `web-push-native` crate (MIT/Apache-2.0). Users opt in; push subscription stored in `push_subscriptions` table.
> — design-docs/27_ALERT_SYSTEM.md, §Channel Adapters

## Where to Look in the Codebase

Primary files:
- `services/alert-service/src/handlers/escalation.rs:106-126` — current match on channel string; extend here or refactor to trait dispatch
- `services/alert-service/Cargo.toml` — add `web-push-native`, `async-trait`
- `services/alert-service/src/handlers/` — create `channels/` subdirectory with one file per adapter

## Verification Checklist

- [ ] `AlertChannel` trait defined in `src/channels/mod.rs` with `deliver` and `health_check`
- [ ] `SmsAdapter` calls Twilio Messages API with Basic auth (`{sid}:{token}`) and MiniJinja body template
- [ ] `SmsAdapter` truncates message to `max_length` (default 160) with `...` suffix
- [ ] `VoiceAdapter` calls Twilio Calls API; stores call SID as `external_id` in delivery record
- [ ] `RadioAdapter` makes HTTP POST to `dispatch_url` with configured auth; uses talkgroup mapping from channel config
- [ ] `PaAdapter` supports REST mode; SIP mode and relay mode can be stubbed with log + "sent" status for now
- [ ] `BrowserPushAdapter` reads `push_subscriptions` for each recipient user and sends VAPID push via `web-push-native`
- [ ] `GET /api/alerts/channels` route lists all channels with enabled status; `PUT /api/alerts/channels/:type` updates config; `POST /api/alerts/channels/:type/test` sends a test alert to the current user
- [ ] Channel configuration secrets (Twilio auth token, VAPID private key) are stored encrypted in `alert_channels.config` JSONB and decrypted at runtime using the master key

## Assessment

- **Status**: ❌ Missing — no `AlertChannel` trait, no SMS/Voice/Radio/PA/BrowserPush adapters, no channel config routes

## Fix Instructions (if needed)

1. Create directory `services/alert-service/src/channels/` with:
   - `mod.rs` — trait definition + `ChannelType` enum + `ChannelRecipient` + `DeliveryResult`
   - `sms.rs` — Twilio SMS via `reqwest`
   - `voice.rs` — Twilio Calls API
   - `radio.rs` — generic HTTP dispatch
   - `pa.rs` — REST mode (SIP/relay stubbed)
   - `browser_push.rs` — `web-push-native` + `push_subscriptions` table

2. Add to `services/alert-service/Cargo.toml`:
   ```toml
   async-trait = "0.1"
   web-push-native = "0.5"  # verify latest, MIT/Apache-2.0
   ```

3. Update `dispatch_tier_impl` to load the enabled channels from `alert_channels` table and use trait dispatch instead of the manual match arm.

4. Create `services/alert-service/src/handlers/channel_config.rs` with:
   - `list_channels` — reads `alert_channels` table; masks secret fields
   - `update_channel` — validates config keys per channel type; re-encrypts secrets
   - `enable_channel` — sets `enabled` flag
   - `test_channel` — sends a test message to the authenticated user via that channel

5. Register channel routes in `main.rs`:
   ```rust
   .route("/alerts/channels", get(handlers::channel_config::list_channels))
   .route("/alerts/channels/:type", put(handlers::channel_config::update_channel))
   .route("/alerts/channels/:type/enabled", put(handlers::channel_config::enable_channel))
   .route("/alerts/channels/:type/test", post(handlers::channel_config::test_channel))
   ```

6. Add Twilio webhook routes (status + voice keypress callbacks) to `main.rs` and implement signature validation using Twilio's HMAC-SHA1 scheme.

Do NOT:
- Store Twilio auth tokens or VAPID private keys in plaintext in the database — encrypt with the master key from `LoadCredentialEncrypted`
- Make SIP mode blocking — if SIP is needed, it must be async
- Use `reqwest::blocking` — all HTTP calls must be async
