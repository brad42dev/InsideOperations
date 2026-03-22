---
id: DD-30-001
title: Implement badge polling engine with BadgeAdapter trait and background task
unit: DD-30
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The API Gateway must run a background Tokio task that periodically polls each configured badge source (in `access_control_sources`) for new badge events. Each supported access control system has a vendor-specific adapter implementing a common `BadgeAdapter` trait. The engine reads events, deduplicates them, maps them to I/O users via `employee_id`, inserts into `badge_events`, and updates the `presence_status` table. After 5 consecutive adapter failures it fires a WARNING alert.

## Spec Excerpt (verbatim)

> The API Gateway runs a background Tokio task that polls each configured badge source at its configured interval.
>
> **Default polling interval**: 30 seconds (configurable per source, range: 10s–300s).
>
> **Polling flow**:
> 1. Read `last_poll_checkpoint` from `access_control_sources` table
> 2. Call `adapter.poll_events(since: checkpoint)`
> 3. For each returned event:
>    a. Deduplicate by `external_event_id` (skip if already in `badge_events`)
>    b. Map `employee_id` or `badge_id` to I/O user via `users.employee_id` mapping field
>    c. Insert into `badge_events` table
>    d. Update `presence_status` table (set on-site/off-site based on event type)
> 4. Update `last_poll_checkpoint` to the most recent event timestamp
> 5. On adapter error: log warning, retry on next poll cycle, increment `consecutive_failures` counter. After 5 consecutive failures, fire a WARNING alert via the Alert Service.
> — 30_ACCESS_CONTROL_SHIFTS.md, §Polling Engine

> ```rust
> #[async_trait]
> pub trait BadgeAdapter: Send + Sync {
>     fn adapter_type(&self) -> BadgeAdapterType;
>     fn display_name(&self) -> &str;
>     async fn poll_events(&self, since: DateTime<Utc>) -> Result<Vec<BadgeEvent>, BadgeAdapterError>;
>     async fn lookup_person(&self, identifier: &str) -> Result<Option<ExternalPerson>, BadgeAdapterError>;
>     async fn health_check(&self) -> Result<(), BadgeAdapterError>;
> }
> ```
> — 30_ACCESS_CONTROL_SHIFTS.md, §Adapter Pattern

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/handlers/shifts.rs` — badge source CRUD exists; polling engine must be added here or in a sibling module
- `services/api-gateway/src/main.rs` — background task must be spawned here at startup
- `services/api-gateway/src/state.rs` — `AppState` may need a polling task handle

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `BadgeAdapter` async trait exists with `poll_events`, `lookup_person`, `health_check` methods
- [ ] At least one adapter implementation exists (e.g., `GenericDbAdapter` or a stub `NoOpAdapter`)
- [ ] Background Tokio task is spawned in `main.rs` or equivalent startup code
- [ ] Polling loop reads enabled sources from `access_control_sources`, calls adapter, deduplicates by `external_event_id`
- [ ] `presence_status` table is updated on SwipeIn/SwipeOut events
- [ ] `consecutive_failures` counter increments on adapter error; WARNING emitted after 5 failures
- [ ] `last_poll_checkpoint` updated after each successful poll

## Assessment

- **Status**: ❌ Missing
- No `BadgeAdapter` trait defined anywhere in the codebase. The `access_control_sources` table CRUD is implemented but the engine that actually reads from those sources does not exist. Presence data can only be populated manually or via the mobile endpoint.

## Fix Instructions

1. Create `services/api-gateway/src/badge/mod.rs` (new module) with:
   - `BadgeAdapterType` enum (Lenel, CCure, Genetec, Honeywell, Gallagher, GenericDatabase)
   - `BadgeEvent` struct (matching design doc §Adapter Pattern)
   - `BadgeEventType` enum (SwipeIn, SwipeOut, AccessDenied, DoorForced, DoorHeldOpen, Duress, PassbackViolation, Tailgate)
   - `BadgeAdapter` async trait (use `#[async_trait::async_trait]`)
   - `BadgeAdapterError` enum

2. Create at minimum a `GenericDatabaseAdapter` (or a stub `NoOpAdapter` for scaffolding) in `services/api-gateway/src/badge/generic.rs`.

3. Create `services/api-gateway/src/badge/poller.rs` with a `run_badge_poller(db: PgPool)` async function that:
   - Fetches all enabled sources from `access_control_sources`
   - For each source, spawns a per-source polling loop using `tokio::time::interval`
   - Deduplicates using `INSERT ... ON CONFLICT (source_id, external_event_id) DO NOTHING`
   - Updates `presence_status` (upsert on `badge_id`): `is_on_site = true` on SwipeIn, `is_on_site = false` on SwipeOut
   - Increments `consecutive_failures` and fires alert after 5 failures

4. In `services/api-gateway/src/main.rs`, after the database pool is initialized, call:
   `tokio::spawn(badge::poller::run_badge_poller(db.clone()));`

Do NOT:
- Implement all 6 vendor adapters in the first pass — a `GenericDatabaseAdapter` stub that panics on `poll_events` is sufficient to scaffold the architecture
- Block the main request-serving loop — the poller must run in its own spawned task
- Skip the deduplication index — `idx_badge_events_dedup` on `(source_id, external_event_id)` must be in the migration before inserting events
