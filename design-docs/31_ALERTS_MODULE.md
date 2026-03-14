# 31. Alerts Module

## Overview

The Alerts module is a **human-initiated communication tool**. It is one of 11 frontend modules in Inside/Operations.

### Critical Distinction: Alerts vs. Process Alarms

These two systems are completely separate. Different audiences, different triggers, different workflows.

| | Alerts Module (this document) | Process Alarms (Console/Process/Dashboards) |
|---|---|---|
| **Trigger** | A person hits "Send" | OPC data crosses a threshold |
| **Source** | Safety personnel, supervisors, management, I/O system health | Event Service, OPC Service, automated rules |
| **Audience** | Groups of people (shift, all-hands, custom groups) | Operators monitoring specific equipment |
| **Action** | Read the message, follow instructions, muster | Acknowledge on the DCS board (not in I/O) |
| **Examples** | "Gas leak Unit 4 -- shelter in place", "Planned outage tomorrow 0600", "Server maintenance in 30 minutes" | High temperature alarm on TI-401, compressor trip, loss of communication |
| **Where in I/O** | Alerts module (this doc) | Console (07), Process (08), Dashboards (10), Reports (11), event tables |

I/O is a **monitoring** application. Operators acknowledge process alarms on the actual DCS board -- I/O shows when alarms are active, acknowledged, or shelved, but alarm acknowledgment is not an I/O function. The Alerts module has nothing to do with process alarms.

### What Appears in the Alerts Module

1. **Human-initiated alerts** -- Messages sent by safety personnel, supervisors, or management through I/O's alert sending interface
2. **I/O system health notices** -- Automated messages from I/O backend services (server maintenance, backup starting, service restarts, license warnings)
3. **Nothing else** -- Process alarms, OPC data alarms, equipment faults, threshold breaches -- none of these appear here. If management wants to see process alarms, they build a Dashboard (doc 10), a Report (doc 11), or add an event table to their Console workspace (doc 07)

---

## Module UI

The Alerts module is accessible from the left sidebar navigation. Permission-gated: requires `alerts:read` to see the module at all.

### Main View: Active & Recent Alerts

The default landing view when entering the Alerts module.

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Alerts                                          [Send Alert] │
├─────────────────────────────────────────────────────────────┤
│  Active Alerts (2)                                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ ● EMERGENCY  Gas Leak -- Unit 4 Shelter in Place        │ │
│  │   Sent by: J. Martinez (Safety)  14:30:05  To: All-Hands│ │
│  │   Channels: SMS, Email, WebSocket, Radio, PA            │ │
│  │   [View Details]  [Mark Resolved]                       │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │ ● INFO  Backup starting in 10 minutes                   │ │
│  │   System generated  14:25:00                            │ │
│  │   Channels: WebSocket                                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  Recent (24h)                                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ ✓ WARNING  Confined space entry -- Unit 7 turnaround    │ │
│  │   Sent by: R. Chen (Supervisor)  08:15:00  Resolved     │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │ ✓ INFO  Shift change briefing at 06:00                  │ │
│  │   Sent by: K. Patel (Shift Lead)  05:45:00  Delivered   │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Active alerts** are sorted by severity (EMERGENCY first), then by time (newest first). Active means sent but not yet resolved or cancelled.

**Recent alerts** show the last 24 hours of resolved/delivered alerts. Click any alert to expand delivery details (per-recipient status, channel results, escalation history).

### Send Alert View

Accessed via the `[Send Alert]` button. Two modes: template-based and ad-hoc.

