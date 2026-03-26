---
id: DD-27-017
title: Fix list_channels crash — remove non-existent id/created_at columns from query
unit: DD-27
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

`GET /alerts/channels` must return all configured alert channels with their enabled status and masked config. Currently the handler selects `id` and `created_at` from `alert_channels`, but neither column exists on that table — the query will fail with a PostgreSQL "column does not exist" error on every request.

## Spec Excerpt (verbatim)

> ```sql
> CREATE TABLE alert_channels (
>     channel_type    VARCHAR(30) PRIMARY KEY,
>     display_name    VARCHAR(100) NOT NULL,
>     enabled         BOOLEAN NOT NULL DEFAULT false,
>     config          JSONB NOT NULL DEFAULT '{}',
>     last_tested_at  TIMESTAMPTZ,
>     last_test_ok    BOOLEAN,
>     last_test_error TEXT,
>     updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
>     updated_by      UUID REFERENCES users(id)
> );
> ```
> — design-docs/27_ALERT_SYSTEM.md, §Database Schema

## Where to Look in the Codebase

Primary files:
- `services/alert-service/src/handlers/channel_config.rs:67-75` — `AlertChannel_` struct has `id: Uuid` and `created_at: DateTime<Utc>` which do not map to any schema column
- `services/alert-service/src/handlers/channel_config.rs:96-99` — `SELECT id, channel_type, display_name, enabled, config, created_at, updated_at FROM alert_channels` — selects non-existent `id` and `created_at`
- `migrations/20260314000027_alerting.up.sql:89-99` — authoritative schema: `channel_type` is PK, no `id`, no `created_at`

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `AlertChannel_` struct has no `id` or `created_at` fields
- [ ] `list_channels` query selects only columns that exist: `channel_type, display_name, enabled, config, updated_at` (and optionally `last_tested_at, last_test_ok, last_test_error`)
- [ ] `sqlx::FromRow` derive on `AlertChannel_` maps `channel_type` correctly (it is the PK identifier, not a separate `id`)
- [ ] `list_channels` returns HTTP 200 with channel list

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `AlertChannel_` struct and SELECT query reference `id` (UUID PK) and `created_at` that don't exist on the `alert_channels` table. Every call to `GET /alerts/channels` will fail with a DB error.

## Fix Instructions (if needed)

In `services/alert-service/src/handlers/channel_config.rs`:

1. Remove `id: Uuid` and `created_at: DateTime<Utc>` from the `AlertChannel_` struct (lines 67-75). The struct should be:
```rust
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AlertChannel_ {
    pub channel_type: String,
    pub display_name: String,
    pub enabled: bool,
    pub config: Option<serde_json::Value>,
    pub last_tested_at: Option<DateTime<Utc>>,
    pub last_test_ok: Option<bool>,
    pub last_test_error: Option<String>,
    pub updated_at: DateTime<Utc>,
}
```

2. Fix the `list_channels` query (lines 96-99) to select only existing columns:
```rust
let rows = sqlx::query_as::<_, AlertChannel_>(
    "SELECT channel_type, display_name, enabled, config,
            last_tested_at, last_test_ok, last_test_error, updated_at
     FROM alert_channels
     ORDER BY channel_type",
)
```

3. If any downstream code references `ch.id` or `ch.created_at`, remove those references.

Do NOT:
- Add an `id` column to the migration — `channel_type` is the PK
- Add a `created_at` column to the migration — the schema doesn't need it
- Change the primary key semantics
