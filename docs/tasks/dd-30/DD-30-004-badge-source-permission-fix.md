---
id: DD-30-004
title: Fix badge-source endpoint permissions from shifts:write to badge_config:manage
unit: DD-30
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Badge source configuration (connecting I/O to external access control systems) requires admin-level `badge_config:manage` permission, not the operational `shifts:write` permission. A shift supervisor who can create shifts must not be able to reconfigure the badge system connection or change polling settings. The spec defines these as distinct permission tiers.

## Spec Excerpt (verbatim)

> | Permission | Description | Default Roles |
> | `badge_config:manage` | Configure badge system connections, adapters, polling, user mapping | Admin |
>
> Badge Sources:
> | `GET` | `/api/badge-sources` | `badge_config:manage` |
> | `GET` | `/api/badge-sources/:id` | `badge_config:manage` |
> | `POST` | `/api/badge-sources` | `badge_config:manage` |
> | `PUT` | `/api/badge-sources/:id` | `badge_config:manage` |
> | `DELETE` | `/api/badge-sources/:id` | `badge_config:manage` |
> | `POST` | `/api/badge-sources/:id/test` | `badge_config:manage` |
> | `PUT` | `/api/badge-sources/:id/enabled` | `badge_config:manage` |
> — 30_ACCESS_CONTROL_SHIFTS.md, §Badge Source Configuration API and §RBAC Permissions

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/handlers/shifts.rs` lines 1701–1916 — all badge-source handlers

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `list_badge_sources` (line 1705) checks `badge_config:manage`, not `shifts:read`
- [ ] `create_badge_source` (line 1761) checks `badge_config:manage`, not `shifts:write`
- [ ] `update_badge_source` (line 1824) checks `badge_config:manage`, not `shifts:write`
- [ ] `delete_badge_source` (line 1890) checks `badge_config:manage`, not `shifts:write`

## Assessment

- **Status**: ⚠️ Wrong
- `list_badge_sources` at line 1705 checks `shifts:read`. `create_badge_source` at line 1761, `update_badge_source` at line 1824, and `delete_badge_source` at line 1890 all check `shifts:write`. Spec requires `badge_config:manage` on all four.

## Fix Instructions

In `services/api-gateway/src/handlers/shifts.rs`, change the permission string in four handlers:

- Line 1705: `"shifts:read"` → `"badge_config:manage"`
- Line 1761: `"shifts:write"` → `"badge_config:manage"`
- Line 1824: `"shifts:write"` → `"badge_config:manage"`
- Line 1890: `"shifts:write"` → `"badge_config:manage"`

Also update the error message text in each to say `"badge_config:manage permission required"`.

The frontend `BadgeSourcesSection` in `frontend/src/pages/shifts/index.tsx` (line 1206) is currently shown inside the Schedule tab with no permission check. Add a permission guard: only render the section when the user has `badge_config:manage`. Since the API will now return 403 for non-admins, the UI should hide the section rather than showing it and failing.

Do NOT:
- Change the shift/crew/muster handlers — only the four `badge_source` handlers need this fix
- Create a new `badge_config:manage` permission string — it is already defined in the canonical permissions list (doc 03 / `frontend/src/shared/types/permissions.ts`)
