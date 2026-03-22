---
id: DD-27-001
title: Align alert-service schema with spec (alerts table, correct columns)
unit: DD-27
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The alert-service stores alert instances in the database. The spec defines a table named `alerts` with specific columns. The current implementation queries a table named `alert_instances` with a different column layout (`body` instead of `message`, no `template_id`, no `roster_id`, no `channels_used`, no `metadata`). The schema must match the spec so downstream features (templates, rosters, channel tracking) can be built on a stable foundation.

## Spec Excerpt (verbatim)

> ```sql
> CREATE TABLE alerts (
>     id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
>     template_id         UUID REFERENCES alert_templates(id),
>     severity            alert_severity NOT NULL,
>     status              alert_status NOT NULL DEFAULT 'active',
>     title               VARCHAR(500) NOT NULL,
>     message             TEXT NOT NULL,
>     source              VARCHAR(100) NOT NULL,
>     source_reference_id UUID,
>     roster_id           UUID REFERENCES alert_rosters(id),
>     escalation_policy   JSONB,
>     current_escalation  SMALLINT NOT NULL DEFAULT 0,
>     channels_used       TEXT[] NOT NULL,
>     triggered_by        UUID REFERENCES users(id),
>     triggered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
>     acknowledged_by     UUID REFERENCES users(id),
>     acknowledged_at     TIMESTAMPTZ,
>     resolved_by         UUID REFERENCES users(id),
>     resolved_at         TIMESTAMPTZ,
>     cancelled_by        UUID REFERENCES users(id),
>     cancelled_at        TIMESTAMPTZ,
>     metadata            JSONB
> );
> ```
> — design-docs/27_ALERT_SYSTEM.md, §Database Schema

## Where to Look in the Codebase

Primary files:
- `services/alert-service/src/handlers/alerts.rs` — `AlertInstance` struct (line 19-36) and all SQL queries use `alert_instances` table
- `services/alert-service/src/handlers/escalation.rs` — `record_delivery` inserts into `alert_deliveries` (line 347-367); `dispatch_email` queries `users` table directly

## Verification Checklist

- [ ] `AlertInstance` struct has fields matching spec: `message` (not `body`), `template_id`, `roster_id`, `channels_used`, `metadata`, `triggered_by`, `triggered_at`, `cancelled_by`, `cancelled_at`
- [ ] All SQL queries in `alerts.rs` reference `alerts` table (not `alert_instances`)
- [ ] `TriggerAlertBody` accepts `template_id`, `template_variables`, `roster_id`, `channels`, `source` as per spec trigger request schema
- [ ] `alert_deliveries` schema matches spec: `recipient_name`, `recipient_contact`, `escalation_level` columns present

## Assessment

- **Status**: ⚠️ Partial — table exists under wrong name, columns wrong, struct does not match spec

## Fix Instructions (if needed)

1. Write a database migration that renames `alert_instances` to `alerts` (or creates the `alerts` table if it does not exist in migrations) with the full column set from the spec. Add `alert_status` and `alert_severity` PostgreSQL enum types if not present.

2. In `services/alert-service/src/handlers/alerts.rs`:
   - Update `AlertInstance` struct: rename `body` to `message`, add `template_id: Option<Uuid>`, `roster_id: Option<Uuid>`, `channels_used: Vec<String>`, `metadata: Option<serde_json::Value>`, `triggered_by: Option<Uuid>`, `triggered_at: DateTime<Utc>`, `cancelled_by: Option<Uuid>`, `cancelled_at: Option<DateTime<Utc>>`
   - Update `TriggerAlertBody` to accept: `template_id: Option<Uuid>`, `template_variables: Option<serde_json::Value>`, `roster_id: Option<Uuid>`, `channels: Option<Vec<String>>`, `source: Option<String>`, `source_reference_id: Option<Uuid>` — in addition to `title`, `severity`, and `message`
   - Update all SQL query strings to use `alerts` instead of `alert_instances`

3. Update `alert_deliveries` schema: add `recipient_name VARCHAR(200)`, `recipient_contact VARCHAR(300)`, `escalation_level SMALLINT NOT NULL DEFAULT 0`, `delivered_at TIMESTAMPTZ`, `acknowledged_at TIMESTAMPTZ`, `external_id VARCHAR(200)` columns.

4. Update `record_delivery` in `escalation.rs` (line 335-368) to bind the new columns.

Do NOT:
- Drop and recreate the table if data exists — use ALTER TABLE or a migration
- Change the `alert_deliveries` table name — that matches the spec
- Mix up the `status` enum values: spec uses `active`, `acknowledged`, `resolved`, `cancelled`
