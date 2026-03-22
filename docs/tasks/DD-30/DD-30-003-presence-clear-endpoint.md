---
id: DD-30-003
title: Add POST /api/presence/clear/:badge_id endpoint for manual stale-presence clear
unit: DD-30
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Shift supervisors with `presence:manage` permission must be able to manually mark a stale on-site person as off-site. This is needed when someone's badge-in is not followed by a badge-out (forgot to swipe, reader malfunction). The frontend Presence tab should expose this action on stale entries.

## Spec Excerpt (verbatim)

> **Manual clear**: Shift supervisors with `presence:manage` permission can manually mark someone as off-site.
> — 30_ACCESS_CONTROL_SHIFTS.md, §Stale Presence Handling

> | `POST` | `/api/presence/clear/:badge_id` | `presence:manage` | Manually clear on-site status for a stale entry |
> — 30_ACCESS_CONTROL_SHIFTS.md, §Presence API

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/handlers/shifts.rs` — add handler near `list_presence`/`get_presence` (around line 1060)
- Route builder at line 1948 — add the route after the existing presence routes

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `POST /api/presence/clear/:badge_id` route exists in the route table
- [ ] Handler requires `presence:manage` permission
- [ ] Handler sets `is_on_site = false`, `status = 'off_site'`, `badge_out_at = now()` for the specified `badge_id`
- [ ] Handler returns 404 if badge_id not found in `presence_status`
- [ ] Response follows standard `{ "success": true, "data": ... }` envelope

## Assessment

- **Status**: ❌ Missing
- Route table at shifts.rs:1948-1950 only has `GET /api/presence` and `GET /api/presence/:user_id`. No clear endpoint.

## Fix Instructions

Add `clear_presence` handler in `services/api-gateway/src/handlers/shifts.rs` (after `get_presence`, around line 1166):

```rust
pub async fn clear_presence(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(badge_id): Path<String>,
) -> impl IntoResponse {
    if !check_permission(&claims, "presence:manage") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "presence:manage required")
            .into_response();
    }

    let result = sqlx::query(
        r#"UPDATE presence_status
           SET is_on_site = false,
               status = 'off_site',
               badge_out_at = now(),
               updated_at = now()
           WHERE badge_id = $1
           RETURNING badge_id"#,
    )
    .bind(&badge_id)
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some(_)) => ok(json!({ "cleared": true, "badge_id": badge_id })).into_response(),
        Ok(None) => error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Badge ID not found").into_response(),
        Err(e) => {
            tracing::error!(error = %e, "clear_presence failed");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to clear presence").into_response()
        }
    }
}
```

Register the route in `shifts_routes()`:
```rust
.route("/api/presence/clear/:badge_id", post(clear_presence))
```

Also add a "Clear" action button in `PresenceTab` (frontend/src/pages/shifts/index.tsx) visible only for stale entries (where `stale_at` is not null). The button calls `shiftsApi.clearPresence(badge_id)`.

Do NOT:
- Use `user_id` as the path parameter — the spec specifies `badge_id` so unmatched personnel (no I/O account) can also be cleared
- Require `shifts:write` — the spec defines a separate `presence:manage` permission for this action
