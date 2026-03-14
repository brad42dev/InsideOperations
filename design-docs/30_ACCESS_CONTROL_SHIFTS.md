# 30. Access Control, Shifts & Presence

## Overview

This module provides shift schedule management, badge-based access control integration, personnel presence tracking, and emergency mustering for Inside/Operations. It serves as the central source of personnel presence data consumed by the Alert System (doc 27), Log (doc 13), Rounds (doc 14), Reports (doc 11), Forensics (doc 12), Dashboards (doc 10), and Console/Process graphics (docs 07/08).

The module has two distinct operational surfaces:

1. **Shifts Module (Frontend)** — A top-level frontend module (one of 11 modules in the sidebar) where managers and supervisors build shift schedules, assign crews, manage rosters, and monitor on-site presence. This is NOT buried in Settings.
2. **Settings > Access Control** — Admin-level configuration for badge system connections, adapter settings, muster point hardware assignment, and external workforce management system integration.

### Design Principles

1. **Read-only badge integration** — I/O pulls badge swipe data from external access control systems. It never writes back. Even during mustering, the badge input mechanism is external; I/O consumes the data.
2. **Optional, not mandatory** — Sites without badge systems or shift schedules can skip this module entirely. Alert routing falls back to manual rosters or "alert everyone." No module depends on shift data being present.
3. **Dual-source shift management** — I/O can own shift schedules directly OR import from external workforce management systems. Both paths produce the same internal data model.
4. **Real-time presence** — Badge events are polled and processed into a live presence state table. Presence data is available to all consuming modules within one polling cycle.

---

## Shifts Module UI

The Shifts module is a top-level frontend module accessible from the left sidebar. It requires `shifts:read` permission to access. The module has four main views.

### Roster View (Default)

The primary view shows who is currently on shift and who is on site.

**Current Shift Panel**:
- Active shift name, start/end time, time remaining
- Crew/team roster: list of assigned personnel with role (e.g., Board Operator, Field Operator, Shift Supervisor)
- On-site indicator per person (green dot if badged in, gray if not)
- Quick filters: by team, by role

**On-Site Panel**:
- Headcount of all personnel currently badged into the facility
- List view: name, badge-in time, last known area (from most recent reader), assigned shift (if any)
- Highlight personnel who are on site but NOT assigned to the current shift (contractors, management, visitors with I/O accounts)
- Sort by: name, badge-in time, area

**Upcoming Shift Panel**:
- Next shift name, start time, assigned crew
- Handover countdown timer

### Schedule Builder

A calendar-based view for creating and managing shift schedules.

**Schedule Calendar**:
- Week/month view with shift blocks displayed as colored bars
- Drag-and-drop shift block creation and resizing
- Color-coded by shift pattern (day, night, swing) or by crew
- Click a shift block to edit: start/end time, assigned crew, notes

**Shift Patterns**:
- Pre-built templates for common industrial patterns:
  - **8h x 3**: Day (06:00-14:00), Swing (14:00-22:00), Night (22:00-06:00)
  - **12h x 2**: Day (06:00-18:00), Night (18:00-06:00)
  - **DuPont**: 12-hour rotating, 4-crew, 28-day cycle
  - **Pitman**: 12-hour rotating, 4-crew, 14-day cycle
  - **Custom**: User-defined start/end, rotation period, crew count
- Pattern wizard: select a pattern, set start date, assign crews, generate schedule for N weeks
- Patterns can be modified after generation (individual shift overrides for holidays, outages, etc.)

**Crew Management**:
- Create/edit crews (named groups of personnel)
- Assign I/O users to crews
- A user can belong to multiple crews (e.g., primary crew + overtime pool)
- Crew membership is separate from RBAC roles — a user's crew assignment does not affect their permissions

**Handover Configuration**:
- Handover overlap period (default: 30 minutes)
- During handover, both outgoing and incoming crews are considered "on shift" for alert routing purposes
- Configurable per shift pattern

### Presence Dashboard

A real-time overview of facility presence status.

**Headcount Summary**:
- Total on site (from badge data)
- On shift (from shift schedule)
- On site but off shift
- Expected but not badged in (assigned to current shift, not yet badged in)

**Area Breakdown** (if multiple badge readers map to named areas):
- Table: area name, headcount, list of personnel
- Only available if the badge system provides area/zone information from reader locations

**Presence Timeline**:
- Horizontal bar chart showing badge-in/badge-out patterns over the past 24-48 hours
- Useful for identifying patterns (when do most people arrive, when does the facility empty out)

### Muster View

