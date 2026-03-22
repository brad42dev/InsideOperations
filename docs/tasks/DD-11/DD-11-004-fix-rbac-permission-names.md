---
id: DD-11-004
title: Fix non-canonical RBAC permission names (reports:run, reports:generate, reports:schedule_manage)
unit: DD-11
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The canonical permission names defined in design-doc §Permissions are: `reports:read`, `reports:create`, `reports:delete`, `reports:export`, `reports:admin`. The current implementation uses three non-canonical names that do not appear in doc 11 or doc 03: `reports:run` (backend), `reports:generate` (frontend route guard), and `reports:schedule_manage` (frontend route guard). These must be aligned to the canonical set.

## Spec Excerpt (verbatim)

> | Permission | Description | Default Roles |
> |---|---|---|
> | `reports:read` | View reports | All roles |
> | `reports:create` | Create/edit report templates | Analyst, Supervisor, Content Manager, Admin |
> | `reports:delete` | Delete report templates | Supervisor, Admin |
> | `reports:export` | Export reports to CSV/PDF/Excel | Analyst, Supervisor, Content Manager, Admin |
> | `reports:admin` | Reports module administration (schedules, system templates) | Admin |
> — design-docs/11_REPORTS_MODULE.md, §Permissions

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/handlers/reports.rs` — line 101: checks `reports:run`
- `frontend/src/App.tsx` — line 392: `PermissionGuard permission="reports:generate"`; line 412: `PermissionGuard permission="reports:schedule_manage"`
- `frontend/src/shared/types/permissions.ts` — lines 55–56: declares `reports:generate` and `reports:schedule_manage` as valid permission types

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `handlers/reports.rs` POST /api/reports/generate checks `reports:export` (not `reports:run`) — generating a report is an export action per the permission table
- [ ] `App.tsx` `/reports/generate/:template_id` route uses `PermissionGuard permission="reports:read"` (not `reports:generate`) — reading/running a template is a `reports:read` action
- [ ] `App.tsx` `/reports/schedules` route uses `PermissionGuard permission="reports:admin"` (not `reports:schedule_manage`) — schedule management is the `reports:admin` domain
- [ ] `frontend/src/shared/types/permissions.ts` no longer contains `reports:generate` or `reports:schedule_manage`
- [ ] DB seed data (if any) for roles does not grant the non-canonical names

## Assessment

After checking:
- **Status**: ⚠️ Wrong — three non-canonical permission names in use

## Fix Instructions

**Backend — `services/api-gateway/src/handlers/reports.rs` line 101:**

Change:
```rust
if !claims.permissions.iter().any(|p| p == "*" || p == "reports:run") {
    return IoError::Forbidden("reports:run permission required".into()).into_response();
}
```
To:
```rust
if !claims.permissions.iter().any(|p| p == "*" || p == "reports:export") {
    return IoError::Forbidden("reports:export permission required".into()).into_response();
}
```

**Frontend — `frontend/src/App.tsx` line 392:**

Change `permission="reports:generate"` to `permission="reports:read"`. Generating a report from a template is the primary `reports:read` action — users who can view reports should be able to generate them. The `reports:export` permission would be the download action.

**Frontend — `frontend/src/App.tsx` line 412:**

Change `permission="reports:schedule_manage"` to `permission="reports:admin"`.

**Frontend — `frontend/src/shared/types/permissions.ts`:**

Remove the entries `'reports:generate'` and `'reports:schedule_manage'` from the Permission union type. Ensure `'reports:export'` and `'reports:admin'` remain.

Do NOT:
- Change the `reports:admin` checks already in `ReportSchedules.tsx:404` — those are correct
- Add new permission names outside the canonical set from doc 11 §Permissions
- Gate the template browser (GET /reports/templates) on anything other than `reports:read`