**Template mode** (default):
```
┌─────────────────────────────────────────────────────────────┐
│  Send Alert                                                  │
├─────────────────────────────────────────────────────────────┤
│  Template:  [Gas Leak Emergency          ▼]                  │
│                                                              │
│  Severity:  ● EMERGENCY  (from template, editable)           │
│                                                              │
│  Title:     Gas Leak Detected -- {{unit}}                    │
│  Unit:      [Unit 4        ]                                 │
│                                                              │
│  Message:   {{gas_type}} detected at {{instrument}}.         │
│             {{action_required}}. Await all-clear.            │
│  Gas Type:      [H2S             ]                           │
│  Instrument:    [TI-401          ]                           │
│  Action:        [Shelter in place ]                          │
│                                                              │
│  ── Preview ──────────────────────────────────────────────── │
│  Gas Leak Detected -- Unit 4                                 │
│  H2S detected at TI-401. Shelter in place. Await all-clear. │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  Send To:   [All-Hands               ▼]  (from template)    │
│  Channels:  ☑ SMS  ☑ Email  ☑ WebSocket  ☑ Radio  ☑ PA     │
│                                                              │
│  [Cancel]                              [Send Alert]          │
│                                        (red, prominent)     │
└─────────────────────────────────────────────────────────────┘
```

**Ad-hoc mode**: No template selected. User manually fills in severity, title, message, recipients, and channels. Used for non-templated situations.

**Confirmation dialog**: Before sending, a confirmation modal appears showing the rendered message, recipient count, and channels. EMERGENCY alerts show an additional warning: "This will trigger full-screen takeover on all active I/O sessions and send to X recipients via Y channels."

**Emergency mode shortcut**: For EMERGENCY templates, an additional quick-send option is available from the main view. A dedicated "Emergency" section at the top of the template picker shows only emergency templates with large one-click send buttons. Template variables that have defaults (e.g., "Shelter in place" as default action) are pre-filled. The goal: during a crisis, two clicks max -- pick the template, hit send. Variable overrides are optional.

### Alert History View

Full searchable/filterable history of all sent alerts and system notices.

**Columns**:

| Column | Description |
|--------|-------------|
| Severity | Color-coded severity badge |
| Title | Alert title text |
| Sent At | Timestamp |
| Sent By | User who sent (or "System" for automated) |
| Recipients | Target group name and count |
| Channels | Icons for channels used |
| Status | Active / Delivered / Resolved / Cancelled |
| Acknowledged | Who acknowledged and when (if applicable) |

**Filters**: Severity, status, date range, sender, recipient group, channel type. Free-text search across title and message body.

**Expandable rows**: Click to expand and see:
- Full message body
- Per-recipient delivery status (sent, delivered, failed, with timestamps)
- Escalation history (if escalation occurred)
- Resolution/cancellation details

### Group Management View

CRUD interface for custom alert groups. Accessible from a "Groups" tab within the Alerts module.

**Group list**: Table showing group name, description, member count, last updated. Click to edit.

**Group editor**:
- Group name (required, unique)
- Description (optional)
- Member list with add/remove
  - Add from I/O users (searchable user picker)
  - Each member shows: name, email, phone (from user profile)
- Bulk actions: add all users with a specific role, import from CSV

Groups defined here are separate from alert rosters in doc 27. Alert groups in this module are simple named lists of people. When sending an alert, the selected group is resolved into a roster and passed to the Alert Service (doc 27) for dispatch.

### Template Management View

CRUD interface for notification templates. Accessible from a "Templates" tab within the Alerts module.

**Template list**: Table showing template name, severity, channels, is_emergency flag, enabled toggle. Click to edit.

**Template editor**:
- Template name (required, unique)
- Severity (dropdown: emergency, critical, warning, info)
- Is Emergency (checkbox -- marks template for emergency quick-send section)
- Title template (supports `{{variable}}` placeholders)
- Message body template (supports `{{variable}}` placeholders)
- Variables definition (name, label, default value, required flag)
- Default recipient group (dropdown of alert groups)
- Default channels (checkboxes)
- Escalation policy (optional, see doc 27 for escalation mechanics)
- Preview panel showing rendered template with sample values

**Built-in templates**: The system ships with the same built-in templates defined in doc 27 (gas leak, fire alarm, shelter in place, evacuation, all clear, etc.). Built-in templates can be edited but not deleted.

### Muster Status Dashboard

