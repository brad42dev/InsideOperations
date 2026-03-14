# 27. Alert System

## Overview

The Alert System provides plant-wide emergency and operational alerting for Inside/Operations. It is a standalone Rust/Axum service (port 3007) that accepts alert triggers from any source — manual operator action, Event Service threshold breaches, OPC connection failures, overdue rounds — and fans out notifications across multiple delivery channels simultaneously.

The system is built on a **pluggable channel adapter pattern**. Each deployment configures which channels are active based on site infrastructure. The Alert Service ships with adapters for the most common channels; custom adapters can be built for site-specific systems.

### Design Principles

1. **Reliability over speed** — Alerts must never be silently lost. Queue-based delivery with retry. Audit trail for every action.
2. **Redundant delivery** — Emergency alerts go out on multiple channels simultaneously. If SMS fails, WebSocket and email still deliver.
3. **Pluggable channels** — No hard dependencies on any external service. A site with no radios simply disables the radio adapter.
4. **Separation of concerns** — The Alert Service owns routing, escalation, and delivery tracking. It delegates email to the Email Service (doc 28) and uses provider-specific adapters for everything else.
5. **Auditable** — Every alert trigger, delivery attempt, acknowledgment, and escalation is logged. Satisfies OSHA PSM and EPA RMP documentation requirements.

---

## Architecture

### System Context

```
                          ┌──────────────────┐
   Event Service ────────>│                  │──── WebSocket Broker ──── Browser alerts
   Manual trigger ───────>│                  │                          (full-screen takeover)
   OPC failures ─────────>│   Alert Service  │──── Email Service ─────── Email
   Overdue rounds ───────>│   (Port 3007)    │
   Scheduled alerts ─────>│                  │──── Twilio API ────────── SMS / Voice
                          │                  │
                          │  Alert Engine    │──── Radio Dispatch ────── Two-way radios
                          │  Escalation Mgr  │     (SmartPTT/TRBOnet)
                          │  Delivery Track  │
                          │  Audit Log       │──── PA System ─────────── Speakers/sirens
                          │                  │     (SIP/REST/relay)
                          │                  │
                          │                  │──── Browser Push ──────── Push notifications
                          └────────┬─────────┘     (Web Push API)
                                   │
                              PostgreSQL
                          (alerts, deliveries,
                           escalations, config)
```

### Alert Flow

```
1. TRIGGER
   ├── POST /api/alerts (manual)
   ├── PostgreSQL NOTIFY alert_trigger (from Event Service)
   └── Internal timer (scheduled/recurring alerts)
         │
2. RESOLVE RECIPIENTS
   ├── Roster lookup (named groups of recipients)
   ├── On-shift filter (optional: only alert on-shift personnel)
   └── Per-channel contact resolution (phone for SMS, email for email, etc.)
         │
3. FAN-OUT
   ├── Queue delivery to each active channel simultaneously
   ├── Each channel adapter handles its own delivery + retry
   └── WebSocket broadcast is immediate (not queued)
         │
4. TRACK
   ├── Per-recipient, per-channel delivery status
   ├── Provider confirmations (Twilio delivery receipts, etc.)
   └── Failure logging with error details
         │
5. ESCALATE (if configured)
   ├── Timer-based: if no acknowledgment within threshold
   ├── Escalation adds channels, recipients, or severity
   └── Each escalation level is a separate delivery round
         │
6. ACKNOWLEDGE
   ├── Via WebSocket (browser UI), SMS reply, or API call
   ├── Cancels pending escalation timers
   └── Logged with who + when + from which channel
```

---

## Alert Severity Levels

| Level | Name | Behavior | Example |
|-------|------|----------|---------|
| 0 | **EMERGENCY** | Full-screen takeover on all I/O sessions. All channels fire simultaneously. Escalation enabled. Cannot be dismissed without acknowledgment. | Gas leak, fire, shelter-in-place, unit trip |
| 1 | **CRITICAL** | Prominent banner + audio alarm on I/O sessions. SMS + email. Escalation enabled. | Equipment failure, safety system override, loss of containment |
| 2 | **WARNING** | Persistent banner on I/O sessions. Email notification. No escalation by default. | High alarm on critical variable, approaching safe operating limit |
| 3 | **INFO** | Toast notification in I/O. Email optional. No escalation. | Scheduled maintenance reminder, shift change, report ready |

### Per-Severity Default Channels

Configurable per deployment. Factory defaults:

| Severity | WebSocket | Email | SMS | Voice | Radio | PA | Browser Push |
|----------|-----------|-------|-----|-------|-------|-----|-------------|
| EMERGENCY | Full-screen | Yes | Yes | Yes (escalation) | Yes | Yes | Yes |
| CRITICAL | Banner+audio | Yes | Yes | No | Optional | No | Yes |
| WARNING | Banner | Yes | No | No | No | No | No |
| INFO | Toast | Optional | No | No | No | No | No |

---

## Channel Adapters

### Adapter Trait

