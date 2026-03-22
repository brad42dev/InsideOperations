---
id: DD-27-006
title: Implement recipient rosters with CRUD and shift-aware member resolution
unit: DD-27
status: pending
priority: medium
depends-on: [DD-27-001]
---

## What This Feature Should Do

Recipient rosters are named groups used to determine who receives alert notifications. Rosters can be manually maintained or dynamically resolved from user roles, current shift data, or badge-in/badge-out presence data. The alert-service must provide CRUD endpoints for rosters and, when dispatching an alert, resolve the roster's members to actual per-channel contacts before dispatching.

## Spec Excerpt (verbatim)

> ### Roster Sources
>
> - **Manual**: Administrator creates and maintains the roster in Settings UI
> - **User group**: Roster dynamically includes all I/O users with a specific role. Membership updates automatically as users are added/removed from the role.
> - **On-shift**: Targets personnel currently on shift. Membership resolved dynamically from shift schedule data managed by the Access Control & Presence module (doc 30).
> - **On-site**: Targets personnel currently on site. Membership resolved dynamically from badge-in/badge-out data.
>
> Special Rosters: **All Users** (every active I/O user), **Admins** (all users with admin role).
> — design-docs/27_ALERT_SYSTEM.md, §Recipient Rosters

## Where to Look in the Codebase

Primary files:
- `services/alert-service/src/main.rs:43-77` — no `/alerts/rosters` routes
- `services/alert-service/src/handlers/` — no `rosters.rs` file
- `services/alert-service/src/handlers/escalation.rs:90` — `notify_users` array is a static UUID list; no roster resolution

## Verification Checklist

- [ ] `handlers/rosters.rs` exists with CRUD: `list_rosters`, `get_roster`, `create_roster`, `update_roster`, `delete_roster`
- [ ] `main.rs` registers `GET/POST /alerts/rosters` and `GET/PUT/DELETE /alerts/rosters/:id`
- [ ] `resolve_roster_members` function in escalation takes a `roster_id: Uuid` and returns `Vec<ChannelRecipient>` by querying the appropriate source
- [ ] For `source = 'manual'`: returns members JSONB directly from `alert_rosters`
- [ ] For `source = 'role_group'`: queries `users JOIN user_roles` where `role_id = source_config->>'role_id'`
- [ ] For `source = 'all_users'`: queries all active users
- [ ] For `source = 'on_shift'` and `source = 'on_site'`: makes HTTP request to access-control service (or queries shift/presence tables directly if co-located) — can be a stub returning empty for now with a TODO comment
- [ ] Seed migration inserts "All Users" and "Admins" built-in rosters

## Assessment

- **Status**: ❌ Missing — no roster code whatsoever; escalation uses static `notify_users` UUID array directly

## Fix Instructions (if needed)

1. Write migration adding `alert_rosters` table per spec schema (id, name, description, source, source_config, members JSONB, created_at, updated_at, created_by, updated_by). Add `built_in BOOLEAN NOT NULL DEFAULT false`.

2. Create `services/alert-service/src/handlers/rosters.rs` with `AlertRoster` struct and full CRUD handlers. Built-in rosters (`built_in = true`) cannot be deleted (return 409).

3. Add a `resolve_roster_members` async function that takes `AppState` and `roster_id`:
   ```rust
   async fn resolve_roster_members(state: &AppState, roster_id: Uuid) -> Vec<ChannelRecipient> {
       let roster = // fetch alert_rosters WHERE id = roster_id
       match roster.source.as_str() {
           "manual" => // deserialize roster.members JSONB
           "role_group" => // query users JOIN user_roles_lookup
           "all_users" => // query all active users
           "on_shift" | "on_site" => {
               // TODO: query access-control-service; return empty for now
               vec![]
           }
           _ => vec![],
       }
   }
   ```

4. Update `dispatch_tier_impl` in `escalation.rs` to call `resolve_roster_members` using the `roster_id` stored in the alert row, instead of using the hardcoded `notify_users` array.

5. Register roster routes in `main.rs`.

Do NOT:
- Block on unimplemented on-shift/on-site — return empty list with a tracing::warn log until the access-control integration is built
- Delete built-in "All Users" and "Admins" rosters