Visible during active EMERGENCY alerts. Requires access control integration (doc 30, when built).

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Muster Status -- Gas Leak Unit 4          14:30:05         │
├──────────────┬──────────────┬───────────────────────────────┤
│  On Site     │  Accounted   │  Unaccounted                  │
│    247       │    189       │    58                          │
├──────────────┴──────────────┴───────────────────────────────┤
│                                                              │
│  Unaccounted Personnel                                       │
│  ┌──────────────┬───────────┬───────────────┬──────────┐    │
│  │ Name         │ Badge In  │ Last Area     │ Action   │    │
│  ├──────────────┼───────────┼───────────────┼──────────┤    │
│  │ A. Williams  │ 06:02     │ Unit 4        │ [Mark ✓] │    │
│  │ B. Torres    │ 05:58     │ Warehouse     │ [Mark ✓] │    │
│  │ C. Park      │ 07:15     │ Control Room  │ [Mark ✓] │    │
│  │ ...          │           │               │          │    │
│  └──────────────┴───────────┴───────────────┴──────────┘    │
│                                                              │
│  [Export Unaccounted List]                                    │
└─────────────────────────────────────────────────────────────┘
```

**Data source**: Badge-in/badge-out data from the Access Control & Presence module (doc 30). The Alerts module reads this data but does not manage it.

**"Mark as accounted"**: Manual reconciliation for personnel found at muster points. Logged with who marked them and when. Requires `alerts:muster` permission.

**Auto-refresh**: Muster status updates in real-time via WebSocket as badge events occur and as personnel are marked accounted.

**Availability**: If no access control integration is configured, the Muster Status dashboard is hidden entirely. No placeholder, no grayed-out state -- just absent.

---

## Notification Templates

Notification templates are the pre-built message formats used for human-initiated alerts. These are distinct from the `alert_templates` table in doc 27, which stores system/process alert rule definitions.

### Template Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | VARCHAR(200) | Template name (unique) |
| `severity` | ENUM | emergency, critical, warning, info |
| `is_emergency` | BOOLEAN | Show in emergency quick-send section |
| `title_template` | TEXT | Title with `{{variable}}` placeholders |
| `message_template` | TEXT | Body with `{{variable}}` placeholders |
| `variables` | JSONB | Array of variable definitions: `{name, label, default_value, required}` |
| `default_group_id` | UUID | Default alert group to send to |
| `default_channels` | TEXT[] | Default notification channels |
| `escalation_policy` | JSONB | Optional escalation config (same format as doc 27) |
| `requires_acknowledgment` | BOOLEAN | Whether recipients must acknowledge |
| `enabled` | BOOLEAN | Active/inactive toggle |
| `is_builtin` | BOOLEAN | System-provided template (cannot be deleted) |

### Built-In Templates

These ship with the system and cannot be deleted. They can be edited to match site-specific procedures.

| Template | Severity | Emergency | Default Channels |
|----------|----------|-----------|------------------|
| Gas Leak | EMERGENCY | Yes | All |
| Fire Alarm | EMERGENCY | Yes | All |
| Shelter in Place | EMERGENCY | Yes | All |
| Evacuation | EMERGENCY | Yes | All |
| All Clear | INFO | No | WebSocket, Email, Radio |
| Unit Trip | CRITICAL | No | WebSocket, Email, SMS |
| Shift Announcement | INFO | No | WebSocket, Email |
| Safety Bulletin | WARNING | No | WebSocket, Email |
| Planned Outage | INFO | No | WebSocket, Email |
| Custom | Configurable | No | Configurable |

---

## Custom Alert Groups

Alert groups are named lists of personnel for targeting notifications. They are managed within the Alerts module and are independent of doc 27's `alert_rosters` table (though groups are resolved into rosters at send time).

### Group Types

| Type | Resolution | Description |
|------|------------|-------------|
| **Static** | Fixed member list | Manually curated list of users. "All shift leads", "Management team", "Safety officers" |
| **Role-based** | Dynamic from role | Automatically includes all I/O users with a specified role. Membership changes as users are added to or removed from the role. |
| **On-shift** | Dynamic from schedule | Targets personnel currently on shift. Resolved at send time from shift data in Access Control & Presence (doc 30). Hidden if no shift data configured. |
| **On-site** | Dynamic from badges | Targets personnel currently badged in on site. Resolved at send time from badge data in Access Control & Presence (doc 30). Hidden if no access control configured. |
| **All Users** | Built-in | Every active I/O user. Cannot be edited or deleted. |

### Group Resolution at Send Time

When a user sends an alert targeting a group, the Alerts module resolves the group into a concrete recipient list:

1. **Static groups**: Member list used as-is
2. **Role-based groups**: Query all active users with the specified role
3. **On-shift groups**: Query Access Control & Presence (doc 30) for current shift personnel
4. **On-site groups**: Query Access Control & Presence (doc 30) for currently badged-in personnel
5. **All Users**: Query all active users

The resolved recipient list (with per-user contact details: email, phone number from user profiles) is passed to the Alert Service (doc 27) as a roster for dispatch.

---

## Alert Sending Workflow

### Step-by-Step Flow

```
1. USER ACTION
   ├── Select template (or create ad-hoc)
   ├── Fill in variables / compose message
   ├── Select recipient group
   ├── Select channels (or accept template defaults)
   └── Click "Send Alert"
         │
