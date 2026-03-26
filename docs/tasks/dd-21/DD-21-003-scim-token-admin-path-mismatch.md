---
id: DD-21-003
title: Fix SCIM token admin route path from /scim-tokens to /scim/tokens
unit: DD-21
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The SCIM token admin endpoints (list, create, revoke) must be served at `/api/auth/admin/scim/tokens` with a forward-slash between `scim` and `tokens`. The current implementation uses a hyphen (`/api/auth/admin/scim-tokens`), which does not match the API spec and will break any client or integration that follows the documented path.

## Spec Excerpt (verbatim)

> ### SCIM Token Admin
>
> | Method | Path | Permission | Description |
> |--------|------|------------|-------------|
> | GET | /api/auth/admin/scim/tokens | auth:configure | List SCIM tokens |
> | POST | /api/auth/admin/scim/tokens | auth:configure | Generate SCIM token (returns token once) |
> | DELETE | /api/auth/admin/scim/tokens/:id | auth:configure | Revoke SCIM token |
> — design-docs/21_API_DESIGN.md, §SCIM Token Admin

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/main.rs:542-543` — Current route registrations:
  ```rust
  .route("/api/auth/admin/scim-tokens", get(proxy_auth).post(proxy_auth))
  .route("/api/auth/admin/scim-tokens/:id", delete(proxy_auth))
  ```

## Verification Checklist

- [ ] Route at `main.rs` registers `"/api/auth/admin/scim/tokens"` (slash, not hyphen).
- [ ] Route at `main.rs` registers `"/api/auth/admin/scim/tokens/:id"` for DELETE.
- [ ] The auth-service downstream path receives the updated path correctly (verify `proxy_auth` strips `/api` prefix as expected).

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: Both SCIM token admin routes use `/api/auth/admin/scim-tokens` instead of `/api/auth/admin/scim/tokens`. The underlying proxy handler (`proxy_auth`) is otherwise correct — only the route paths need changing.

## Fix Instructions

In `services/api-gateway/src/main.rs`, lines 542-543, change:

```rust
// Before
.route("/api/auth/admin/scim-tokens", get(proxy_auth).post(proxy_auth))
.route("/api/auth/admin/scim-tokens/:id", delete(proxy_auth))
```

To:

```rust
// After
.route("/api/auth/admin/scim/tokens", get(proxy_auth).post(proxy_auth))
.route("/api/auth/admin/scim/tokens/:id", delete(proxy_auth))
```

The `proxy_auth` function strips `/api` from the path before forwarding to auth-service (main.rs:664-666). After this change it will forward `/auth/admin/scim/tokens` and `/auth/admin/scim/tokens/:id` — confirm the auth-service expects those paths.

Do NOT:
- Change the `/scim/v2/*` SCIM provisioning routes (lines 537-540) — those are correct and serve a different purpose.
- Add the old hyphen path as an alias — the old path is not in the spec and should be removed, not preserved.
