---
id: DD-18-014
title: Add service-secret guard to archive settings endpoints
unit: DD-18
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The `GET /settings` and `PUT /settings` endpoints in the archive service must verify the `x-io-service-secret` header before responding, matching the pattern used by every history endpoint in the same service. Without this guard, any caller that can reach the archive service port can read or modify retention and compression configuration without authentication.

## Spec Excerpt (verbatim)

> `x-io-service-secret` header for inter-service auth
> — design-docs/21_API_DESIGN.md, §inter-service auth

> **Security:** 118 RBAC permissions … Every API endpoint must enforce RBAC. Audit log every state-changing operation.
> — CLAUDE.md §3 Architecture

## Where to Look in the Codebase

Primary files:
- `services/archive-service/src/handlers/settings.rs:41–91` — `get_settings` handler; no `check_service_secret` call
- `services/archive-service/src/handlers/settings.rs:97–157` — `put_settings` handler; no `check_service_secret` call
- `services/archive-service/src/handlers/history.rs:22–32` — `check_service_secret` helper (already correct pattern)
- `services/archive-service/src/state.rs` — `AppState` struct (verify `config.service_secret` is accessible)

## Verification Checklist

- [ ] `get_settings` calls `check_service_secret(&headers, &state.config.service_secret)?` as its first statement
- [ ] `get_settings` signature accepts `headers: HeaderMap` as a parameter
- [ ] `put_settings` calls `check_service_secret(&headers, &state.config.service_secret)?` as its first statement
- [ ] `put_settings` signature accepts `headers: HeaderMap` as a parameter

## Assessment

- **Status**: ❌ Missing
- **If missing**: `handlers/settings.rs:41` and `handlers/settings.rs:97` — neither handler has a `HeaderMap` parameter or a `check_service_secret` call. Every handler in `handlers/history.rs` has this check.

## Fix Instructions

1. In `services/archive-service/src/handlers/settings.rs`, add `HeaderMap` to both handler signatures and call `check_service_secret` at the top of each:

   For `get_settings`:
   ```rust
   pub async fn get_settings(
       State(state): State<AppState>,
       headers: HeaderMap,
   ) -> IoResult<Json<ApiResponse<ArchiveSettingsPayload>>> {
       check_service_secret(&headers, &state.config.service_secret)?;
       // ... rest of handler unchanged
   ```

   For `put_settings`:
   ```rust
   pub async fn put_settings(
       State(state): State<AppState>,
       headers: HeaderMap,
       Json(body): Json<ArchiveSettingsPayload>,
   ) -> IoResult<Json<ApiResponse<ArchiveSettingsPayload>>> {
       check_service_secret(&headers, &state.config.service_secret)?;
       // ... rest of handler unchanged
   ```

2. Add the necessary imports at the top of `handlers/settings.rs`:
   ```rust
   use axum::http::HeaderMap;
   ```

3. Copy the `check_service_secret` function from `handlers/history.rs:22–32` into `handlers/settings.rs`, or move it to a shared module (e.g., `handlers/mod.rs`) and import from both.

Do NOT:
- Change the business logic of the settings GET/PUT
- Add RBAC or JWT checks — this is an internal service-to-service call using the shared secret