2. CONFIRMATION
   ├── Modal shows: rendered message, recipient count, channels
   ├── EMERGENCY alerts: extra warning about full-screen takeover
   └── User confirms or cancels
         │
3. GROUP RESOLUTION
   ├── Resolve group → concrete recipient list (see above)
   ├── For each recipient: look up contact info per channel
   │   (email address, phone number, etc. from user profile)
   └── Build recipient roster
         │
4. DISPATCH TO ALERT SERVICE
   ├── POST /api/alerts with:
   │   ├── severity, title, message (rendered from template)
   │   ├── channels list
   │   ├── resolved roster
   │   ├── escalation policy (if configured)
   │   ├── source: "manual"
   │   └── triggered_by: current user ID
   └── Alert Service (doc 27) takes over from here
         │
5. ALERT SERVICE PROCESSING (doc 27)
   ├── Fan-out to channel adapters
   ├── Per-recipient, per-channel delivery tracking
   ├── Escalation timers (if configured)
   ├── WebSocket broadcast to all I/O sessions
   └── Full-screen takeover for EMERGENCY severity
         │
6. STATUS TRACKING
   ├── Alerts module polls/subscribes for delivery status updates
   ├── Main view updates: active alert shows delivery progress
   ├── Alert History records full audit trail
   └── Muster dashboard activates for EMERGENCY (if access control configured)