```rust
#[async_trait]
pub trait AlertChannel: Send + Sync {
    fn channel_type(&self) -> ChannelType;
    fn display_name(&self) -> &str;

    /// Deliver alert to recipients via this channel.
    /// Returns per-recipient delivery results.
    async fn deliver(
        &self,
        alert: &Alert,
        recipients: &[ChannelRecipient],
    ) -> Vec<DeliveryResult>;

    /// Test channel connectivity.
    async fn health_check(&self) -> Result<(), ChannelError>;
}

pub enum ChannelType {
    WebSocket,
    Email,
    Sms,
    Voice,
    Radio,
    Pa,
    BrowserPush,
}

pub struct ChannelRecipient {
    pub user_id: Option<Uuid>,
    pub contact: String,           // phone number, email, radio ID, etc.
    pub display_name: String,
}

pub struct DeliveryResult {
    pub recipient: ChannelRecipient,
    pub status: DeliveryStatus,    // Sent, Failed, Queued
    pub external_id: Option<String>,
    pub error: Option<String>,
}
```

### Shipped Adapters

#### 1. WebSocket (Built-in, Always Active)

Sends alert messages through I/O's existing WebSocket broker (doc 16). No external dependencies.

**Server → Client message**:
```json
{
  "type": "alert_notification",
  "payload": {
    "alert_id": "uuid",
    "severity": "emergency",
    "title": "Gas Leak Detected — Unit 4",
    "message": "H2S detected at TI-401. Shelter in place. Await all-clear.",
    "triggered_at": "2026-03-09T14:30:00Z",
    "triggered_by": "Event Service",
    "requires_acknowledgment": true,
    "full_screen_takeover": true,
    "channels_active": ["websocket", "sms", "email", "radio", "pa"]
  }
}
```

**Client → Server acknowledgment**:
```json
{
  "type": "acknowledge_alert",
  "alert_id": "uuid"
}
```

**Server → Client broadcast on acknowledgment**:
```json
{
  "type": "alert_acknowledged",
  "payload": {
    "alert_id": "uuid",
    "acknowledged_by": "jsmith",
    "acknowledged_by_name": "John Smith",
    "acknowledged_at": "2026-03-09T14:31:15Z"
  }
}
```

**Broadcast semantics**: Alert messages are sent to ALL connected WebSocket sessions — not filtered by point subscription. This is a different fanout pattern than point updates. The WebSocket broker adds an `alert` topic that all sessions auto-subscribe to.

**BroadcastChannel propagation**: The SharedWorker (doc 16) forwards alert messages to ALL open windows (main + detached Console/Process/Dashboard windows) via BroadcastChannel. Every window renders the alert independently.

#### 2. Email (via Email Service)

Delegates to the Email Service (doc 28) by posting to `POST /api/email/send` with the `alert_notification` or `alert_escalation` template.

**Configuration**: None beyond having at least one email provider configured in the Email Service.

**Recipient resolution**: Uses each recipient's email address from their I/O user profile.

**Priority**: Alert emails are queued as `critical` priority in the Email Service queue.

#### 3. SMS (Twilio)

Sends SMS messages via the Twilio Programmable Messaging API.

**Configuration**:

| Setting | Description |
|---------|-------------|
| `account_sid` | Twilio account SID |
| `auth_token` | Twilio auth token (encrypted at rest) |
| `from_number` | Twilio phone number (toll-free recommended for throughput) |
| `message_template` | MiniJinja template for SMS body (default: `[I/O {{severity}}] {{title}}: {{message}}`) |
| `max_length` | Maximum SMS length (default: 160, truncate with "..." if exceeded) |

**Implementation**: Direct REST API call via `reqwest`:
```
POST https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json
Authorization: Basic base64({sid}:{token})

To={recipient_phone}&From={from_number}&Body={rendered_message}
```

**Delivery tracking**: Twilio returns a `MessageSid`. The adapter stores this as `external_id` in `alert_deliveries`. Optionally, a webhook endpoint (`POST /api/alerts/webhooks/twilio`) receives delivery status callbacks to update delivery status (queued → sent → delivered / failed / undelivered).

**Throughput**: Toll-free number at 25 MPS handles 500 recipients in ~20 seconds. For larger deployments, configure a Twilio Messaging Service with number pooling.

**Fallback provider**: If Twilio is unavailable, a secondary SMS provider (Bandwidth, Telnyx, Plivo) can be configured. The adapter supports a `fallback_config` with the same fields for an alternate provider. Same REST pattern, different base URL and auth.

#### 4. Voice Call (Twilio)

Initiates automated voice calls for escalation when SMS goes unacknowledged.

**Configuration**: Same Twilio credentials as SMS, plus:

| Setting | Description |
|---------|-------------|
| `twiml_template` | TwiML template for the call script (uses `<Say>` verb with configurable voice) |
| `voice` | Twilio voice (default: `Polly.Matthew`) |
| `keypress_to_acknowledge` | DTMF digit to acknowledge (default: `1`) |
| `call_timeout` | Seconds to ring before giving up (default: 30) |

**Flow**: POST to Twilio's Calls API → Twilio calls the number → plays TwiML message → if recipient presses the acknowledge key → webhook callback updates alert as acknowledged.

**When used**: Typically only in escalation — e.g., if a CRITICAL alert gets no acknowledgment via WebSocket or SMS within the configured timeout, escalate to voice call.

#### 5. Radio Dispatch (Generic HTTP)

Sends text messages to two-way radios via dispatch console software APIs (SmartPTT, TRBOnet, or similar).

**Configuration**:

| Setting | Description |
|---------|-------------|
| `dispatch_url` | Base URL of dispatch software API |
| `auth_type` | `none` / `basic` / `bearer` / `api_key` |
| `auth_value` | Credentials (encrypted at rest) |
| `talkgroup_mapping` | JSON map of alert severity → talkgroup ID(s) |
| `message_template` | MiniJinja template for radio message (max 140 chars for compatibility) |
| `include_alert_tone` | Request escalating alert tone on radio (if supported by dispatch API) |

**Integration architecture**:
```
I/O Alert Service → HTTP POST → Dispatch Software API → Repeater → Radios
```

I/O never touches RF or proprietary radio protocols. The dispatch software (customer-provided, runs on their infrastructure) handles all radio-side complexity.

**Talkgroup mapping example**:
```json
{
  "emergency": [1, 2, 3],
  "critical": [1],
  "warning": [1],
  "info": []
}
```

**Message constraints**: Radio text messages are limited to 140 characters (280 on MOTOTRBO R2.5+). The template should be terse. Default: `[{{severity}}] {{title}} — {{message|truncate(100)}}`.

**Delivery confirmation**: If the dispatch API returns delivery status, the adapter records it. Otherwise, delivery is recorded as "sent" (fire-and-forget to the dispatch API).

**Supported dispatch software**: SmartPTT (Motorola), TRBOnet (Motorola), Hytera SmartDispatch, Kenwood KAS-10/KAS-20 — any dispatch software that exposes an HTTP API for sending text messages to radios/talkgroups. The adapter is generic HTTP; per-vendor payload differences are handled via the configurable `payload_template` field.

**Brand coverage**: Motorola MOTOTRBO (via SmartPTT/TRBOnet), Hytera DMR (via SmartDispatch), Kenwood NEXEDGE (via KAS dispatch), ICOM IDAS (via RC-FS10 if it exposes an API). For brands without API-capable dispatch software, a custom adapter or middleware is needed — this is the "build a specific integration for that site" scenario.

#### 6. PA System (SIP/REST/Relay)

Triggers public address announcements. Three sub-modes:

**6a. IP PA via REST API** (modern Algo, Axis, Barix, AtlasIED systems):

| Setting | Description |
|---------|-------------|
| `url` | PA endpoint URL |
| `auth_type` | `none` / `basic` / `bearer` |
| `auth_value` | Credentials (encrypted at rest) |
| `zone_mapping` | JSON map of alert severity → PA zone ID(s) |
| `audio_clip_mapping` | JSON map of alert severity → pre-uploaded audio clip ID |
| `tts_enabled` | Whether to send text-to-speech content (if PA supports it) |

**6b. IP PA via SIP** (SIP-enabled PA systems):

| Setting | Description |
|---------|-------------|
| `sip_uri` | SIP URI of the PA multicast group or zone |
| `sip_proxy` | Optional SIP proxy address |
| `tts_voice` | Piper TTS voice for generating spoken announcements |
| `audio_format` | PCM/WAV format for RTP stream |

The adapter generates audio using Piper TTS (MIT, offline, CPU-only) or `pocket-tts` (MIT/Apache-2.0, pure Rust), then streams it via SIP INVITE + RTP to the PA endpoint.

**6c. Relay trigger** (legacy analog PA):

| Setting | Description |
|---------|-------------|
| `relay_url` | URL of network relay device (ControlByWeb, Axis I/O relay) |
| `relay_auth` | Credentials (encrypted at rest) |
| `on_command` | HTTP request to activate relay (triggers siren/tone) |
| `off_command` | HTTP request to deactivate relay |
| `activation_duration_sec` | How long to keep relay activated (default: 30) |

**Reality check**: Most existing refinery PA systems are analog. Many sites will use sub-mode 6c (relay trigger for siren) or disable PA integration entirely and handle announcements manually. The REST and SIP modes are for sites that have upgraded to IP-based PA.

#### 7. Browser Push (Web Push API)

Sends push notifications via the Web Push API to operators who have I/O open in a browser but may be viewing another tab or application.

**Configuration**:

| Setting | Description |
|---------|-------------|
| `vapid_public_key` | VAPID public key (auto-generated on first setup) |
| `vapid_private_key` | VAPID private key (encrypted at rest, auto-generated) |
| `vapid_subject` | Contact email for VAPID (e.g., `mailto:admin@plant.com`) |

**Implementation**: `web-push-native` crate (MIT/Apache-2.0). Users opt in to push notifications in the I/O frontend; the Service Worker stores the push subscription in the backend. When an alert fires, the adapter sends a push to all subscribed sessions.

**Limitations**: Only works when the browser is open (not necessarily the I/O tab, but the browser process). Does not work if the browser is closed or if the device is asleep. This is a supplemental channel, not primary.

### Custom Adapters

For site-specific systems not covered by the shipped adapters, custom adapters can be built and compiled into the Alert Service. The adapter trait is the integration contract — implement `deliver()` and `health_check()`, register in the adapter registry, and the rest of the Alert System (routing, escalation, tracking, audit) works automatically.

Common custom adapter scenarios:
- Specific radio vendor without HTTP-capable dispatch software
- Proprietary plant notification system
- SCADA system integration (trigger alarms on a separate SCADA HMI)
- Paging systems (POCSAG via IP gateway)
- Zello Work (broadband PTT) for sites using smartphones instead of radios

---

## Escalation Engine

### Escalation Rules

Each alert template defines an escalation policy as an ordered list of levels:

```json
{
  "escalation_policy": [
    {
      "level": 0,
      "delay_seconds": 0,
      "channels": ["websocket", "email", "sms", "radio", "pa", "browser_push"],
      "roster_id": "uuid-on-shift-ops"
    },
    {
      "level": 1,
      "delay_seconds": 300,
      "channels": ["sms", "voice"],
      "roster_id": "uuid-shift-supervisors",
      "condition": "no_acknowledgment"
    },
    {
      "level": 2,
      "delay_seconds": 900,
      "channels": ["sms", "voice"],
      "roster_id": "uuid-plant-management",
      "condition": "no_acknowledgment"
    }
  ]
}
```

**Escalation flow**:
1. Alert is triggered → Level 0 fires immediately to all configured channels/recipients
2. Escalation timer starts (Tokio timer, not cron)
3. At each level's `delay_seconds`, check `condition`:
   - `no_acknowledgment`: escalate if no one has acknowledged
   - `always`: always escalate (used for mandatory notifications regardless of acknowledgment)
4. If condition is met, fire Level N delivery to the level's channels and roster
5. On acknowledgment at any point, cancel all pending escalation timers
6. Each escalation step is logged in `alert_escalations`

**Timer implementation**: Tokio `sleep` tasks spawned per alert. On acknowledgment, the task is cancelled via a `CancellationToken`. If the Alert Service restarts, pending escalations are recovered from the database (check for unacknowledged alerts with remaining escalation levels).

### Recovery After Restart

On startup, the Alert Service queries for:
- Active alerts (not acknowledged, not resolved, not cancelled)
- Their escalation policy and current escalation level
- Time elapsed since last escalation step

If an escalation step was missed during downtime, it fires immediately. Future steps resume their normal timers.

---

## Alert Templates

### Template Structure

```json
{
  "id": "uuid",
  "name": "Gas Leak Emergency",
  "severity": "emergency",
  "title_template": "Gas Leak Detected — {{unit}}",
  "message_template": "{{gas_type}} detected at {{instrument}}. {{action_required}}. Await all-clear from Control Room.",
  "channels": ["websocket", "email", "sms", "radio", "pa", "browser_push"],
  "default_roster_id": "uuid",
  "escalation_policy": [ ... ],
  "requires_acknowledgment": true,
  "auto_resolve_minutes": null,
  "category": "emergency",
  "variables": ["unit", "gas_type", "instrument", "action_required"]
}
```

### Built-In Templates

| Template | Severity | Channels | Escalation |
|----------|----------|----------|------------|
| `gas_leak` | EMERGENCY | All | 3-level (ops → supervisor → management) |
| `fire_alarm` | EMERGENCY | All | 3-level |
| `shelter_in_place` | EMERGENCY | All | 3-level |
| `evacuation` | EMERGENCY | All | 3-level |
| `all_clear` | INFO | WebSocket, email, radio | None |
| `unit_trip` | CRITICAL | WebSocket, email, SMS, radio | 2-level |
| `equipment_failure` | CRITICAL | WebSocket, email, SMS | 2-level |
| `safety_system_override` | CRITICAL | WebSocket, email, SMS | 2-level |
| `high_alarm` | WARNING | WebSocket, email | None |
| `opc_connection_lost` | WARNING | WebSocket, email | 1-level (admin) |
| `round_overdue` | WARNING | WebSocket, email | 1-level (supervisor) |
| `report_ready` | INFO | WebSocket | None |
| `maintenance_reminder` | INFO | WebSocket, email | None |
| `custom` | Configurable | Configurable | Configurable |

These are starting points. Site administrators customize or create new templates to match their specific emergency response procedures.

---

## Recipient Rosters

### Roster Model

A roster is a named group of alert recipients. Each recipient has contact information per channel:

```json
{
  "id": "uuid",
  "name": "On-Shift Operations",
  "description": "Current shift operators and board operators",
  "source": "manual",
  "members": [
    {
      "user_id": "uuid (nullable — external contacts have no I/O account)",
      "name": "John Smith",
      "role": "Board Operator",
      "contacts": {
        "email": "jsmith@plant.com",
        "phone": "+15551234567",
        "radio_id": "4001"
      }
    }
  ]
}
```

### Roster Sources

- **Manual**: Administrator creates and maintains the roster in Settings UI
- **User group**: Roster dynamically includes all I/O users with a specific role (e.g., all users with the "Operator" role). Membership updates automatically as users are added/removed from the role.
- **On-shift**: Targets personnel currently on shift. Membership resolved dynamically from shift schedule data managed by the Access Control & Presence module (doc 30). Grayed out in the UI if no shift data is configured.
- **On-site**: Targets personnel currently on site. Membership resolved dynamically from badge-in/badge-out data managed by the Access Control & Presence module (doc 30). Grayed out in the UI if no access control integration is configured.

> **Note**: Shift schedules and on-site presence data are managed by the Access Control & Presence module (doc 30). Alert rosters reference this data but do not manage it directly.

### Special Rosters

- **All Users**: Built-in roster that includes every active I/O user. Used for plant-wide alerts.
- **Admins**: Built-in roster of all users with `admin` role.

---

## Frontend: Alert UI

### Full-Screen Emergency Takeover

For EMERGENCY severity alerts, every open I/O window displays a full-screen overlay:

**Visual design**:
- Semi-transparent dark overlay (`position: fixed; z-index: 999999; inset: 0`)
- Flashing red border (CSS animation, 1-second cycle)
- Large centered alert card with:
  - Severity badge (red, pulsing)
  - Alert title (large, bold)
  - Alert message (readable body text)
  - Timestamp
  - Active delivery channels (icons showing SMS sent, radio sent, etc.)
  - "Acknowledge" button (large, prominent, requires `alerts:acknowledge` permission)
  - Acknowledging user's name displayed once acknowledged
- Looping alarm audio via Web Audio API (cannot be silenced without acknowledging)
- Fullscreen API engaged on supported browsers

**Cross-window behavior**: The SharedWorker receives the WebSocket alert and pushes it to ALL open windows (main + detached Console, Process, Dashboard). Each window renders the overlay independently. Acknowledgment from any window broadcasts `alert_acknowledged` to all windows, which then transition the overlay to an "Acknowledged" state (green border, no alarm, auto-dismiss after 10 seconds).

### Alert Banner (CRITICAL/WARNING)

For CRITICAL and WARNING severity:
- Persistent banner at the top of the viewport (below the navigation bar)
- Color-coded by severity (red for CRITICAL, amber for WARNING)
- Shows alert title, time, and Acknowledge button
- Optional audio chime (configurable, off by default for WARNING)
- Stacks if multiple active alerts (newest on top, scrollable)
- Dismissable for WARNING; persistent until acknowledged for CRITICAL

### Alert Notification Bell

In the top navigation bar (doc 06 - Frontend Shell):
- Bell icon with badge showing count of unacknowledged alerts
- Clicking opens alert panel (dropdown or slide-out)
- Alert panel shows recent alerts sorted by severity then time
- Each alert shows: severity icon, title, time, status (active/acknowledged/resolved)
- Acknowledge button per alert
- "View All" link to full alert history

### Alert History View

Accessible from Settings or via direct navigation:
- Paginated table of all alerts
- Columns: severity, title, triggered at, triggered by, status, acknowledged by, acknowledged at, channels used
- Expandable rows: delivery details per channel, escalation history
- Filters: severity, status, date range, channel, source

---

## Database Schema

### Tables

```sql
-- Alert severity enum
CREATE TYPE alert_severity AS ENUM ('emergency', 'critical', 'warning', 'info');

-- Alert status enum
CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved', 'cancelled');

-- Alert templates
CREATE TABLE alert_templates (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(200) NOT NULL UNIQUE,
    severity                alert_severity NOT NULL,
    title_template          TEXT NOT NULL,
    message_template        TEXT NOT NULL,
    channels                TEXT[] NOT NULL,
    default_roster_id       UUID REFERENCES alert_rosters(id),
    escalation_policy       JSONB,
    requires_acknowledgment BOOLEAN NOT NULL DEFAULT false,
    auto_resolve_minutes    INT,
    category                VARCHAR(50) NOT NULL DEFAULT 'custom',
    variables               TEXT[],
    enabled                 BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by              UUID REFERENCES users(id),
    updated_by              UUID REFERENCES users(id)
);

-- Recipient rosters
CREATE TABLE alert_rosters (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    source      VARCHAR(20) NOT NULL DEFAULT 'manual',  -- 'manual', 'role_group', 'all_users', 'on_shift', 'on_site'
    source_config JSONB,       -- for role_group: {"role_id": "uuid"}
    members     JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES users(id),
    updated_by  UUID REFERENCES users(id)
);

-- Alert instances
CREATE TABLE alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id         UUID REFERENCES alert_templates(id),
    severity            alert_severity NOT NULL,
    status              alert_status NOT NULL DEFAULT 'active',
    title               VARCHAR(500) NOT NULL,
    message             TEXT NOT NULL,
    source              VARCHAR(100) NOT NULL,     -- 'manual', 'event_service', 'opc_service', 'rounds', 'scheduled'
    source_reference_id UUID,                      -- FK to originating record (event ID, round ID, etc.)
    roster_id           UUID REFERENCES alert_rosters(id),
    escalation_policy   JSONB,                     -- snapshot of policy at trigger time
    current_escalation  SMALLINT NOT NULL DEFAULT 0,
    channels_used       TEXT[] NOT NULL,
    triggered_by        UUID REFERENCES users(id), -- NULL for system-generated alerts
    triggered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_by     UUID REFERENCES users(id),
    acknowledged_at     TIMESTAMPTZ,
    resolved_by         UUID REFERENCES users(id),
    resolved_at         TIMESTAMPTZ,
    cancelled_by        UUID REFERENCES users(id),
    cancelled_at        TIMESTAMPTZ,
    metadata            JSONB                      -- template variables, context data
);

CREATE INDEX idx_alerts_status ON alerts (status) WHERE status = 'active';
CREATE INDEX idx_alerts_severity_time ON alerts (severity, triggered_at DESC);
CREATE INDEX idx_alerts_source ON alerts (source, source_reference_id);

-- Per-recipient, per-channel delivery tracking
CREATE TABLE alert_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id        UUID NOT NULL REFERENCES alerts(id),
    channel_type    VARCHAR(30) NOT NULL,
    recipient_user_id UUID REFERENCES users(id),
    recipient_name  VARCHAR(200),
    recipient_contact VARCHAR(300),     -- phone number, email, radio ID, etc.
    status          VARCHAR(30) NOT NULL DEFAULT 'pending',
                    -- pending, sending, sent, delivered, failed, acknowledged
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    failure_reason  TEXT,
    external_id     VARCHAR(200),       -- Twilio SID, provider message ID
    escalation_level SMALLINT NOT NULL DEFAULT 0,
    metadata        JSONB
);

CREATE INDEX idx_alert_deliveries_alert ON alert_deliveries (alert_id);
CREATE INDEX idx_alert_deliveries_status ON alert_deliveries (alert_id, status)
    WHERE status IN ('pending', 'sending');

-- Escalation history
CREATE TABLE alert_escalations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id        UUID NOT NULL REFERENCES alerts(id),
    from_level      SMALLINT NOT NULL,
    to_level        SMALLINT NOT NULL,
    reason          VARCHAR(100) NOT NULL,  -- 'no_acknowledgment', 'always', 'manual'
    escalated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_escalations_alert ON alert_escalations (alert_id);

-- Channel adapter configuration
CREATE TABLE alert_channels (
    channel_type    VARCHAR(30) PRIMARY KEY,    -- 'websocket', 'email', 'sms', 'voice', 'radio', 'pa', 'browser_push'
    display_name    VARCHAR(100) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT false,
    config          JSONB NOT NULL DEFAULT '{}', -- channel-specific config (secrets encrypted at app layer)
    last_tested_at  TIMESTAMPTZ,
    last_test_ok    BOOLEAN,
    last_test_error TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID REFERENCES users(id)
);

-- Seed channel rows
INSERT INTO alert_channels (channel_type, display_name, enabled) VALUES
    ('websocket', 'WebSocket (Browser)', true),
    ('email', 'Email', false),
    ('sms', 'SMS (Twilio)', false),
    ('voice', 'Voice Call (Twilio)', false),
    ('radio', 'Two-Way Radio', false),
    ('pa', 'PA System', false),
    ('browser_push', 'Browser Push Notification', false);

-- Web push subscriptions (for browser push adapter)
CREATE TABLE push_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    endpoint        TEXT NOT NULL UNIQUE,
    p256dh_key      TEXT NOT NULL,
    auth_key        TEXT NOT NULL,
    user_agent      VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at    TIMESTAMPTZ
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);
```

