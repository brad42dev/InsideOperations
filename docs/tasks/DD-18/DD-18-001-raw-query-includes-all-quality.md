---
id: DD-18-001
title: Remove quality filter from raw resolution queries
unit: DD-18
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

When a client requests `resolution=raw`, the archive service must return data at all quality levels (Good, Bad, Uncertain). The raw table is the forensic record — callers like the Forensics module need Bad and Uncertain readings to diagnose process events. Quality filtering only belongs at the aggregate layer.

## Spec Excerpt (verbatim)

> "All raw values are stored regardless of quality (preserves full history)"
> "Raw data retains all quality levels for forensic analysis"
> — 18_TIMESERIES_DATA.md, §Hypertable Design / §Write Performance

## Where to Look in the Codebase

Primary files:
- `services/archive-service/src/handlers/history.rs` — contains both the single-point (line 143–155) and batch (line 367–378) raw queries, both of which incorrectly apply `AND quality = 'Good'`

## Verification Checklist

- [ ] The raw query at history.rs:143–155 does NOT contain `AND quality = 'Good'`
- [ ] The batch raw query at history.rs:367–378 does NOT contain `AND quality = 'Good'`
- [ ] The `HistoryRow` struct retains the `quality` field (it does — keep it)
- [ ] Raw results include rows where `quality` is `Bad` or `Uncertain`

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: Both the single-point and batch raw queries add `AND quality = 'Good'` to the WHERE clause (history.rs:146 and 370). This silently drops all Bad and Uncertain readings from forensic queries.

## Fix Instructions (if needed)

In `services/archive-service/src/handlers/history.rs`:

1. At line 143–155, change the raw query from:
   ```
   WHERE point_id = $1 AND timestamp BETWEEN $2 AND $3 AND quality = 'Good'
   ```
   to:
   ```
   WHERE point_id = $1 AND timestamp BETWEEN $2 AND $3
   ```

2. At line 367–378, apply the same change to the batch raw query.

3. The `quality` field in `HistoryRow` is already present (`pub quality: Option<String>`) — no struct changes needed.

Do NOT:
- Remove the quality filter from aggregate queries (1m, 5m, 1h, 15m, 1d) — those correctly filter to Good only
- Add an optional `quality_filter` parameter to the API at this time — not in spec