```

### Delivery Status Updates

The Alerts module receives real-time delivery status updates via WebSocket subscription. As the Alert Service (doc 27) processes deliveries and receives provider callbacks (Twilio delivery receipts, etc.), status updates flow back to the Alerts module UI:

- **Pending**: Queued for delivery
- **Sending**: In progress with channel adapter
- **Sent**: Accepted by provider (SMS sent, email queued)
- **Delivered**: Confirmed by provider (SMS delivered, email opened)
- **Failed**: Delivery failed (with reason)
- **Acknowledged**: Recipient acknowledged the alert

---

## I/O System Alerts

Backend services generate system health notices that appear in the Alerts module. These are not human-initiated -- they are automated messages from I/O infrastructure.

### System Alert Sources

| Source Service | Event | Severity | Description |
|----------------|-------|----------|-------------|
| Any service | Service starting | INFO | "Alert Service starting up" |
| Any service | Service shutting down | WARNING | "API Gateway shutting down for maintenance" |
| Archive Service | Backup starting | INFO | "Database backup starting, expect brief slowdown" |
| Archive Service | Backup failed | CRITICAL | "Database backup failed: [reason]" |
| OPC Service | Connection lost | WARNING | "OPC connection to [server] lost" |
| OPC Service | Connection restored | INFO | "OPC connection to [server] restored" |
| Auth Service | Too many failed logins | WARNING | "10+ failed login attempts for user [username]" |
| Data Broker | Database connection pool exhausted | CRITICAL | "Connection pool at capacity" |
| Any service | Disk space low | WARNING | "Server disk usage at 90%" |
| io-health | Service unresponsive | CRITICAL | "[Service] health check failed" |

### How System Alerts Are Generated

Backend services publish system alerts via `PostgreSQL NOTIFY` on the `system_alert` channel, or by calling `POST /api/alerts` with `source: "system"` and `triggered_by: NULL` (no user). The Alert Service (doc 27) processes them like any other alert, but with these differences:

- System alerts use the WebSocket channel only by default (no SMS/email/radio for routine system notices)
- CRITICAL system alerts may also use email, configured per deployment
- System alerts do not trigger full-screen takeover (reserved for EMERGENCY human-initiated alerts)
- System alerts appear in the Alerts module history with sender shown as "System"

---

## Notification Channels

The Alerts module does not implement its own delivery infrastructure. It dispatches through the Alert Service (doc 27), which owns all channel adapters. The module's role is to provide the UI for selecting channels and viewing delivery results.

### Available Channels

| Channel | Infrastructure | Reference |
|---------|---------------|-----------|
| **In-app (WebSocket)** | WebSocket Broker (doc 16) via Alert Service (doc 27) | Always active, no configuration needed |
| **Email** | Email Service (doc 28) via Alert Service (doc 27) | Requires email provider configuration |
| **SMS** | Twilio via `io-sms` crate, routed through Alert Service (doc 27) | Requires Twilio account configuration |
| **Voice** | Twilio voice via Alert Service (doc 27) | Escalation only, requires Twilio configuration |
| **Radio** | Dispatch software API via Alert Service (doc 27) | Requires radio dispatch integration |
| **PA** | SIP/REST/Relay via Alert Service (doc 27) | Requires PA system integration |
| **Browser Push** | Web Push API via Alert Service (doc 27) | Requires user opt-in |

### Channel Availability in UI

The Send Alert view only shows channels that are enabled in the Alert Service configuration (Settings > Alerts > Channels, doc 27). Disabled channels are not shown -- no grayed-out options, no "configure this channel" prompts. If SMS is not configured, the SMS checkbox does not appear.

---

## Database Schema

### Naming Convention

Doc 27 (Alert System) defines tables for the alert processing engine: `alert_templates`, `alert_rosters`, `alerts`, `alert_deliveries`, `alert_escalations`, `alert_channels`, `push_subscriptions`.

This module needs tables for human-initiated notification concepts that are distinct from doc 27's system alert processing. To avoid collision and confusion, this module's tables use the `notification_` prefix:

- `notification_templates` -- Human-initiated alert templates (distinct from `alert_templates` which are system alert rule definitions)
- `notification_groups` -- Custom personnel groups for targeting notifications
- `notification_group_members` -- Group membership
- `notification_messages` -- Record of every human-initiated or system notification sent
- `notification_muster_marks` -- Manual muster accountability entries

The `alerts`, `alert_deliveries`, and `alert_escalations` tables from doc 27 continue to store the actual dispatch/delivery records. When a notification is sent from this module, a row is created in `notification_messages` (the module's record) and a corresponding row is created in `alerts` (the Alert Service's processing record), linked by `alert_id`.

### Tables

```sql
-- Notification templates (human-initiated alert templates)
-- Distinct from alert_templates (doc 27) which are system alert rule definitions
CREATE TABLE notification_templates (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(200) NOT NULL UNIQUE,
    severity                alert_severity NOT NULL,  -- reuses enum from doc 27
    is_emergency            BOOLEAN NOT NULL DEFAULT false,
    title_template          TEXT NOT NULL,
    message_template        TEXT NOT NULL,
    variables               JSONB NOT NULL DEFAULT '[]',
        -- [{name, label, default_value, required}]
    default_group_id        UUID REFERENCES notification_groups(id) ON DELETE SET NULL,
    default_channels        TEXT[] NOT NULL DEFAULT '{}',
    escalation_policy       JSONB,
    requires_acknowledgment BOOLEAN NOT NULL DEFAULT false,
    is_builtin              BOOLEAN NOT NULL DEFAULT false,
    enabled                 BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by              UUID REFERENCES users(id),
    updated_by              UUID REFERENCES users(id)
);

