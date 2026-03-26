---
id: DD-18-012
title: Set Gorilla compression algorithm on points_history_raw
unit: DD-18
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The `points_history_raw` compression settings should explicitly use the Gorilla algorithm, which is optimised for floating-point time-series data. The current migration enables compression with `compress_segmentby` and `compress_orderby` but omits the `compress_algorithm` option, leaving TimescaleDB to choose a default rather than applying the spec-required Gorilla algorithm.

## Spec Excerpt (verbatim)

> ### Compression Settings
> - Segment by: point_id
> - Order by: timestamp
> - Compression algorithm: Gorilla (optimized for time-series)
> — design-docs/18_TIMESERIES_DATA.md, §Compression Settings

## Where to Look in the Codebase

Primary files:
- `migrations/20260314000032_retention_policies.up.sql:5–8` — `ALTER TABLE points_history_raw SET (timescaledb.compress, ...)` — `timescaledb.compress_algorithm` is absent
- `migrations/20260314000032_retention_policies.down.sql` — corresponding down migration

## Verification Checklist

- [ ] A migration `ALTER TABLE points_history_raw SET (...)` includes `timescaledb.compress_algorithm = 'gorilla'`
- [ ] The down migration disables compression cleanly (`timescaledb.compress = false`)

## Assessment

- **Status**: ❌ Missing
- **If missing**: `migrations/20260314000032_retention_policies.up.sql:5–8` sets `timescaledb.compress`, `compress_orderby`, and `compress_segmentby` but not `compress_algorithm`. TimescaleDB defaults to its own choice (LZ4 or ZSTD depending on version) rather than Gorilla.

## Fix Instructions

1. Write a new migration file (next sequence number after `20260322000003`) to alter the compression settings on `points_history_raw`:
   ```sql
   -- no-transaction
   ALTER TABLE points_history_raw SET (
       timescaledb.compress_algorithm = 'gorilla'
   );
   ```
   Do not re-set the already-correct `compress_segmentby` and `compress_orderby` in the same ALTER — that would require decompressing all chunks first. Set only `compress_algorithm`.

2. The down migration should reset the algorithm to empty/default:
   ```sql
   -- no-transaction
   ALTER TABLE points_history_raw RESET (timescaledb.compress_algorithm);
   ```

Do NOT:
- Edit `20260314000032_retention_policies.up.sql` directly — applied migrations must not be modified
- Include `timescaledb.compress = true` in the new migration — the compression is already enabled