---

## API Endpoints

All endpoints prefixed with `/api/alerts` and routed through the API Gateway.

### Alert Operations

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/alerts` | `alerts:read` | List alerts (paginated, filterable by status, severity, date range, source) |
| `GET` | `/api/alerts/active` | `alerts:read` | List active (unacknowledged) alerts |
| `GET` | `/api/alerts/:id` | `alerts:read` | Get alert details including deliveries and escalation history |
| `POST` | `/api/alerts` | `alerts:create` | Trigger a manual alert |
| `POST` | `/api/alerts/:id/acknowledge` | `alerts:acknowledge` | Acknowledge an alert |
| `POST` | `/api/alerts/:id/resolve` | `alerts:create` | Resolve an alert (mark as resolved, cancel escalation) |
| `POST` | `/api/alerts/:id/cancel` | `alerts:create` | Cancel an alert (false alarm, cancel all pending deliveries) |

### Alert Templates

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/alerts/templates` | `alerts:manage_templates` | List all templates |
| `GET` | `/api/alerts/templates/:id` | `alerts:manage_templates` | Get template details |
| `POST` | `/api/alerts/templates` | `alerts:manage_templates` | Create template |
| `PUT` | `/api/alerts/templates/:id` | `alerts:manage_templates` | Update template |
| `DELETE` | `/api/alerts/templates/:id` | `alerts:manage_templates` | Delete template (built-in templates cannot be deleted) |

### Recipient Rosters

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/alerts/rosters` | `alerts:manage_rosters` | List all rosters |
| `GET` | `/api/alerts/rosters/:id` | `alerts:manage_rosters` | Get roster with member list |
| `POST` | `/api/alerts/rosters` | `alerts:manage_rosters` | Create roster |
| `PUT` | `/api/alerts/rosters/:id` | `alerts:manage_rosters` | Update roster |
| `DELETE` | `/api/alerts/rosters/:id` | `alerts:manage_rosters` | Delete roster |

### Channel Configuration

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/alerts/channels` | `alerts:configure` | List all channels with enabled status and config |
| `PUT` | `/api/alerts/channels/:type` | `alerts:configure` | Update channel configuration |
| `PUT` | `/api/alerts/channels/:type/enabled` | `alerts:configure` | Enable/disable a channel |
| `POST` | `/api/alerts/channels/:type/test` | `alerts:configure` | Test a channel (send test alert through it) |

### Alert History and Delivery Details

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/alerts/:id/deliveries` | `alerts:read` | Get per-recipient delivery details |
| `GET` | `/api/alerts/:id/escalations` | `alerts:read` | Get escalation history |
| `GET` | `/api/alerts/stats` | `alerts:read` | Alert statistics (counts by severity, avg response time, channel reliability) |

### Webhook Callbacks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/alerts/webhooks/twilio/status` | Twilio signature validation | Twilio delivery status callback |
| `POST` | `/api/alerts/webhooks/twilio/voice` | Twilio signature validation | Twilio voice call status / keypress callback |

### Trigger Alert Request Schema