CREATE INDEX idx_notification_templates_emergency
    ON notification_templates (is_emergency) WHERE is_emergency = true;

-- Custom alert groups (named personnel lists)
CREATE TABLE notification_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL UNIQUE,
    description     TEXT,
    group_type      VARCHAR(20) NOT NULL DEFAULT 'static',
        -- 'static', 'role_based', 'on_shift', 'on_site', 'all_users'
    source_config   JSONB,
        -- role_based: {"role_id": "uuid"}
        -- on_shift/on_site: {} (resolved dynamically from doc 30)
    is_builtin      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id)
);

-- Group members (for static groups only; dynamic groups resolve at send time)
CREATE TABLE notification_group_members (
    group_id    UUID NOT NULL REFERENCES notification_groups(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    added_by    UUID REFERENCES users(id),
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_notification_group_members_user
    ON notification_group_members (user_id);

-- Record of every human-initiated or system notification sent via this module
CREATE TABLE notification_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id            UUID REFERENCES alerts(id),
        -- links to the Alert Service's processing record in doc 27's alerts table
    template_id         UUID REFERENCES notification_templates(id),
    group_id            UUID REFERENCES notification_groups(id),
    severity            alert_severity NOT NULL,
    title               VARCHAR(500) NOT NULL,
    message             TEXT NOT NULL,
    channels_requested  TEXT[] NOT NULL,
    recipient_count     INT NOT NULL,
    source              VARCHAR(20) NOT NULL DEFAULT 'manual',
        -- 'manual' (human-initiated), 'system' (I/O backend services)
    template_variables  JSONB,
    sent_by             UUID REFERENCES users(id),  -- NULL for system-generated
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_by         UUID REFERENCES users(id),
    resolved_at         TIMESTAMPTZ,
    cancelled_by        UUID REFERENCES users(id),
    cancelled_at        TIMESTAMPTZ
);

CREATE INDEX idx_notification_messages_sent
    ON notification_messages (sent_at DESC);
CREATE INDEX idx_notification_messages_severity
    ON notification_messages (severity, sent_at DESC);
CREATE INDEX idx_notification_messages_alert
    ON notification_messages (alert_id);

-- Manual muster accountability marks during emergency alerts
CREATE TABLE notification_muster_marks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id     UUID NOT NULL REFERENCES notification_messages(id),
    person_name         VARCHAR(200) NOT NULL,
    badge_id            VARCHAR(100),
    marked_accounted    BOOLEAN NOT NULL DEFAULT true,
    marked_by           UUID NOT NULL REFERENCES users(id),
    marked_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes               TEXT
);

CREATE INDEX idx_notification_muster_marks_notification
    ON notification_muster_marks (notification_id);

-- Seed built-in groups
INSERT INTO notification_groups (name, description, group_type, is_builtin) VALUES
    ('All Users', 'Every active I/O user', 'all_users', true);
```

### Relationship Between Tables

```
notification_templates          notification_groups
        │                              │
        │ template_id                  │ group_id
        ▼                              ▼
notification_messages ──── alert_id ───> alerts (doc 27)
        │                                    │
        │ notification_id                    │ alert_id
        ▼                                    ▼
notification_muster_marks            alert_deliveries (doc 27)
                                     alert_escalations (doc 27)
