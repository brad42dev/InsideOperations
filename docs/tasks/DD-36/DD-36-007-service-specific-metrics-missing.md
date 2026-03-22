---
id: DD-36-007
title: Implement missing service-specific metrics for OPC, Archive, Alert, Email, Auth, Recognition, Import, and Parser services
unit: DD-36
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Eight services are missing their spec-defined domain-specific metrics entirely. The Data Broker is missing `io_ws_backpressure_drops_total`. Without these metrics the System Health OPC Sources, Jobs, and Metrics tabs will have no data to display.

## Spec Excerpt (verbatim)

> Each service emits additional metrics relevant to its domain:
>
> OPC Service: `io_opc_sources_connected`, `io_opc_points_subscribed`, `io_opc_updates_received_total`, `io_opc_reconnections_total`
> Archive Service: `io_timeseries_inserts_total`, `io_compression_ratio`, `io_retention_rows_dropped_total`
> Alert Service: `io_alert_dispatched_total`, `io_alert_acknowledged_total`, `io_alert_escalated_total`
> Email Service: `io_email_queue_depth`, `io_email_sent_total`, `io_email_failures_total`
> Auth Service: `io_tokens_issued_total`, `io_mfa_challenges_total`
> Recognition Service: `io_recognition_inferences_total`, `io_recognition_duration_seconds`
> Import Service: `io_import_runs_total`, `io_import_errors_total`, `io_import_rows_processed_total`
> Parser Service: `io_imports_parsed_total`, `io_parse_duration_seconds`
> Data Broker: `io_ws_backpressure_drops_total`
>
> — design-docs/36_OBSERVABILITY.md, §Service-Specific Metrics

## Where to Look in the Codebase

Primary files:
- `services/data-broker/src/ws.rs` — has `io_ws_connections`, `io_ws_subscriptions`, `io_ws_messages_sent_total` but NOT `io_ws_backpressure_drops_total`
- `services/opc-service/src/` — no metrics calls found
- `services/archive-service/src/` — no metrics calls found
- `services/alert-service/src/` — no metrics calls found
- `services/email-service/src/` — no metrics calls found
- `services/auth-service/src/handlers/auth.rs:93-220` — `io_auth_logins_total` and `io_auth_failures_total` present; `io_active_sessions`, `io_tokens_issued_total`, `io_mfa_challenges_total` absent
- `services/auth-service/src/handlers/mfa.rs` — partial `io_alarms_acknowledged_total`-style, not token/MFA metrics
- `services/recognition-service/src/` — no metrics calls found
- `services/import-service/src/` — no metrics calls found
- `services/parser-service/src/` — no metrics calls found
- `services/event-service/src/alarm_evaluator.rs:340,350`, `handlers/alarms.rs:257` — `io_alarms_fired_total`, `io_alarms_resolved_total`, `io_alarms_acknowledged_total` present; `io_events_ingested_total`, `io_alarms_active` absent

## Verification Checklist

- [ ] `services/data-broker/src/` emits `io_ws_backpressure_drops_total` when a message is dropped due to slow client
- [ ] `services/opc-service/src/` emits all four OPC metrics (connected sources, subscribed points, updates received, reconnections)
- [ ] `services/archive-service/src/` emits `io_timeseries_inserts_total` on every hypertable batch insert
- [ ] `services/alert-service/src/` emits dispatched/acknowledged/escalated counters at appropriate points
- [ ] `services/auth-service/src/` emits `io_tokens_issued_total` in the token issuance path and `io_mfa_challenges_total` in MFA challenge handler
- [ ] `services/event-service/src/` emits `io_events_ingested_total` on event write and `io_alarms_active` gauge updated on alarm state changes

## Assessment

- **Status**: ⚠️ Partial
- **If partial/missing**: Data Broker has 3 of 4 spec metrics; `io_ws_backpressure_drops_total` is absent. Event Service has 3 custom metrics but missing `io_events_ingested_total` and `io_alarms_active`. Auth Service has login/failure counters but missing `io_active_sessions`, `io_tokens_issued_total`, `io_mfa_challenges_total`. All other services (OPC, Archive, Alert, Email, Recognition, Import, Parser) have zero service-specific metrics.

## Fix Instructions

For each service, add `metrics::counter!`, `metrics::gauge!`, or `metrics::histogram!` at the appropriate code point. The `metrics` crate is already a workspace dependency and available in all services.

**Data Broker — add to `services/data-broker/src/ws.rs`** wherever the fanout channel is full (backpressure drop):
```rust
// In the message fanout loop when channel is full:
metrics::counter!("io_ws_backpressure_drops_total").increment(1);
```

**OPC Service — add to `services/opc-service/src/`** at connection manager and subscription points:
```rust
// On connect/disconnect:
metrics::gauge!("io_opc_sources_connected").set(connected_count as f64);
// On subscription change:
metrics::gauge!("io_opc_points_subscribed").set(total_subscribed as f64);
// On update receipt:
metrics::counter!("io_opc_updates_received_total").increment(1);
// On reconnect attempt:
metrics::counter!("io_opc_reconnections_total").increment(1);
```

**Auth Service — add to `services/auth-service/src/handlers/auth.rs`** after token issuance:
```rust
metrics::counter!("io_tokens_issued_total", "type" => "access").increment(1);
```

Add to `services/auth-service/src/handlers/mfa.rs` challenge initiation:
```rust
metrics::counter!("io_mfa_challenges_total").increment(1);
```

**Event Service — add to event write path** for `io_events_ingested_total` and update `io_alarms_active` gauge in `alarm_evaluator.rs` after state changes.

Do NOT emit `io_alarms_active` as a counter — it must be a gauge that reflects the current count of active (non-resolved) alarms. Query the database or maintain an in-memory counter in the evaluator.