```json
{
  "template_id": "uuid (optional — if omitted, severity/title/message required)",
  "template_variables": { "unit": "Unit 4", "gas_type": "H2S", "instrument": "TI-401" },
  "severity": "emergency (required if no template_id)",
  "title": "Gas Leak Detected (required if no template_id)",
  "message": "H2S detected at TI-401 (required if no template_id)",
  "roster_id": "uuid (optional — overrides template default)",
  "channels": ["websocket", "sms", "email"] ,
  "source": "manual",
  "source_reference_id": "uuid (optional)"
}
```

---

## RBAC Permissions

| Permission | Description | Default Roles |
|------------|-------------|---------------|
| `alerts:read` | View active and historical alerts | All roles |
| `alerts:acknowledge` | Acknowledge alerts | Operator, Analyst, Supervisor, Admin |
| `alerts:create` | Create manual alerts, resolve, cancel | Supervisor, Admin |
| `alerts:manage_templates` | Create, edit, delete alert templates | Admin |
| `alerts:manage_rosters` | Create, edit, delete recipient rosters | Admin |
| `alerts:configure` | Configure channels, escalation rules | Admin |

*Role-permission assignments are managed centrally in doc 03. Defaults shown for reference.*

Total: **6 new permissions**.

---

## Regulatory Compliance

### OSHA PSM (29 CFR 1910.119)

PSM requires:
- An alarm system to alert employees → **Alert Service with multi-channel delivery**
- Backup communication network → **Multiple independent channels (WebSocket + SMS + radio)**
- Communication equipment in emergency control center → **Console full-screen takeover + PA integration**

### EPA RMP (40 CFR Part 68, 2024 update)

RMP requires:
- Procedures for informing the public about accidental releases → **Configurable community notification roster (external contacts with phone/email)**
- System to notify local responders → **Alert templates with responder rosters, configurable channels**
- Audit trail of notifications → **`alerts`, `alert_deliveries`, `alert_escalations` tables**

### Documentation

The Alert System's database schema provides a complete audit trail satisfying regulatory documentation requirements:
- **What** was the alert (severity, title, message, source)
- **When** it was triggered, acknowledged, resolved
- **Who** triggered it, acknowledged it, resolved it
- **How** it was delivered (which channels, per-recipient status)
- **Whether** escalation occurred and why

---

## Technology Stack

### New Crates

| Crate | License | Purpose |
|-------|---------|---------|
| `web-push-native` | MIT/Apache-2.0 | Browser push notifications (VAPID) |
| `reqwest` | MIT/Apache-2.0 | HTTP client for Twilio, radio dispatch, PA REST APIs (already in stack) |

### Optional Crates

| Crate | License | Purpose |
|-------|---------|---------|
| `piper-rs` or FFI to Piper | MIT | Text-to-speech for PA announcements (only if SIP PA mode is used) |
| `pocket-tts` | MIT/Apache-2.0 | Alternative pure-Rust TTS |
| `sipua` / custom SIP | Various (verify) | SIP client for SIP-based PA (only if SIP PA mode is used) |

### Existing Crates (already in I/O stack)

| Crate | Purpose |
|-------|---------|
| `serde` / `serde_json` | Alert serialization |
| `sqlx` | PostgreSQL queries |
| `tokio` | Async runtime, escalation timers, cancellation tokens |
| `tracing` | Structured logging |
| `minijinja` | Template rendering (shared with Email Service) |

---

## Deployment

### Service Configuration

```env
# Alert Service
ALERT_SERVICE_PORT=3007
ALERT_WEBSOCKET_BROKER_URL=ws://localhost:3001
ALERT_EMAIL_SERVICE_URL=http://localhost:3008
ALERT_ESCALATION_CHECK_INTERVAL_MS=5000
# Master key delivered via systemd LoadCredentialEncrypted (see doc 03)
```

### Health Check

`GET /api/alerts/health` returns:
```json
{
  "status": "healthy",
  "active_alerts": 0,
  "pending_escalations": 0,
  "channels": [
    { "type": "websocket", "enabled": true, "last_test_ok": true },
    { "type": "email", "enabled": true, "last_test_ok": true },
    { "type": "sms", "enabled": true, "last_test_ok": true },
    { "type": "radio", "enabled": false },
    { "type": "pa", "enabled": false },
    { "type": "browser_push", "enabled": true, "last_test_ok": true }
  ]
}
```

### systemd Service

```ini
[Unit]
Description=Inside/Operations Alert Service
After=postgresql.service io-api-gateway.service io-websocket-broker.service io-email-service.service
Wants=postgresql.service io-websocket-broker.service

[Service]
Type=simple
ExecStart=/opt/io/bin/alert-service
EnvironmentFile=/opt/io/.env
Restart=always
RestartSec=3s

[Install]
WantedBy=multi-user.target
```

Note: `Restart=always` (not `on-failure`) — the Alert Service should always be running. `RestartSec=3s` for fast recovery.

### Twilio Account Setup

For sites using SMS/Voice alerting:

1. Create a Twilio account at twilio.com
2. Purchase a toll-free number ($2/month)
3. Request high-throughput upgrade (25 MPS) from Twilio support
4. Complete toll-free verification (3-4 weeks, describe emergency notification use case)
5. Note Account SID, Auth Token, and From Number
6. Configure in I/O Settings > Alerts > Channels > SMS
7. Send test alert to verify delivery

**Estimated cost**: ~$2/month base + ~$4 per 500-recipient emergency blast. Under $20/month with registration fees.

---

## Settings UI

### Alert Configuration

Located in **Settings > Alerts**.