Available at all times but becomes the primary focus during an emergency. See [Muster Points](#muster-points) section below.

---

## Badge Integration Architecture

### Adapter Pattern

Badge integration uses a trait-based adapter pattern consistent with the Shared Crate First principle (doc 02). Each supported access control vendor has an adapter that implements a common trait.

```rust
#[async_trait]
pub trait BadgeAdapter: Send + Sync {
    fn adapter_type(&self) -> BadgeAdapterType;
    fn display_name(&self) -> &str;

    /// Poll for new badge events since the given checkpoint.
    /// Returns events in chronological order.
    async fn poll_events(
        &self,
        since: DateTime<Utc>,
    ) -> Result<Vec<BadgeEvent>, BadgeAdapterError>;

    /// Look up personnel info by badge/employee ID.
    async fn lookup_person(
        &self,
        identifier: &str,
    ) -> Result<Option<ExternalPerson>, BadgeAdapterError>;

    /// Test connectivity to the access control system.
    async fn health_check(&self) -> Result<(), BadgeAdapterError>;
}

pub enum BadgeAdapterType {
    LenelOnGuard,
    CCure9000,
    GenetecSecurityCenter,
    HoneywellProWatch,
    GallagherCommandCentre,
    GenericDatabase,
}

pub struct BadgeEvent {
    pub external_event_id: String,
    pub badge_id: String,
    pub person_name: Option<String>,
    pub employee_id: Option<String>,
    pub event_type: BadgeEventType,    // SwipeIn, SwipeOut, AccessDenied, DoorForced, DoorHeldOpen, Duress, PassbackViolation, Tailgate
    pub reader_id: String,
    pub reader_name: Option<String>,
    pub reader_area: Option<String>,
    pub timestamp: DateTime<Utc>,
}

pub enum BadgeEventType {
    SwipeIn,
    SwipeOut,
    AccessDenied,
    DoorForced,        // Door opened without valid badge swipe
    DoorHeldOpen,      // Door held open beyond allowed time
    Duress,            // Duress code entered (special PIN under threat)
    PassbackViolation, // Anti-passback rule violated (double entry/exit)
    Tailgate,          // Multiple entries on single badge swipe detected
}

pub struct ExternalPerson {
    pub employee_id: String,
    pub badge_id: String,
    pub full_name: String,
    pub department: Option<String>,
    pub title: Option<String>,
}
```

### Supported Access Control Systems

#### 1. Lenel OnGuard

**Integration method**: Direct database read (SQL Server or Oracle) against OnGuard's `EVENTS` and `BADGE` tables, or via OnGuard OpenAccess API (REST).

| Setting | Description |
|---------|-------------|
| `connection_type` | `database` or `openaccess_api` |
| `connection_string` | Database connection string (for `database` mode) |
| `api_url` | OpenAccess API base URL (for `openaccess_api` mode) |
| `api_key` | API key (encrypted at rest) |
| `event_table` | Override for event table/view name (default: `EVENTS`) |
| `badge_in_codes` | List of event type codes that mean "badge in" (varies by OnGuard config) |
| `badge_out_codes` | List of event type codes that mean "badge out" |
| `event_code_mapping` | JSON map of vendor event codes to I/O event types: `{ "1234": "door_forced", "5678": "duress" }`. Unmapped codes are logged but not imported. |

#### 2. Software House CCURE 9000

**Integration method**: CCURE 9000 Webservice API (SOAP/REST) or direct SQL Server database read.

| Setting | Description |
|---------|-------------|
| `connection_type` | `api` or `database` |
| `api_url` | CCURE webservice URL |
| `username` | API/DB username |
| `password` | Password (encrypted at rest) |
| `facility_filter` | Optional facility ID filter (for multi-facility deployments) |

#### 3. Genetec Security Center

**Integration method**: Genetec Web SDK (REST API).

| Setting | Description |
|---------|-------------|
| `api_url` | Security Center Web SDK URL |
| `app_id` | Application ID |
| `username` | API username |
| `password` | Password (encrypted at rest) |
| `area_filter` | Optional area entity filter |

#### 4. Honeywell Pro-Watch

**Integration method**: Pro-Watch REST API or SignalR real-time push (Pro-Watch 5.0+).

| Setting | Description |
|---------|-------------|
| `connection_type` | `rest_api` or `signalr` |
| `api_url` | Pro-Watch API base URL |
| `username` | API username |
| `password` | Password (encrypted at rest) |
| `signalr_hub_url` | SignalR hub URL (for real-time push mode — lowest latency of any supported system) |
| `event_code_mapping` | JSON map of Pro-Watch event codes to I/O event types |

#### 5. Gallagher Command Centre

**Integration method**: Gallagher REST API (the only vendor with fully public API documentation on GitHub).

| Setting | Description |
|---------|-------------|
| `api_url` | Command Centre API URL |
| `api_key` | API key (encrypted at rest) |
| `certificate_path` | Client certificate for mTLS (Gallagher requires mutual TLS) |
| `event_code_mapping` | JSON map of Gallagher event type names to I/O event types |

#### 6. Generic Database Adapter

For access control systems not explicitly supported — any system whose events can be queried from a database view or table.

| Setting | Description |
|---------|-------------|
| `database_type` | `postgres`, `mssql`, `oracle`, `mysql` |
| `connection_string` | Database connection string |
| `event_query` | SQL query that returns columns: `event_id`, `badge_id`, `person_name`, `employee_id`, `event_type`, `reader_id`, `reader_name`, `reader_area`, `timestamp` |
| `badge_in_value` | Value in `event_type` column that means "badge in" |
| `badge_out_value` | Value in `event_type` column that means "badge out" |
| `event_value_mapping` | JSON map of source values to I/O event types: `{ "FORCED": "door_forced", "HELD": "door_held_open", "DURESS": "duress", "PASSBACK": "passback_violation", "TAILGATE": "tailgate" }` |

### Polling Engine

The API Gateway runs a background Tokio task that polls each configured badge source at its configured interval.

**Default polling interval**: 30 seconds (configurable per source, range: 10s–300s).

**Polling flow**:
1. Read `last_poll_checkpoint` from `access_control_sources` table
2. Call `adapter.poll_events(since: checkpoint)`
3. For each returned event:
   a. Deduplicate by `external_event_id` (skip if already in `badge_events`)
   b. Map `employee_id` or `badge_id` to I/O user via `users.employee_id` mapping field (see User Mapping below)
   c. Insert into `badge_events` table
   d. Update `presence_status` table (set on-site/off-site based on event type)
4. Update `last_poll_checkpoint` to the most recent event timestamp
5. On adapter error: log warning, retry on next poll cycle, increment `consecutive_failures` counter. After 5 consecutive failures, fire a WARNING alert via the Alert Service.

### User Mapping

Badge system personnel are mapped to I/O users via a configurable identifier field on the `users` table:

- **Primary mapping**: `users.employee_id` (new column) matched against `badge_event.employee_id`
- **Fallback mapping**: Configurable per adapter — can match on badge ID, email, or username
- **Unmatched personnel**: Badge events from people without I/O accounts are still tracked in `badge_events` and `presence_status` (with `user_id = NULL`). They appear in the on-site list and muster roster by name (from badge system) but cannot be assigned to shifts or receive alerts.

---

## Presence Data Model

Presence tracks two orthogonal states per person:

1. **On-site status** — derived from badge events. A person is "on site" from their most recent SwipeIn until their most recent SwipeOut (or end-of-day timeout if no SwipeOut is recorded).
2. **On-shift status** — derived from the shift schedule. A person is "on shift" when the current time falls within their assigned shift block (including handover overlap).

### Presence State Machine

```
Badge SwipeIn  → on_site = true,  last_badge_area = reader_area
Badge SwipeOut → on_site = false, badge_out_at = now
Shift starts   → on_shift = true  (from schedule, not a badge event)
Shift ends     → on_shift = false (from schedule)
```

### Stale Presence Handling

If a person badges in but never badges out (forgot to swipe, tailgating, reader malfunction), their on-site status persists indefinitely. To prevent ghost entries:

- **Auto-timeout**: Configurable maximum on-site duration (default: 16 hours). After this threshold, the person's status flips to `stale` (still shown in the on-site list but visually distinguished with a warning indicator).
- **Shift-end inference**: If a person's assigned shift ends and they haven't badged out within 2 hours of shift end, optionally auto-clear their on-site status (configurable, off by default).
- **Manual clear**: Shift supervisors with `presence:manage` permission can manually mark someone as off-site.

---

## Muster Points

### Configuration

Muster points are specific badge readers (or groups of readers) designated as emergency assembly locations. Configuration lives in **Settings > Access Control > Muster Points**.

| Setting | Description |
|---------|-------------|
| Name | Human-readable name (e.g., "Main Gate Muster", "Unit 4 Assembly") |
| Badge reader(s) | One or more reader IDs from the badge system that serve this muster point |
| Capacity | Optional expected headcount for reporting |
| GPS coordinates | Optional lat/long for map display and mobile field reference |

### Emergency Muster Workflow

1. **Emergency triggered**: An EMERGENCY alert fires via the Alert Service (doc 27).
2. **Muster activated**: The muster view becomes the primary focus in the Shifts module. If the alert template has `muster_enabled: true`, the muster overlay also appears on the emergency alert UI.
3. **Badge scanning begins**: Personnel badge in at designated muster point readers. Each swipe at a muster reader during an active emergency creates a `muster_event` record.
4. **Real-time accounting**: The muster view shows:
   - Total on-site (from presence data at time of emergency)
   - Accounted (badged at a muster point since emergency start)
   - Unaccounted (on-site but not yet badged at any muster point)
   - Per-muster-point headcount
5. **Manual accounting**: For personnel who reach a muster point but don't have their badge, supervisors with `muster:manage` permission can manually mark them as accounted.
6. **Emergency resolved**: When the emergency alert is resolved or cancelled, the muster session ends. Final muster accounting is snapshot for reporting.

### Muster Status States

| Status | Meaning |
|--------|---------|
| `unaccounted` | Person was on site at emergency start, not yet badged at any muster point |
| `accounted_badge` | Person badged in at a muster point reader |
| `accounted_manual` | Person manually marked as accounted by a supervisor |
| `off_site` | Person badged out before or after the emergency |
| `stale` | Person's on-site status was already stale at emergency start (flagged for review) |

### Muster as Graphic Element

Muster point status is available as a bindable element for Console (doc 07) and Process (doc 08) graphics:

- **Indicator element**: Green/yellow/red circle bound to a muster point ID
  - Green: no active emergency, or all accounted
  - Yellow: active emergency, accounting in progress
  - Red: active emergency, unaccounted personnel remain
- **Headcount overlay**: Shows `accounted / total` as text (e.g., "47/52")
- **Click interaction**: Opens a popup list of everyone who has badged in at that muster point, plus the unaccounted list
- Point binding type: `muster_point` with value mapping per the Graphics System conventions (doc 19)

### Muster for Dashboards

Available dashboard widgets (doc 10):

- **Muster Status Widget**: Real-time accounted/unaccounted during an active emergency. Shows "No active muster" during normal operations.
- **Muster History Widget**: Table of past muster events with date, duration, total personnel, final unaccounted count.

---

## Cross-Module Integration

### Alert System (doc 27)

- **Shift-aware routing**: Alert rosters with `source: 'on_shift'` resolve their member list dynamically from the current shift schedule. The Alert Service queries `GET /api/shifts/current/personnel` at alert trigger time.
- **On-site routing**: Alert rosters with `source: 'on_site'` resolve from current presence data via `GET /api/presence/on-site`.
- **Muster dashboard**: During EMERGENCY alerts with `muster_enabled: true`, the alert overlay includes a "Muster Status" summary (accounted/total) with a link to the full muster view.
- **Muster completion alert**: When all on-site personnel are accounted for, an automatic INFO alert is generated: "Muster complete — all personnel accounted."

### Console / Process Graphics (docs 07/08)

- **Muster point element**: Bindable graphic element showing muster point status (green/yellow/red indicator, headcount). Click to expand badge-in list.
- **Shift info element**: Optional text element bound to current shift name, time remaining, or on-shift headcount.
- **On-site headcount element**: Bindable text showing total facility headcount.
- All elements update in real-time via WebSocket subscription to the `presence` topic.

### Dashboards (doc 10)

- **Shift Roster Widget**: Shows current shift crew, upcoming shift, handover countdown.
- **On-Site Headcount Widget**: Real-time headcount with sparkline trend (24h).
- **Muster Status Widget**: Active emergency muster accounting (or "No active muster").
- **Muster History Widget**: Past muster event summary table.

### Reports (doc 11)

- **Shift-based filtering**: Any report can be filtered by shift (e.g., "show data from night shift only"). The filter resolves shift blocks for the report's date range and includes only data timestamped within those blocks.
- **Muster Event Report**: Pre-built report template showing muster event history: date, trigger reason, duration, total on-site, accounted, unaccounted names.
- **Attendance Report**: Badge-in/badge-out history per person over a date range. Hours on site per day/week.
- **Shift Coverage Report**: Scheduled vs. actual shift coverage — who was assigned, who actually badged in during the shift window.

### Forensics (doc 12)

- **Personnel correlation**: "Who was on shift when this event occurred?" query. Given a timestamp, Forensics can resolve the active shift, crew, and on-site personnel.
- **Presence timeline**: Badge events for a specific person or group overlaid on the forensic timeline alongside process data, log entries, and alarm events.

### Log (doc 13)

- **Auto-tagging**: Log entries are tagged with the current shift ID when created. This enables shift-based log filtering and handover review.
- **Shift log boundary**: Shift logs can be scoped per-shift, with a clear visual boundary at shift changeover. Multiple concurrent shift logs per shift are supported (e.g., logistics team log vs. utilities team log).
- **Badge-entry auto-log**: Configurable (off by default). When enabled, a badge-in event for a shift member auto-creates a system log entry: "[Name] badged in at [Reader] at [Time]."

### Rounds (doc 14)

- **Shift-based assignment**: Rounds can be assigned by shift — "assign this round to whoever is on the day shift." The assignment resolves dynamically at round start time.
- **Off-site flagging**: If a round entry is submitted by a user whose presence status is NOT on-site (no badge-in record), the entry is flagged with a warning indicator. The round is still accepted — the flag is informational, not blocking.
- **GPS on every entry**: Round entries capture GPS coordinates (from the mobile device). This is independent of badge data but can be cross-referenced with reader area data for verification.

### Settings (doc 15)

- **Badge System Configuration**: Settings > Access Control — connection setup for badge adapters, polling intervals, user mapping rules, health status.
- **Muster Point Configuration**: Settings > Access Control > Muster Points — assign badge readers to named muster points.
- **Shift management admin functions**: Settings > Access Control — default shift patterns, handover overlap defaults, stale presence timeout. General shift creation and roster management lives in the Shifts module, not here.

---

## Shift Import from External Systems

For sites that manage shifts in external workforce management systems, I/O can import shift data instead of managing it natively.

### Supported Import Sources

| System | Integration Method |
|--------|-------------------|
| SAP HCM / SuccessFactors | REST API or database view |
| Kronos / UKG | REST API (Workforce Central or Dimensions) |
| Generic CSV/SFTP | Scheduled file drop (CSV with shift, date, start, end, employee_id) |
| Generic REST API | Configurable endpoint returning shift schedule JSON |

Import uses a lightweight adapter (similar to badge adapters) that maps external shift data into I/O's internal `shifts` and `shift_assignments` tables. Imported shifts are flagged as `source: 'external'` and cannot be edited in the Shifts module UI (read-only display). The external system remains the source of truth.

**Sync interval**: Configurable (default: 1 hour). I/O polls the external system and reconciles changes (added/removed shifts, changed assignments).

**Conflict handling**: If a site switches from external to I/O-managed shifts, existing imported shifts are archived and I/O takes over as the source of truth going forward. The two modes are mutually exclusive per shift pattern (not per individual shift).

---

## Database Schema

### Tables

```sql
-- Access control system sources (badge system connections)
CREATE TABLE access_control_sources (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(200) NOT NULL UNIQUE,
    adapter_type            VARCHAR(30) NOT NULL,   -- 'lenel', 'ccure', 'genetec', 'generic_db'
    config                  JSONB NOT NULL,          -- adapter-specific config (secrets encrypted at app layer)
    polling_interval_sec    INT NOT NULL DEFAULT 30,
    enabled                 BOOLEAN NOT NULL DEFAULT true,
    last_poll_at            TIMESTAMPTZ,
    last_poll_checkpoint    TIMESTAMPTZ,
    last_poll_events        INT,
    consecutive_failures    INT NOT NULL DEFAULT 0,
    last_error              TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by              UUID REFERENCES users(id),
    updated_by              UUID REFERENCES users(id)
);

-- Badge events (raw event log from access control systems)
CREATE TABLE badge_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id           UUID NOT NULL REFERENCES access_control_sources(id),
    external_event_id   VARCHAR(200) NOT NULL,
    user_id             UUID REFERENCES users(id),      -- NULL if unmatched
    badge_id            VARCHAR(100) NOT NULL,
    person_name         VARCHAR(200),
    employee_id         VARCHAR(100),
    event_type          VARCHAR(20) NOT NULL,            -- 'swipe_in', 'swipe_out', 'access_denied', 'door_forced', 'door_held_open', 'duress', 'passback_violation', 'tailgate'
    reader_id           VARCHAR(100) NOT NULL,
    reader_name         VARCHAR(200),
    reader_area         VARCHAR(200),
    event_time          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_badge_events_dedup ON badge_events (source_id, external_event_id);
CREATE INDEX idx_badge_events_user ON badge_events (user_id, event_time DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_badge_events_time ON badge_events (event_time DESC);
CREATE INDEX idx_badge_events_employee ON badge_events (employee_id, event_time DESC)
    WHERE employee_id IS NOT NULL;

-- Real-time presence status (materialized from badge events)
CREATE TABLE presence_status (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users(id),      -- NULL if no I/O account
    badge_id            VARCHAR(100) NOT NULL,
    person_name         VARCHAR(200),
    employee_id         VARCHAR(100),
    is_on_site          BOOLEAN NOT NULL DEFAULT false,
    badge_in_at         TIMESTAMPTZ,
    badge_out_at        TIMESTAMPTZ,
    last_reader_area    VARCHAR(200),
    status              VARCHAR(20) NOT NULL DEFAULT 'off_site',
                        -- 'on_site', 'off_site', 'stale'
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_presence_status_badge ON presence_status (badge_id);
CREATE INDEX idx_presence_status_user ON presence_status (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_presence_status_onsite ON presence_status (is_on_site) WHERE is_on_site = true;

-- Shift patterns (templates for generating shift schedules)
CREATE TABLE shift_patterns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL UNIQUE,
    description     TEXT,
    pattern_type    VARCHAR(30) NOT NULL,  -- '8x3', '12x2', 'dupont', 'pitman', 'custom'
    pattern_config  JSONB NOT NULL,         -- start/end times, rotation rules, crew count
    handover_minutes INT NOT NULL DEFAULT 30,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id)
);

-- Crews (named groups of personnel assigned to shifts)
CREATE TABLE shift_crews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL UNIQUE,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id)
);

-- Crew membership
CREATE TABLE shift_crew_members (
    crew_id     UUID NOT NULL REFERENCES shift_crews(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_label  VARCHAR(100),   -- 'Board Operator', 'Field Operator', 'Shift Supervisor', etc.
    PRIMARY KEY (crew_id, user_id)
);

-- Individual shift instances (generated from patterns or manually created)
CREATE TABLE shifts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id      UUID REFERENCES shift_patterns(id),
    name            VARCHAR(200) NOT NULL,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    crew_id         UUID REFERENCES shift_crews(id),
    source          VARCHAR(20) NOT NULL DEFAULT 'manual',  -- 'manual', 'generated', 'external'
    external_id     VARCHAR(200),       -- ID from external workforce system (if imported)
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id)
);

CREATE INDEX idx_shifts_time ON shifts (start_time, end_time);
CREATE INDEX idx_shifts_crew ON shifts (crew_id);
CREATE INDEX idx_shifts_active ON shifts (start_time, end_time)
    WHERE end_time > now();

-- Per-user shift assignments (for individual overrides beyond crew membership)
CREATE TABLE shift_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id    UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_label  VARCHAR(100),
    source      VARCHAR(20) NOT NULL DEFAULT 'crew',  -- 'crew' (from crew membership), 'direct' (individual assignment), 'external'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES users(id)
);

CREATE UNIQUE INDEX idx_shift_assignments_unique ON shift_assignments (shift_id, user_id);
CREATE INDEX idx_shift_assignments_user ON shift_assignments (user_id, created_at DESC);

-- Muster points (designated emergency assembly locations)
CREATE TABLE muster_points (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL UNIQUE,
    reader_ids      TEXT[] NOT NULL,         -- badge reader IDs that serve this muster point
    source_id       UUID REFERENCES access_control_sources(id),
    capacity        INT,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id)
);

-- Muster events (per-emergency muster sessions)
CREATE TABLE muster_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id            UUID NOT NULL REFERENCES alerts(id),
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at            TIMESTAMPTZ,
    total_on_site       INT NOT NULL,           -- snapshot of on-site count at muster start
    total_accounted     INT NOT NULL DEFAULT 0,
    total_unaccounted   INT NOT NULL DEFAULT 0,
    status              VARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active', 'completed', 'cancelled'
    started_by          UUID REFERENCES users(id),
    ended_by            UUID REFERENCES users(id)
);

CREATE INDEX idx_muster_events_alert ON muster_events (alert_id);
CREATE INDEX idx_muster_events_active ON muster_events (status) WHERE status = 'active';

-- Muster accounting (per-person status during a muster event)
CREATE TABLE muster_accounting (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    muster_event_id     UUID NOT NULL REFERENCES muster_events(id) ON DELETE CASCADE,
    person_name         VARCHAR(200) NOT NULL,
    user_id             UUID REFERENCES users(id),
    badge_id            VARCHAR(100),
    employee_id         VARCHAR(100),
    muster_point_id     UUID REFERENCES muster_points(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'unaccounted',
                        -- 'unaccounted', 'accounted_badge', 'accounted_manual', 'off_site', 'stale'
    accounted_at        TIMESTAMPTZ,
    accounted_by        UUID REFERENCES users(id),  -- for manual accounting
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_muster_accounting_event ON muster_accounting (muster_event_id);
CREATE INDEX idx_muster_accounting_status ON muster_accounting (muster_event_id, status)
    WHERE status = 'unaccounted';

-- Custom alert groups (manually created personnel lists for alert routing)
CREATE TABLE custom_alert_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL UNIQUE,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id)
);

-- Custom alert group members
CREATE TABLE custom_alert_group_members (
    group_id    UUID NOT NULL REFERENCES custom_alert_groups(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id),          -- NULL for external contacts
    name        VARCHAR(200) NOT NULL,
    email       VARCHAR(254),
    phone       VARCHAR(30),
    radio_id    VARCHAR(50),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, COALESCE(user_id, gen_random_uuid()))
);

-- Use a unique index instead for the composite key since user_id is nullable
ALTER TABLE custom_alert_group_members DROP CONSTRAINT custom_alert_group_members_pkey;
ALTER TABLE custom_alert_group_members ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX idx_alert_group_members_user ON custom_alert_group_members (group_id, user_id)
    WHERE user_id IS NOT NULL;
```

### Users Table Extension

The `users` table (doc 04) requires a new column for badge system mapping:

```sql
ALTER TABLE users ADD COLUMN employee_id VARCHAR(100);
CREATE UNIQUE INDEX idx_users_employee_id ON users (employee_id) WHERE employee_id IS NOT NULL;
```

### Data Retention

- **badge_events**: Retained for 90 days (configurable). Older events archived or purged by scheduled cleanup. Presence reporting queries use aggregated data, not raw events.
- **presence_status**: Live table, no retention policy (always reflects current state). Updated in place.
- **muster_accounting**: Retained indefinitely (regulatory compliance — OSHA PSM requires emergency response documentation).
- **muster_events**: Retained indefinitely.
- **shifts / shift_assignments**: Retained for 2 years (configurable). Historical shift data supports forensic investigations and compliance audits.

---

## API Endpoints

All endpoints prefixed with `/api/shifts` or `/api/presence` and routed through the API Gateway.

### Shift Management

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/shifts` | `shifts:read` | List shifts (paginated, filterable by date range, crew, pattern) |
| `GET` | `/api/shifts/current` | `shifts:read` | Get current active shift(s) |
| `GET` | `/api/shifts/current/personnel` | `shifts:read` | List personnel on the current shift (consumed by Alert Service) |
| `GET` | `/api/shifts/:id` | `shifts:read` | Get shift details with assigned personnel |
| `POST` | `/api/shifts` | `shifts:write` | Create a shift |
| `PUT` | `/api/shifts/:id` | `shifts:write` | Update a shift |
| `DELETE` | `/api/shifts/:id` | `shifts:write` | Delete a shift |

### Shift Patterns

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/shifts/patterns` | `shifts:read` | List shift patterns |
| `GET` | `/api/shifts/patterns/:id` | `shifts:read` | Get pattern details |
| `POST` | `/api/shifts/patterns` | `shifts:write` | Create shift pattern |
| `PUT` | `/api/shifts/patterns/:id` | `shifts:write` | Update shift pattern |
| `DELETE` | `/api/shifts/patterns/:id` | `shifts:write` | Delete shift pattern |
| `POST` | `/api/shifts/patterns/:id/generate` | `shifts:write` | Generate shift schedule from pattern for a date range |

### Crews

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/shifts/crews` | `shifts:read` | List crews |
| `GET` | `/api/shifts/crews/:id` | `shifts:read` | Get crew with members |
| `POST` | `/api/shifts/crews` | `shifts:write` | Create crew |
| `PUT` | `/api/shifts/crews/:id` | `shifts:write` | Update crew |
| `DELETE` | `/api/shifts/crews/:id` | `shifts:write` | Delete crew |
| `PUT` | `/api/shifts/crews/:id/members` | `shifts:write` | Set crew membership |

### Presence

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/presence/on-site` | `presence:read` | List all on-site personnel (consumed by Alert Service) |
| `GET` | `/api/presence/on-site/count` | `presence:read` | On-site headcount |
| `GET` | `/api/presence/status/:user_id` | `presence:read` | Get presence status for a specific user |
| `GET` | `/api/presence/badge-events` | `presence:read` | Paginated badge event history (filterable by person, date range, area) |
| `POST` | `/api/presence/clear/:badge_id` | `presence:manage` | Manually clear on-site status for a stale entry |

### Muster Points

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/muster/points` | `shifts:read` | List configured muster points |
| `GET` | `/api/muster/points/:id` | `shifts:read` | Get muster point details |
| `POST` | `/api/muster/points` | `muster:manage` | Create muster point |
| `PUT` | `/api/muster/points/:id` | `muster:manage` | Update muster point |
| `DELETE` | `/api/muster/points/:id` | `muster:manage` | Delete muster point |

### Muster Events

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/muster/events` | `shifts:read` | List muster events (paginated, filterable by status, date range) |
| `GET` | `/api/muster/events/active` | `shifts:read` | Get active muster event (if any) |
| `GET` | `/api/muster/events/:id` | `shifts:read` | Get muster event details with per-person accounting |
| `POST` | `/api/muster/events/:id/account` | `muster:manage` | Manually mark a person as accounted |
| `POST` | `/api/muster/events/:id/end` | `muster:manage` | End (complete) a muster event |

### Custom Alert Groups

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/alert-groups` | `alert_groups:read` | List custom alert groups |
| `GET` | `/api/alert-groups/:id` | `alert_groups:read` | Get group with members |
| `POST` | `/api/alert-groups` | `alert_groups:write` | Create group |
| `PUT` | `/api/alert-groups/:id` | `alert_groups:write` | Update group |
| `DELETE` | `/api/alert-groups/:id` | `alert_groups:write` | Delete group |
| `PUT` | `/api/alert-groups/:id/members` | `alert_groups:write` | Set group membership |

### Badge Source Configuration

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/badge-sources` | `badge_config:manage` | List configured badge sources |
| `GET` | `/api/badge-sources/:id` | `badge_config:manage` | Get source details (secrets masked) |
| `POST` | `/api/badge-sources` | `badge_config:manage` | Create badge source |
| `PUT` | `/api/badge-sources/:id` | `badge_config:manage` | Update badge source |
| `DELETE` | `/api/badge-sources/:id` | `badge_config:manage` | Delete badge source |
| `POST` | `/api/badge-sources/:id/test` | `badge_config:manage` | Test badge source connectivity |
| `PUT` | `/api/badge-sources/:id/enabled` | `badge_config:manage` | Enable/disable badge source |

---

## RBAC Permissions

| Permission | Description | Default Roles |
|------------|-------------|---------------|
| `shifts:read` | View shifts, schedules, crews, muster points, muster events | All roles |
| `shifts:write` | Create/edit shifts, patterns, crews, shift assignments | Supervisor, Admin |
| `presence:read` | View on-site personnel, badge events, presence status | All roles |
| `presence:manage` | Manually clear stale presence entries | Supervisor, Admin |
| `muster:manage` | Configure muster points, manually account personnel during muster, end muster events | Supervisor, Admin |
| `badge_config:manage` | Configure badge system connections, adapters, polling, user mapping | Admin |
| `alert_groups:read` | View custom alert groups and membership | All roles |
| `alert_groups:write` | Create, edit, delete custom alert groups and manage membership | Supervisor, Admin |

*Role-permission assignments are managed centrally in doc 03. Defaults shown for reference.*

Total: **8 shift/presence permissions**. See doc 03 for the complete canonical list of **118 permissions across 15 modules**.

---

## Configuration

### Settings > Access Control (Admin)

Administrative configuration that requires `badge_config:manage` permission:

- **Badge Sources**: Connection setup for each access control system adapter. Add/edit/delete/test badge source connections. Polling interval per source. Health status indicator (last poll time, event count, consecutive failures).
- **User Mapping**: Configure which field maps badge system personnel to I/O users (`employee_id` by default). Bulk mapping UI: show unmatched badge personnel alongside I/O users for manual matching.
- **Muster Points**: Assign badge readers to named muster points. Reader ID picker populated from badge events (shows readers that have produced events). GPS coordinates and capacity fields.
- **Presence Settings**: Stale presence timeout (default: 16 hours). Shift-end auto-clear toggle and delay. Badge event retention period (default: 90 days).
- **Shift Import**: External workforce management system connection (if using external shifts). Sync interval. Last sync status.

### Shifts Module (Manager/Supervisor)

Operational shift management that requires `shifts:write` permission:

- Shift schedule creation and editing
- Crew creation and membership management
- Shift pattern configuration and schedule generation
- Individual shift assignment overrides
- Handover overlap configuration

The distinction is: **Settings** handles the plumbing (how does I/O connect to the badge system, what are the muster points, what timeouts apply). **Shifts module** handles the daily operations (who is working when, what crews exist, what's the schedule for next week).

---

## WebSocket Integration

The presence subsystem publishes real-time updates via the WebSocket broker (doc 16).

### Subscription Topics

| Topic | Payload | Description |
|-------|---------|-------------|
| `presence:headcount` | `{ "on_site": 142, "on_shift": 48 }` | Headcount update (published on every badge event) |
| `presence:badge_event` | `{ "person_name": "...", "event_type": "swipe_in", "area": "...", "time": "..." }` | Individual badge event (for real-time roster updates) |
| `muster:status` | `{ "muster_event_id": "...", "accounted": 47, "unaccounted": 5, "total": 52 }` | Muster accounting update during active emergency |
| `muster:person_accounted` | `{ "person_name": "...", "muster_point": "...", "method": "badge" }` | Individual muster accounting event |

Clients subscribe to these topics using the standard WebSocket subscription protocol (doc 16). Presence topics require `presence:read` permission. Muster topics require `shifts:read` permission.

---

## Technology Stack

### New Crates

No new external crates required. Badge adapter HTTP calls use `reqwest` (already in stack). Database adapters for Lenel/CCURE/generic use `sqlx` (already in stack, supports PostgreSQL and MSSQL) or `tiberius` (MIT, for direct MSSQL connections to OnGuard/CCURE databases — already used by Event Service for MSSQL historian, doc 02).

### Existing Crates

| Crate | Purpose |
|-------|---------|
| `reqwest` | HTTP client for REST API adapters (Genetec, OnGuard OpenAccess) |
| `sqlx` | PostgreSQL queries, MSSQL adapter connections |
| `tiberius` | Direct MSSQL connections for OnGuard/CCURE database adapters |
| `serde` / `serde_json` | Badge event and config serialization |
| `tokio` | Async runtime, polling tasks, presence update processing |
| `tracing` | Structured logging |
| `chrono` | Timestamp handling for shift scheduling and badge event processing |

---

## Deployment

### Service Architecture

This module does NOT introduce a new backend service. All shift, presence, badge, and muster functionality is handled by the API Gateway (port 3000) via new route handlers. The badge polling engine runs as a background Tokio task within the API Gateway process.

**Rationale**: Unlike the Alert Service or Email Service (which have independent delivery queues and external integrations requiring dedicated processes), this module's workload is lightweight — periodic polling, CRUD operations, and presence state updates. It does not justify a 12th service.

### Configuration

```env
# Badge polling
BADGE_POLL_ENABLED=true
BADGE_STALE_TIMEOUT_HOURS=16
BADGE_EVENT_RETENTION_DAYS=90

# Shift defaults
SHIFT_HANDOVER_MINUTES=30
SHIFT_EXTERNAL_SYNC_INTERVAL_SEC=3600
```

### Health Check

Badge source health is included in the API Gateway's health check response:

```json
{
  "badge_sources": [
    { "id": "main-gate-lenel", "type": "lenel", "enabled": true, "last_poll_ok": true, "events_last_poll": 12 },
    { "id": "building-b-ccure", "type": "ccure", "enabled": true, "last_poll_ok": true, "events_last_poll": 3 }
  ],
  "presence": {
    "on_site_count": 142,
    "stale_count": 2
  }
}
```

---

## Change Log

- **v0.4** — Fixed stale permission total: replaced "102 permissions across 14 modules" with pointer to doc 03 canonical count (118 across 15 modules).
- **v0.3** — Updated RBAC permission table: replaced "Power User"/"User" role names with canonical 8-role names (All roles, Supervisor, Admin). Added doc 03 cross-reference note.
- **v0.1** — Initial document. Shift management (patterns, crews, schedule builder, handover), badge integration (4 adapter types: Lenel OnGuard, CCURE 9000, Genetec Security Center, generic database), real-time presence tracking, emergency mustering, cross-module integration (Alerts, Console/Process, Dashboards, Reports, Forensics, Log, Rounds, Settings), custom alert groups, 10 database tables, full API specification, 8 RBAC permissions, WebSocket presence topics.
- **v0.2** — Expanded BadgeEventType from 3 to 8 values (added DoorForced, DoorHeldOpen, Duress, PassbackViolation, Tailgate). Added Honeywell Pro-Watch and Gallagher Command Centre adapter types (now 6 total). Added event_code_mapping config to all adapters for vendor-specific event code translation.
