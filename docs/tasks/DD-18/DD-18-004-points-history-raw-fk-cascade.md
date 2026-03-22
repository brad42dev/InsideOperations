---
id: DD-18-004
title: Change points_history_raw FK to ON DELETE CASCADE
unit: DD-18
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The `points_history_raw` table's foreign key on `point_id` must cascade deletes from `points_metadata`. When a point is deleted (which is normally prevented by the `prevent_point_deletion` trigger, but may occur during hard-delete administrative operations), its history rows should be automatically removed rather than blocking the delete with a FK violation.

## Spec Excerpt (verbatim)

> "point_id UUID NOT NULL REFERENCES points_metadata(id) ON DELETE CASCADE"
> — 18_TIMESERIES_DATA.md, §Hypertable Design (DDL listing for points_history_raw)

## Where to Look in the Codebase

Primary files:
- `migrations/20260314000011_points_data.up.sql` — line 80: `point_id UUID NOT NULL REFERENCES points_metadata(id) ON DELETE RESTRICT`

## Verification Checklist

- [ ] The FK constraint on `points_history_raw.point_id` specifies `ON DELETE CASCADE`
- [ ] A corrective migration exists (new file, not editing the original) that drops the RESTRICT constraint and re-adds CASCADE

## Assessment

- **Status**: ❌ Wrong
- **If partial/missing**: migrations/20260314000011_points_data.up.sql:80 uses `ON DELETE RESTRICT`. The spec DDL explicitly requires `ON DELETE CASCADE`. Note: the `prevent_point_deletion` trigger on `points_metadata` normally prevents hard deletes, so in practice this is rarely triggered. But the schema must match spec.

## Fix Instructions (if needed)

Create a new migration file (next available number, e.g. `migrations/20260321000046_fix_history_fk_cascade.up.sql`):

```sql
-- Fix points_history_raw FK: change ON DELETE RESTRICT to ON DELETE CASCADE
-- per design-doc 18_TIMESERIES_DATA.md

ALTER TABLE points_history_raw
    DROP CONSTRAINT IF EXISTS points_history_raw_point_id_fkey;

ALTER TABLE points_history_raw
    ADD CONSTRAINT points_history_raw_point_id_fkey
    FOREIGN KEY (point_id)
    REFERENCES points_metadata(id)
    ON DELETE CASCADE;
```

Create the corresponding down migration:
```sql
ALTER TABLE points_history_raw
    DROP CONSTRAINT IF EXISTS points_history_raw_point_id_fkey;

ALTER TABLE points_history_raw
    ADD CONSTRAINT points_history_raw_point_id_fkey
    FOREIGN KEY (point_id)
    REFERENCES points_metadata(id)
    ON DELETE RESTRICT;
```

Do NOT:
- Edit the original `20260314000011_points_data.up.sql` — migrations are immutable once applied
- Drop the constraint name if TimescaleDB added a different internal name — query `pg_constraint` first if the constraint name is uncertain
