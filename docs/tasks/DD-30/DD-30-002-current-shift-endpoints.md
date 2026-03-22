---
id: DD-30-002
title: Add GET /api/shifts/current and GET /api/shifts/current/personnel endpoints
unit: DD-30
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The Alert Service (doc 27) queries `GET /api/shifts/current/personnel` at alert trigger time to resolve dynamic "on_shift" rosters. These two endpoints must return the currently active shift(s) and the list of personnel assigned to them. Without them, shift-aware alert routing fails entirely.

## Spec Excerpt (verbatim)

> | `GET` | `/api/shifts/current` | `shifts:read` | Get current active shift(s) |
> | `GET` | `/api/shifts/current/personnel` | `shifts:read` | List personnel on the current shift (consumed by Alert Service) |
> — 30_ACCESS_CONTROL_SHIFTS.md, §Shift Management API

> **Shift-aware routing**: Alert rosters with `source: 'on_shift'` resolve their member list dynamically from the current shift schedule. The Alert Service queries `GET /api/shifts/current/personnel` at alert trigger time.
> — 30_ACCESS_CONTROL_SHIFTS.md, §Cross-Module Integration / Alert System

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/handlers/shifts.rs` — route builder at line 1922; add handlers here
- Route registration block at shifts.rs:1942-1947 — add new routes in this block

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `GET /api/shifts/current` route exists and returns shifts where `now()` is between `start_time` and `end_time + handover_minutes`
- [ ] `GET /api/shifts/current/personnel` route exists and returns `shift_assignments` joined to `users` for active shifts
- [ ] Both routes require `shifts:read` permission
- [ ] Both routes return the standard `{ "success": true, "data": ... }` envelope

## Assessment

- **Status**: ❌ Missing
- Route table in `shifts.rs:1922-1973` has only `/api/shifts` (list all) and `/api/shifts/:id` (get one). No `/api/shifts/current` route.

## Fix Instructions

Add two new handler functions in `services/api-gateway/src/handlers/shifts.rs`:

**`get_current_shifts`** (for `GET /api/shifts/current`):
```sql
SELECT s.id, s.name, s.crew_id, sc.name AS crew_name, s.pattern_id,
       s.start_time, s.end_time, s.handover_minutes, s.notes, s.status,
       s.created_at, s.created_by
FROM shifts s
LEFT JOIN shift_crews sc ON sc.id = s.crew_id
WHERE s.start_time <= now()
  AND (s.end_time + (s.handover_minutes || ' minutes')::interval) >= now()
ORDER BY s.start_time
```

**`get_current_personnel`** (for `GET /api/shifts/current/personnel`):
```sql
SELECT DISTINCT sa.user_id, u.display_name, u.email, sa.role_label
FROM shifts s
JOIN shift_assignments sa ON sa.shift_id = s.id
LEFT JOIN users u ON u.id = sa.user_id
WHERE s.start_time <= now()
  AND (s.end_time + (s.handover_minutes || ' minutes')::interval) >= now()
ORDER BY u.display_name
```

Register the routes in the `shifts_routes()` builder. These must be registered BEFORE the `"/api/shifts/:id"` route to avoid Axum matching "current" as an ID:

```rust
.route("/api/shifts/current", get(get_current_shifts))
.route("/api/shifts/current/personnel", get(get_current_personnel))
// (these two lines must come before the /:id route)
.route("/api/shifts/:id", get(get_shift).put(update_shift).delete(delete_shift))
```

Do NOT:
- Register `/api/shifts/current` after `/api/shifts/:id` — Axum's router will match "current" as a UUID parameter and return 400/not-found
- Forget handover overlap — use `end_time + handover_minutes` not just `end_time`
