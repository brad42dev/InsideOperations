---
id: DD-18-003
title: Add 15m and 1d aggregate retention and refresh to maintenance loop
unit: DD-18
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The maintenance background loop must manage all five aggregate tiers. Currently it only handles 1m, 5m, and 1h. The 15-minute aggregate must be retained for 3 years (1095 days) and the 1-day aggregate for 7 years (2555 days). Both must also be refreshed on each maintenance cycle.

## Spec Excerpt (verbatim)

> "Keep 15-minute aggregates for 3 years"
> "Keep 1-day aggregates for 7 years (regulatory compliance)"
> — 18_TIMESERIES_DATA.md, §Aggregate Retention

## Where to Look in the Codebase

Primary files:
- `services/archive-service/src/config.rs` — retention fields (lines 1–18); missing `retention_15m_days` and `retention_1d_days`
- `services/archive-service/src/maintenance.rs` — `agg_retentions` array (lines 76–79) and `aggregates` refresh array (lines 111–133)

## Verification Checklist

- [ ] `Config` struct has `retention_15m_days` field defaulting to 1095
- [ ] `Config` struct has `retention_1d_days` field defaulting to 2555
- [ ] `agg_retentions` in maintenance.rs includes `("points_history_15m", config.retention_15m_days)` and `("points_history_1d", config.retention_1d_days)`
- [ ] `aggregates` refresh array in maintenance.rs includes `"points_history_15m"` and `"points_history_1d"`

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `config.rs` has no `retention_15m_days` or `retention_1d_days` fields. `maintenance.rs:76–79` lists only 1m/5m/1h for retention sweeps. `maintenance.rs:111` lists only 1m/5m/1h for refreshes.

## Fix Instructions (if needed)

**1. In `services/archive-service/src/config.rs`:**

Add two fields to the `Config` struct after line 14:
```rust
/// 15-minute aggregate retention in days (default 1095 — 3 years).
pub retention_15m_days: i64,
/// 1-day aggregate retention in days (default 2555 — 7 years).
pub retention_1d_days: i64,
```

In `from_env()` after `retention_1h_days`, add:
```rust
retention_15m_days: std::env::var("RETENTION_15M_DAYS")
    .unwrap_or_else(|_| "1095".to_string())
    .parse()?,
retention_1d_days: std::env::var("RETENTION_1D_DAYS")
    .unwrap_or_else(|_| "2555".to_string())
    .parse()?,
```

**2. In `services/archive-service/src/maintenance.rs`:**

At line 76–79, expand `agg_retentions` to:
```rust
let agg_retentions = [
    ("points_history_1m", config.retention_1m_days),
    ("points_history_5m", config.retention_5m_days),
    ("points_history_15m", config.retention_15m_days),
    ("points_history_1h", config.retention_1h_days),
    ("points_history_1d", config.retention_1d_days),
];
```

At line 111, expand `aggregates` to:
```rust
let aggregates = [
    "points_history_1m",
    "points_history_5m",
    "points_history_15m",
    "points_history_1h",
    "points_history_1d",
];
```

Do NOT:
- Change the refresh SQL — `CALL refresh_continuous_aggregate($1, NULL, NOW() - INTERVAL '1 minute')` is correct for all tiers
- Remove the existing 1m/5m/1h entries
