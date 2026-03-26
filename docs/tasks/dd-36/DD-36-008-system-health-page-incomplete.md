---
id: DD-36-008
title: Implement full 6-tab System Health page and shell status dot popover
unit: DD-36
status: pending
priority: medium
depends-on: [DD-36-004]
---

## What This Feature Should Do

The Settings > System Health page should have six tabs (Services, Database, OPC Sources, WebSocket, Jobs, Metrics) showing live operational data from service health endpoints and the `io_metrics` schema. The shell status dot (sidebar footer) should have a popover showing WS connection state, OPC data freshness, and server reachability, with a pulse animation on state transitions and an "Open System Health" link for `system:monitor` users.

## Spec Excerpt (verbatim)

> ### Settings > System Health (Admin Only)
> Full system health page in the Settings module, available to users with `system:monitor` permission. Provides deep operational visibility into all 11 services and supporting infrastructure.
>
> **Services Tab**: Service name, Status (Ready/Degraded/Not Ready/Unreachable), Uptime, Version, Response time (p50, p95), Request rate (req/s), Error rate (%), Last check. Auto-refreshes every 15 seconds.
>
> **Database Tab**: Connection pool utilization per service, active query count, migration version, disk usage, TimescaleDB compression stats, retention policy status, replication lag.
>
> **OPC Sources Tab**: Per-source detail — connection status, subscribed point count, update rate, last successful update, reconnection count, error history (last 10 errors).
>
> **WebSocket Tab**: Active connections, total subscriptions, message rate, backpressure events, queue depth histogram, connection duration distribution.
>
> **Jobs Tab**: Email (Pending/Sent/Failed/Retry), Alerts (Pending/Dispatched/Acknowledged/Escalated), Exports (Active/Queued/Completed/Failed), Imports (Running/Scheduled/Completed/Failed).
>
> **Metrics Tab**: Interactive uPlot time-series charts from `io_metrics.samples` — Request Rate, Latency (p95), Error Rate, WS Connections, OPC Update Rate, DB Pool Utilization. Time range selector: Last 1h/6h/24h/7d/30d. Uses raw samples for ≤24h, aggregates for >24h.
>
> ### Shell Status Indicator
> A small status dot in the top navigation bar. Green (all pass), Yellow (degraded), Red (WS disconnected >30s or all OPC offline), Gray (unknown). The dot pulses briefly on state transitions. Clicking opens a compact popover: WebSocket status, OPC Data status (N/M sources), Server reachability, Last update timestamp, "Open System Health" link (system:monitor only).
>
> — design-docs/36_OBSERVABILITY.md, §Shell Status Indicator, §Settings > System Health

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/settings/SystemHealth.tsx` — current implementation: Services table only, no tabs, shows only service status/count
- `frontend/src/shared/components/SystemHealthDot.tsx` — dot exists but is in sidebar footer (not top nav bar), polls `/api/health/services` only (no WS/OPC state), no popover, no pulse animation, no click handler
- `frontend/src/shared/layout/AppShell.tsx:687-701` — renders `SystemHealthDot` and `SystemHealthDotRow` in sidebar footer
- `frontend/src/shared/hooks/useWebSocket.ts` — WS connection state source for the dot's Connected/Reconnecting/Disconnected status

## Verification Checklist

- [ ] `SystemHealth.tsx` has tab navigation for Services, Database, OPC Sources, WebSocket, Jobs, Metrics
- [ ] Services tab shows all 8 spec columns (name, status, uptime, version, p50/p95, req/s, error %, last check) and auto-refreshes every 15s
- [ ] Metrics tab renders at least the six default uPlot charts with Last 1h/6h/24h/7d/30d selector
- [ ] Shell status dot has a click-to-open popover showing WS status, OPC data, server reachability, last update
- [ ] Shell status dot pulses (CSS animation) on state transition
- [ ] Popover "Open System Health" link is only shown to users with `system:monitor` permission
- [ ] Status dot uses Green/Yellow/Red/Gray color states per the spec conditions (not just healthy/unhealthy mapping)

## Assessment

- **Status**: ⚠️ Partial
- **If partial/missing**: `SystemHealth.tsx` (lines 1-121) implements Services tab only; no Database, OPC Sources, WebSocket, Jobs, or Metrics tabs exist. `SystemHealthDot.tsx` renders a colored dot in the sidebar footer with no click handler, popover, or pulse animation. Status logic only derives from service health API polling; WS connection state and OPC data freshness are not incorporated.

## Fix Instructions

**Phase 1 — Shell status dot popover (SystemHealthDot.tsx):**

1. Replace the non-interactive dot with a `*Dialog.Trigger` or `*Popover.Trigger` (Radix UI, MIT license). Import from `@radix-ui/react-popover`.
2. Popover content: three rows (WebSocket status, OPC Data, Server) derived from:
   - WS: subscribe to `useWebSocket` hook state (or `realtimeStore` if that's the source)
   - OPC: from point stale detection in the shadow cache / subscription state — use the worst-case stale ratio
   - Server: the existing `/api/health/services` ping
3. Add `"Last update: X seconds ago"` timestamp (track last non-stale message time).
4. Add "Open System Health" link visible only when user has `system:monitor` — check via `usePermissions()` or equivalent.
5. CSS pulse animation: add a keyframe for a brief box-shadow bloom on state change using a `key` prop or `useEffect`-triggered class toggle.

**Phase 2 — System Health page tabs:**

Wrap the existing Services table in a tab structure. Use Radix UI `Tabs` primitive:

```tsx
import * as Tabs from '@radix-ui/react-tabs'

// Tab list: Services | Database | OPC Sources | WebSocket | Jobs | Metrics
```

**Services tab** (exists — expand columns): hit `/api/health/services` for status and `io_metrics.samples` for uptime/version/latency metrics. Add API endpoint `GET /api/health/services/detail` that returns per-service readiness, version, and uptime from `/health/ready` endpoint polling.

**Database tab**: expose pool metrics from `io_metrics.samples` (query `io_db_pool_*` metrics per service). Add migration version and disk usage via a new `GET /api/health/database` endpoint that queries `pg_database_size`, `timescaledb_information.hypertables`, etc.

**OPC Sources tab**: query from existing `GET /api/opc/sources/stats` and extend it with error history from `point_sources` or a new OPC health endpoint.

**WebSocket tab**: query `io_ws_*` metrics from `io_metrics.samples` plus live count from data-broker's `/health/ready` response.

**Jobs tab**: aggregate from `io_email_*`, `io_alert_*`, `io_import_*` metrics in `io_metrics.samples` for last 24h.

**Metrics tab**: render uPlot charts (the same component used in Dashboards, per doc 32) querying `GET /api/metrics/samples` with time range and metric name parameters. Backend: add `GET /api/health/metrics?metric=io_http_requests_total&from=...&to=...` that queries `io_metrics.samples` (raw) or `io_metrics.samples_5m` (>24h range).

Do NOT hardcode metric values or use mock data in the charts — the Metrics tab must query `io_metrics.samples` to be useful. Implement DD-36-004 first so the table has data.