```

The `notification_messages` table is the module's own record of what was sent. The `alerts` table (doc 27) is the Alert Service's processing record with delivery tracking. They are linked by `alert_id`. The module writes to `notification_messages`; the Alert Service writes to `alerts`, `alert_deliveries`, and `alert_escalations`.

---

## API Endpoints

All endpoints prefixed with `/api/notifications` to distinguish from `/api/alerts` (doc 27's Alert Service endpoints). Routed through the API Gateway.

### Send Notifications

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/api/notifications/send` | `alerts:send` | Send a notification (template-based or ad-hoc) |
| `POST` | `/api/notifications/send-emergency` | `alerts:send_emergency` | Send an emergency notification (same as send, but requires elevated permission) |

### Notification History

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/notifications` | `alerts:read` | List sent notifications (paginated, filterable) |
| `GET` | `/api/notifications/:id` | `alerts:read` | Get notification details including delivery status |
| `POST` | `/api/notifications/:id/resolve` | `alerts:send` | Mark a notification as resolved |
| `POST` | `/api/notifications/:id/cancel` | `alerts:send` | Cancel a notification (stops escalation) |

### Notification Templates

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/notifications/templates` | `alerts:read` | List all notification templates |
| `GET` | `/api/notifications/templates/:id` | `alerts:read` | Get template details |
| `POST` | `/api/notifications/templates` | `alerts:manage_templates` | Create template |
| `PUT` | `/api/notifications/templates/:id` | `alerts:manage_templates` | Update template |
| `DELETE` | `/api/notifications/templates/:id` | `alerts:manage_templates` | Delete template (built-in cannot be deleted) |

### Alert Groups

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/notifications/groups` | `alerts:read` | List all alert groups |
| `GET` | `/api/notifications/groups/:id` | `alerts:read` | Get group with member list |
| `POST` | `/api/notifications/groups` | `alerts:manage_groups` | Create group |
| `PUT` | `/api/notifications/groups/:id` | `alerts:manage_groups` | Update group |
| `DELETE` | `/api/notifications/groups/:id` | `alerts:manage_groups` | Delete group (built-in cannot be deleted) |
| `POST` | `/api/notifications/groups/:id/members` | `alerts:manage_groups` | Add members to group |
| `DELETE` | `/api/notifications/groups/:id/members/:user_id` | `alerts:manage_groups` | Remove member from group |

### Muster Status

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/notifications/:id/muster` | `alerts:muster` | Get muster status for an emergency notification |
| `POST` | `/api/notifications/:id/muster/mark` | `alerts:muster` | Mark a person as accounted |
| `GET` | `/api/notifications/:id/muster/export` | `alerts:muster` | Export unaccounted personnel list (CSV) |

### Send Notification Request Schema

```json
{
  "template_id": "uuid (optional -- if omitted, severity/title/message required)",
  "template_variables": {
    "unit": "Unit 4",
    "gas_type": "H2S",
    "instrument": "TI-401",
    "action_required": "Shelter in place"
  },
  "severity": "emergency (required if no template_id)",
  "title": "string (required if no template_id)",
  "message": "string (required if no template_id)",
  "group_id": "uuid (required -- target group)",
  "channels": ["websocket", "sms", "email"],
  "is_emergency": false
}
```

**Response**:
```json
{
  "notification_id": "uuid",
  "alert_id": "uuid",
  "status": "dispatched",
  "recipient_count": 247,
  "channels_active": ["websocket", "sms", "email"]
}
```

---

## RBAC Permissions

| Permission | Description | Default Roles |
|------------|-------------|---------------|
| `alerts:read` | Access the Alerts module, view active alerts, templates, and history | Admin, Supervisor, Operator, Viewer |
| `alerts:send` | Send non-emergency notifications | Admin, Supervisor |
| `alerts:send_emergency` | Send EMERGENCY-severity notifications (triggers full-screen takeover) | Admin |
| `alerts:manage_templates` | Create, edit, delete notification templates | Admin |
| `alerts:manage_groups` | Create, edit, delete alert groups and membership | Admin, Supervisor |
| `alerts:configure` | Configure alert channels and routing rules | Admin |
| `alerts:acknowledge` | Acknowledge received alerts (shared with doc 27 Alert System) | Admin, Supervisor, Operator |
| `alerts:muster` | View muster status dashboard, mark personnel as accounted | Admin, Supervisor |

