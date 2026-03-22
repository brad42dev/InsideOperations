---
id: DD-26-004
title: Widen correction_type column from VARCHAR(20) to VARCHAR(30)
unit: DD-26
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The `recognition_correction` table stores user corrections to recognition predictions. The `correction_type` column must hold values including `state_misclassification` (22 characters) and `line_misclassification` (21 characters), which are DCS-specific correction types. The current `VARCHAR(20)` column would silently truncate these values at the database level, corrupting correction records.

## Spec Excerpt (verbatim)

> correction_type VARCHAR(30) NOT NULL,  -- 'reclassify', 'false_positive', 'missed_detection', 'bbox_adjust',
>                                        -- 'state_misclassification', 'line_misclassification'
> — design-docs/26_PID_RECOGNITION.md, §Storage

## Where to Look in the Codebase

Primary files:
- `migrations/20260314000029_recognition.up.sql:8` — `correction_type VARCHAR(20) NOT NULL`
- `migrations/20260314000029_recognition.down.sql` — verify the down migration drops the table

## Verification Checklist

- [ ] `correction_type` column defined as `VARCHAR(30)` in the up migration
- [ ] `state_misclassification` (22 chars) fits without truncation: `22 <= 30` ✓
- [ ] `line_misclassification` (21 chars) fits: `21 <= 30` ✓
- [ ] A new numbered migration file adds the column alteration (do not modify the original migration if it has already been applied)

## Assessment

- **Status**: ⚠️ Wrong — column is `VARCHAR(20)`, spec requires `VARCHAR(30)`

## Fix Instructions

If the migration `20260314000029_recognition.up.sql` has not yet been applied to any environment, edit the column definition directly:

- In `migrations/20260314000029_recognition.up.sql` line 8, change `VARCHAR(20)` to `VARCHAR(30)`.

If the migration has already been applied (check `_sqlx_migrations` table), create a new migration file:

```
migrations/20260315000046_widen_correction_type.up.sql
```

```sql
ALTER TABLE recognition_correction
  ALTER COLUMN correction_type TYPE VARCHAR(30);
```

And a corresponding down migration:

```sql
ALTER TABLE recognition_correction
  ALTER COLUMN correction_type TYPE VARCHAR(20);
```

Do NOT:
- Change the constraint to `TEXT` — the spec specifies `VARCHAR(30)` and the bounded length is intentional
- Edit a migration that has already been applied on the demo server without creating a compensating migration
