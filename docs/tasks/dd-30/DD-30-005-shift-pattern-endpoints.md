---
id: DD-30-005
title: Add shift pattern CRUD and schedule generation endpoints
unit: DD-30
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Shift patterns are reusable templates (8h×3, 12h×2, DuPont, Pitman, Custom) that can be applied to auto-generate weeks of shifts. The `POST /api/shifts/patterns/:id/generate` endpoint takes a date range and crew assignment and inserts all resulting shift instances. Without this, the "pattern wizard" feature described in the spec cannot be built. Currently only `GET /api/shifts/patterns` (list) exists.

## Spec Excerpt (verbatim)

> **Pattern wizard**: select a pattern, set start date, assign crews, generate schedule for N weeks
>
> | `POST` | `/api/shifts/patterns` | `shifts:write` | Create shift pattern |
> | `PUT` | `/api/shifts/patterns/:id` | `shifts:write` | Update shift pattern |
> | `DELETE` | `/api/shifts/patterns/:id` | `shifts:write` | Delete shift pattern |
> | `POST` | `/api/shifts/patterns/:id/generate` | `shifts:write` | Generate shift schedule from pattern for a date range |
>
> Pre-built templates for common industrial patterns:
> - **8h x 3**: Day (06:00-14:00), Swing (14:00-22:00), Night (22:00-06:00)
> - **12h x 2**: Day (06:00-18:00), Night (18:00-06:00)
> - **DuPont**: 12-hour rotating, 4-crew, 28-day cycle
> - **Pitman**: 12-hour rotating, 4-crew, 14-day cycle
> - **Custom**: User-defined start/end, rotation period, crew count
> — 30_ACCESS_CONTROL_SHIFTS.md, §Shift Patterns and §Shift Patterns API

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/handlers/shifts.rs` — `list_patterns` exists at line 323; add POST/PUT/DELETE/generate alongside it
- Route builder at line 1926 — currently only `get(list_patterns)`

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `POST /api/shifts/patterns` route exists with `shifts:write` guard
- [ ] `PUT /api/shifts/patterns/:id` route exists with `shifts:write` guard
- [ ] `DELETE /api/shifts/patterns/:id` route exists with `shifts:write` guard
- [ ] `POST /api/shifts/patterns/:id/generate` route exists with `shifts:write` guard
- [ ] `generate` handler accepts `{ start_date, weeks, crew_id }` body and inserts shift rows
- [ ] `GET /api/shifts/patterns/:id` route exists

## Assessment

- **Status**: ❌ Missing
- Route table at line 1926 registers only `get(list_patterns)` for `/api/shifts/patterns`. No POST, PUT, DELETE, or generate route. No `get_pattern` handler either.

## Fix Instructions

Add the following handlers to `shifts.rs`:

1. **`create_pattern`** — `POST /api/shifts/patterns`
   - Body: `{ name: String, pattern_type: String, description: Option<String>, pattern_config: JsonValue, handover_minutes: Option<i32> }`
   - INSERT into `shift_patterns`; requires `shifts:write`

2. **`get_pattern`** — `GET /api/shifts/patterns/:id`
   - SELECT by ID; requires `shifts:read`

3. **`update_pattern`** — `PUT /api/shifts/patterns/:id`
   - COALESCE update; requires `shifts:write`

4. **`delete_pattern`** — `DELETE /api/shifts/patterns/:id`
   - DELETE by ID; requires `shifts:write`

5. **`generate_from_pattern`** — `POST /api/shifts/patterns/:id/generate`
   - Body: `{ start_date: DateTime<Utc>, weeks: u32, crew_id: Option<Uuid> }`
   - Read the pattern's `pattern_config` JSONB to determine shift timing (e.g. for `8x3`: Day 06:00-14:00, Swing 14:00-22:00, Night 22:00-06:00)
   - Loop over `weeks * days`, generate shift instances, INSERT into `shifts` with `source = 'generated'`
   - If `crew_id` provided, also INSERT into `shift_assignments` for all crew members
   - Return `{ shifts_created: N }`
   - Requires `shifts:write`

Update the route builder:
```rust
.route("/api/shifts/patterns", get(list_patterns).post(create_pattern))
.route("/api/shifts/patterns/:id", get(get_pattern).put(update_pattern).delete(delete_pattern))
.route("/api/shifts/patterns/:id/generate", post(generate_from_pattern))
```

The `generate_from_pattern` logic for the 5 built-in pattern types should handle the time math. For the first implementation, it is acceptable to only implement `8x3` and `12x2` and stub the others.

Do NOT:
- Try to implement all DuPont/Pitman rotation math in the first pass — a stub that returns `400 Not implemented for this pattern type` is acceptable for those two complex patterns
- Delete the existing `GET /api/shifts/patterns` list route — it is already working correctly