Total: **8 permissions** in the `alerts:` namespace (shared with doc 27 Alert System). See doc 37 Section 18 for canonical permission enum.

### Permission Notes

- `alerts:send_emergency` is intentionally restrictive. During a real emergency, you don't want every user able to trigger a plant-wide full-screen takeover. This should be limited to safety officers, plant management, and shift supervisors.
- `alerts:send` covers all non-emergency severities (CRITICAL, WARNING, INFO). This allows supervisors to send shift announcements, safety bulletins, and other operational communications without requiring admin access.
- The existing `alerts:acknowledge` permission from doc 27 covers acknowledging alerts received in the WebSocket/banner UI. That permission is not duplicated here -- acknowledging is a receiver action, not a module action.

---

## Relationship to Doc 27 (Alert System)

### Division of Responsibility

| Concern | Alerts Module (this doc, 31) | Alert System (doc 27) |
|---------|------------------------------|----------------------|
| **What** | Frontend UI for sending, viewing, managing human-initiated communications | Backend engine for processing, routing, escalating, and delivering alerts |
| **Who uses it** | Safety personnel, supervisors, management (via browser) | All I/O services (via API), including this module |
| **Templates** | `notification_templates` -- pre-built messages for humans to send | `alert_templates` -- system alert rule definitions |
| **Groups** | `notification_groups` -- named personnel lists for targeting | `alert_rosters` -- recipient resolution for any alert source |
| **Delivery** | Displays delivery status | Owns delivery: channel adapters, retry logic, provider callbacks |
| **Escalation** | Configures escalation policy on templates | Executes escalation: timers, level progression, additional notifications |
| **Channels** | Shows available channels, lets user select | Owns channel adapters, configuration, health checks |
| **History** | `notification_messages` -- module's record of what was sent | `alerts` + `alert_deliveries` -- engine's processing records |
| **Mustering** | Displays muster dashboard, manual accountability | Not involved (muster data comes from doc 30) |

### Integration Flow

```
Alerts Module (frontend)
    │
    │  POST /api/notifications/send
    │  (template + variables + group + channels)
    │
    ▼
Alerts Module (API handler in API Gateway)
    │
    │  1. Resolve group → recipient list
    │  2. Render template → title + message
    │  3. Create notification_messages row
    │  4. POST /api/alerts to Alert Service
    │
    ▼
Alert Service (doc 27, port 3007)
    │
    │  Standard alert processing:
    │  fan-out, channel adapters, delivery tracking,
    │  escalation timers, audit logging
    │
    ▼
Recipients (via SMS, Email, WebSocket, Radio, PA, Push)
```

The Alerts Module is a **client** of the Alert Service. It provides the human-facing UI; the Alert Service provides the delivery engine. The module never sends SMS, email, or any notification directly -- it always dispatches through the Alert Service.

---

## Change Log

- **v0.2** — Migrated permission namespace from `alerts_module:*` to canonical `alerts:*` per doc 37 Section 18. Merged `alerts_module:access` and `alerts_module:view_history` into `alerts:read`. Added `alerts:configure` and `alerts:acknowledge` (shared with doc 27). Permission count now 8. Updated all API endpoint permission annotations. Replaced non-canonical role names (Power User, User) with canonical roles (Supervisor, Operator, Viewer) per doc 03.
- **v0.1** — Initial document. Alerts Module as human-initiated communication tool with critical distinction from process alarms. Module UI with 6 views (main, send alert, history, group management, template management, muster dashboard). Notification templates with 10 built-in templates. Custom alert groups (static, role-based, on-shift, on-site, all-users). Alert sending workflow dispatching through Alert Service (doc 27). I/O system health alerts. 5 database tables with `notification_` prefix to avoid collision with doc 27. 18 API endpoints under `/api/notifications`. 7 RBAC permissions under `alerts_module:` namespace. Muster integration referencing doc 30.
