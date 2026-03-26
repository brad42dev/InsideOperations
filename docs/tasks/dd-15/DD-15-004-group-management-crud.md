---
id: DD-15-004
title: Implement Group Management CRUD (create groups, assign roles, manage membership)
unit: DD-15
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Settings module must provide a Groups admin page where admins can: create named groups, assign one or more roles to a group, and manage group membership (add/remove users). Users inherit the combined permissions of all roles assigned to their groups in addition to directly-assigned roles. Currently the Groups page is an informational redirect page that explicitly defers implementation to "Phase 16."

## Spec Excerpt (verbatim)

> **Group Management**: Create groups, assign one or more roles to a group, manage group membership (add/remove users). Users inherit the combined permissions of all roles assigned to their groups, in addition to any directly assigned roles.
> — 15_SETTINGS_MODULE.md, §Role & Permission Management

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/settings/Groups.tsx` — currently 236 lines of informational content; needs full replacement with group CRUD
- `frontend/src/api/` — no groups API file currently exists; needs creation

## Verification Checklist

- [ ] Groups page lists all user groups in a table (name, role count, member count, created_at)
- [ ] "Create Group" button opens a dialog: name field, role multi-select from the role list
- [ ] Each group row has an expandable member management section (or a "Manage Members" link)
- [ ] Members can be added (user search + add) and removed (remove button per member)
- [ ] Group rows have Edit (name, roles) and Delete (confirmation dialog) actions
- [ ] Groups are fetched from and saved to a backend API (not local state only)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: Groups.tsx:1 comment — "No groups API exists yet; RBAC role assignment is handled in Users/Roles settings pages." The page redirects to Roles and Alerts pages rather than implementing group management.

## Fix Instructions

1. **Create `frontend/src/api/groups.ts`** with:
   - `GET /api/groups` → list groups (paginated)
   - `POST /api/groups` → create group `{name, role_ids}`
   - `PUT /api/groups/:id` → update group
   - `DELETE /api/groups/:id` → delete group
   - `GET /api/groups/:id/members` → list members
   - `POST /api/groups/:id/members` → add user `{user_id}`
   - `DELETE /api/groups/:id/members/:user_id` → remove member

2. **Rewrite `frontend/src/pages/settings/Groups.tsx`** with:
   - A table listing groups with columns: Name, Roles (as badges), Member Count, Actions
   - "Create Group" button opening a dialog with name field + role multi-select (reuse the `PermissionMultiSelect` pattern from Roles.tsx but for roles)
   - Expandable row or separate panel for member management: search users, add member, list current members with remove
   - Edit (name and roles) and Delete (confirmation dialog) actions per row

3. **Note on "Phase 16" comment** in the current Groups.tsx footer: that note refers to a future "Named User Groups as standalone cross-cutting entity." The current spec requirement is simpler — groups for RBAC role assignment. Implement the spec-required CRUD, remove the "Phase 16" deferral note.

Do NOT:
- Remove the informational note about notification groups (which live in Alerts) — keep that explanation but make it a secondary section, not the primary content
- Mix this up with the Alerts notification groups (those remain in /alerts)