**Channels tab**:
- List of all channel adapters with enabled/disabled toggle
- Click a channel to expand configuration form
- "Test" button sends a test alert through that channel to the current user
- Green/red indicator for last test result

**Templates tab**:
- Table of alert templates: name, severity, channels, escalation levels, enabled toggle
- Click to edit: template name, severity, title/message templates (with variable reference), channel selection, escalation policy builder, roster selection
- "Preview" button shows rendered alert with sample variables
- "New Template" and "Duplicate" actions

**Rosters tab**:
- Table of recipient rosters: name, member count, source type, last updated
- Click to edit: roster name, description, source (manual/role group), member list
- Member editor: add/remove members, edit per-channel contact info
- "Import from Users" action to bulk-add I/O users to a roster

**History tab**:
- Full alert history view (same as described in Frontend section above)

---

## Mustering

During emergency alerts, a **Mustering** view provides real-time accountability for personnel on site. This feature requires access control integration (doc 30).

### Mustering View

Available from the emergency alert overlay and from Settings > Alerts > Mustering. Shows:

- **Total badged in**: Count of personnel who badged in and have not badged out
- **Accounted**: Personnel who have been manually marked as accounted or who badged out after the alert
- **Unaccounted**: Personnel who badged in and haven't badged out or been marked accounted

### Unaccounted Personnel List

| Column | Description |
|--------|-------------|
| Name | From badge/access control system |
| Badge-in time | When they entered the site |
| Last known area | Most recent badge reader area (if multiple readers) |
| Status | Unaccounted / Accounted |

### Actions

- **Mark as accounted**: Manual reconciliation for personnel found at muster points. Logged with who marked them and when.
- No other actions — mustering is a read-only accountability view, not an access control system.

### Requirements

- Requires access control integration (doc 30)
- If no access control integration is configured, the Mustering tab is hidden
- Badge data is read-only — I/O does not manage badges or access control hardware

---

## Relationship to Doc 31 (Alerts Module) and Doc 30 (Access Control)

### Doc 27 vs Doc 31

This document (doc 27) defines the **Alert Service backend engine** — the standalone Rust service that accepts alert triggers, resolves recipients, fans out to channel adapters, tracks delivery, and manages escalation. It is infrastructure.

Doc 31 defines the **Alerts Module frontend** — the human-facing UI where safety personnel compose and send alerts, manage notification templates and groups, view delivery status, and monitor muster accountability during emergencies. The Alerts Module is a **client** of the Alert Service. It dispatches through `POST /api/alerts`; the Alert Service handles everything after that.

**Division of responsibility:**
- **Templates**: Doc 27's `alert_templates` are system/process alert rule definitions (gas leak triggers, equipment failure rules). Doc 31's `notification_templates` are human-authored message templates for manual alerts.
- **Rosters vs Groups**: Doc 27's `alert_rosters` are the delivery-level recipient resolution. Doc 31's `notification_groups` are user-managed personnel lists that get resolved into rosters at send time.
- **Delivery**: This service owns it entirely. Doc 31 displays delivery status but never sends directly.

### Doc 30 Integration

The Access Control & Presence module (doc 30) provides:
- **Shift-aware routing**: Alert rosters with `source: 'on_shift'` resolve dynamically from `GET /api/shifts/current/personnel` at alert trigger time.
- **On-site routing**: Alert rosters with `source: 'on_site'` resolve from `GET /api/presence/on-site`.
- **Muster data**: During EMERGENCY alerts, muster accounting (accounted/unaccounted personnel) flows from doc 30's badge integration. Both this service's mustering view and doc 31's muster status dashboard consume the same data.

---

## SMS Delivery

SMS messages are delivered via the `io-sms` utility crate, which encapsulates Twilio API calls and is compiled into any service that needs SMS capability (Alert Service, Auth Service). `io-sms` is a workspace member but not one of the 11 shared crates — it's only needed by 2 services. See the SMS adapter configuration in the Channel Adapters section above for Twilio-specific settings.

---

## Change Log

- **v0.5** — Updated RBAC permission table: replaced "Power User"/"User" role names with canonical 8-role names (All roles, Operator, Analyst, Supervisor, Admin). Added doc 03 cross-reference note.
- **v0.4** — Replaced stale `ALERT_MASTER_KEY_ENV=IO_MASTER_KEY` env var with systemd `LoadCredentialEncrypted` reference per doc 03 v2.1. Fixed WebSocket broker URL port from 3002 to 3001 per doc 37 canonical assignments.
- **v0.3** — Added "Relationship to Doc 31 and Doc 30" section clarifying the division between this service (backend engine) and the Alerts Module frontend (doc 31). Doc 27 is infrastructure; doc 31 is the human-facing UI that dispatches through this service. Clarified doc 30 integration for shift-aware routing, on-site routing, and muster data.
- **v0.2** — Added shift-aware roster sources (on-shift, on-site) referencing Access Control & Presence module (doc 30). Added Mustering section for emergency personnel accountability. Added `io-sms` shared crate note for SMS delivery. Updated `alert_rosters.source` column to include new roster types.
- **v0.1** — Initial document. Alert Service with 7 channel adapters (WebSocket, Email, SMS, Voice, Radio, PA, Browser Push), escalation engine, recipient rosters, full-screen emergency takeover, 13 built-in templates, 6 RBAC permissions, full database schema, API specification, regulatory compliance mapping, deployment guide.
