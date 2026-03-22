---
id: DD-28-004
title: Implement email_suppressions table and pre-send suppression check
unit: DD-28
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When a hard bounce occurs (5xx SMTP response, MS Graph permanent error, SES permanent bounce), the recipient address must be automatically added to a suppression list. Before every send attempt, the queue worker must check the suppression list and skip delivery to any suppressed address, logging it as `suppressed` in the delivery log. Admins must be able to view and remove suppressed addresses through a Settings UI backed by API endpoints.

## Spec Excerpt (verbatim)

> **Hard bounce detection**: When email delivery permanently fails (5xx SMTP response, Microsoft Graph permanent error, SES permanent bounce), the recipient address is automatically added to a suppression list.
>
> **Behavior**: Before sending any email, the queue worker checks the suppression list. If the recipient address is suppressed, delivery is skipped and logged as `suppressed` in the delivery log. Suppressed deliveries do not count against retry attempts.
>
> **Soft bounces**: After max retries are exhausted on a soft bounce (4xx SMTP response, temporary Graph API error), the message is marked `dead` but the address is NOT added to the suppression list.
> — 28_EMAIL_SERVICE.md, §Queue and Delivery / Bounce Handling

## Where to Look in the Codebase

Primary files:
- `migrations/20260314000028_email.up.sql` — `email_suppressions` table is absent; needs to be added (new migration file)
- `services/email-service/src/queue_worker.rs` — `process_one` at lines 29-154; no suppression check before `attempt_delivery`
- `services/email-service/src/handlers/email.rs` — no suppression list CRUD handlers
- `services/email-service/src/main.rs` — no suppression routes in router

## Verification Checklist

- [ ] Migration file creates `email_suppressions` table with columns matching spec DDL: `id`, `email_address`, `reason`, `suppressed_at`, `created_by_delivery_id`
- [ ] `email_suppressions` has `UNIQUE` index on `email_address`
- [ ] `queue_worker.rs`: before calling `attempt_delivery`, queries `email_suppressions` for each recipient in `to_addresses`; skips suppressed addresses
- [ ] Suppressed deliveries are logged as `suppressed` status in `email_delivery_log` and do NOT increment `attempts`
- [ ] On 5xx/permanent delivery failure, queue worker inserts recipient into `email_suppressions`
- [ ] `GET /api/email/suppressions` and `DELETE /api/email/suppressions/:id` endpoints exist in router

## Assessment

- **Status**: ❌ Missing — `email_suppressions` table does not exist in any migration; no suppression check in `queue_worker.rs:29-74`; no suppression routes

## Fix Instructions

1. Create `migrations/20260314000028b_email_suppressions.up.sql` (or the next available migration number) with:
   ```sql
   CREATE TABLE email_suppressions (
       id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       email_address          VARCHAR(254) NOT NULL UNIQUE,
       reason                 TEXT NOT NULL,
       suppressed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
       created_by_delivery_id UUID REFERENCES email_delivery_log(id)
   );
   CREATE INDEX idx_email_suppressions_address ON email_suppressions (email_address);
   ```

2. In `queue_worker.rs`, in `process_one` before the `attempt_delivery` call:
   - Query: `SELECT email_address FROM email_suppressions WHERE email_address = ANY($1)` with `to_addresses`
   - If any recipients are suppressed: log each suppressed recipient in `email_delivery_log` with `status = 'suppressed'`, skip `attempt_delivery`, mark queue item as `sent` (not retry), return early

3. In `attempt_delivery` error handling, distinguish hard vs soft bounce:
   - SMTP: 5xx response code = hard bounce; 4xx = soft bounce
   - On hard bounce: INSERT into `email_suppressions` for the affected address, return a typed `EmailError::HardBounce` variant

4. Add suppression list handlers in `handlers/email.rs`:
   - `list_suppressions(State, Query<PaginationParams>)` — paginated SELECT from `email_suppressions`
   - `delete_suppression(State, Path<Uuid>)` — DELETE by id

5. Add routes in `main.rs`:
   ```rust
   .route("/suppressions", get(handlers::email::list_suppressions))
   .route("/suppressions/:id", delete(handlers::email::delete_suppression))
   ```

Do NOT:
- Add suppressed addresses to the suppression list for soft bounces (4xx)
- Count suppressed deliveries against retry attempts
- Delete the entire queue item when recipients are suppressed — log the skip and proceed
