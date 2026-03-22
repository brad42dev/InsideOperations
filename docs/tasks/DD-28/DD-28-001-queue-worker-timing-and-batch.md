---
id: DD-28-001
title: Fix queue worker poll interval (10s→1s) and batch size (3→10)
unit: DD-28
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The queue background worker should poll the `email_queue` table every 1 second for pending messages and process up to 10 messages per polling cycle. These values must be configurable through environment variables.

## Spec Excerpt (verbatim)

> **Queue worker loop** (Tokio task, runs within the Email Service):
> 1. Poll `email_queue` every 1 second for pending messages
> 2. Dequeue a batch of up to 10 messages using `SELECT ... FOR UPDATE SKIP LOCKED`
> — 28_EMAIL_SERVICE.md, §Queue and Delivery / Queue Processing

> ```env
> EMAIL_QUEUE_WORKERS=4
> EMAIL_QUEUE_POLL_INTERVAL_MS=1000
> EMAIL_QUEUE_RETRY_MAX=4
> EMAIL_QUEUE_RETENTION_DAYS=30
> ```
> — 28_EMAIL_SERVICE.md, §Deployment / Service Configuration

## Where to Look in the Codebase

Primary files:
- `services/email-service/src/queue_worker.rs` — `run_queue_worker` loop at line 8-15; `process_batch` at line 17-26; hardcoded values are at lines 10 and 19
- `services/email-service/src/config.rs` — `Config` struct missing `queue_workers`, `poll_interval_ms`, `retry_max`, `retention_days` fields

## Verification Checklist

- [ ] `queue_worker.rs`: sleep duration reads from config (default 1000ms), not hardcoded 10s
- [ ] `queue_worker.rs`: `process_batch` processes up to 10 items per cycle, not 3
- [ ] `config.rs`: `Config` struct has `queue_poll_interval_ms: u64`, `queue_workers: usize`, `queue_retry_max: u8`, `queue_retention_days: u32` fields
- [ ] `config.rs`: `from_env()` reads `EMAIL_QUEUE_POLL_INTERVAL_MS` (default 1000), `EMAIL_QUEUE_WORKERS` (default 4), `EMAIL_QUEUE_RETRY_MAX` (default 4), `EMAIL_QUEUE_RETENTION_DAYS` (default 30)
- [ ] `main.rs`: `AppState` carries the config and passes it through to the worker

## Assessment

- **Status**: ⚠️ Partial — structure exists but wrong values hardcoded; config vars entirely absent

## Fix Instructions

1. In `config.rs`, add fields to `Config`:
   ```rust
   pub queue_poll_interval_ms: u64,
   pub queue_workers: usize,
   pub queue_retry_max: u8,
   pub queue_retention_days: u32,
   ```
   In `from_env()`, read them:
   ```rust
   queue_poll_interval_ms: std::env::var("EMAIL_QUEUE_POLL_INTERVAL_MS").unwrap_or_else(|_| "1000".to_string()).parse().unwrap_or(1000),
   queue_workers: std::env::var("EMAIL_QUEUE_WORKERS").unwrap_or_else(|_| "4".to_string()).parse().unwrap_or(4),
   queue_retry_max: std::env::var("EMAIL_QUEUE_RETRY_MAX").unwrap_or_else(|_| "4".to_string()).parse().unwrap_or(4),
   queue_retention_days: std::env::var("EMAIL_QUEUE_RETENTION_DAYS").unwrap_or_else(|_| "30".to_string()).parse().unwrap_or(30),
   ```

2. In `queue_worker.rs`:
   - Pass config into `run_queue_worker` (or accept `poll_interval_ms` as parameter)
   - Change line 10: `tokio::time::sleep(tokio::time::Duration::from_millis(state.config.queue_poll_interval_ms)).await;`
   - Change `process_batch` to loop up to `state.config.queue_workers` (or 10 if batch size is decoupled from worker count)

3. The spec says "configurable worker count (default: 4). Each worker independently dequeues." — this implies spawning multiple concurrent Tokio tasks (each polling independently) rather than a single task processing N items serially. If implementing concurrent workers, spawn `queue_workers` tasks in `main.rs`, each running `run_queue_worker`.

Do NOT:
- Keep any hardcoded sleep duration or batch cap in the worker function
- Remove the `SKIP LOCKED` clause from the SQL query
