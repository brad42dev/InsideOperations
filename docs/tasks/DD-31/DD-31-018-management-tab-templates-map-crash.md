---
id: DD-31-018
unit: DD-31
title: "Management tab crashes — \"templates.map is not a function\""
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-31/CURRENT.md
---

## What to Build

The Management tab in the Alerts module crashes with "templates.map is not a function" when clicked. This is a continuation of the DD-31-017 fix (which resolved "templates.find is not a function" by changing `list_templates` from `PagedResponse` to `ApiResponse::success`). After DD-31-017 the initial module load works, but clicking the Management tab still triggers the error boundary.

## Root Cause Investigation

The crash is "templates.map is not a function", meaning `templates` is not an array at some point during render in the Management tab tree. Possible causes to investigate:

1. **`variables` type mismatch** — The backend `NotificationTemplateRow.variables` is `Vec<String>` (array of name strings like `["var1"]`), but the frontend `NotificationTemplate.variables` is typed as `TemplateVariable[]` (array of structured objects). When a template with variables is rendered in `TemplatesPanel` (in `index.tsx`), accessing `tpl.variables.map(v => v.name)` would return `["var1"]` (works fine), but calling `tpl.variables.map((v: TemplateVariable) => v.label)` with a string would yield `undefined`. This wouldn't crash `.map` itself.

2. **Groups fetch paginated response** — `list_groups` still returns `PagedResponse`. The `GroupsPanel` in `index.tsx` has a workaround to unwrap `.data.data`, but if any related code doesn't apply this workaround, the `.map()` call would fail.

3. **QueryFn pattern difference** — `TemplatesPanel` uses `queryFn: () => notificationsApi.listTemplates()` (synchronous Promise pass-through, `data` = `ApiResult` object). If any code path accesses `.data` on this result as if it were the raw array, `.map` would fail.

**Verification first:** Run `pnpm dev` and open the browser console. Navigate to `/alerts`, click "Management" tab, reproduce the crash and read the full stack trace to identify the exact call site.

## Fix

1. **Identify the exact crash location** from the browser stack trace.
2. **Fix the root cause** — likely one of:
   - A `variables.map()` call where `variables` is `null` (DB null not handled in Rust → comes back as JSON null, not `[]`). Fix the backend to return `variables: Vec<String>` safely, or fix the frontend to use `(tpl.variables ?? []).map(...)`.
   - A type mismatch causing unexpected object instead of array somewhere.
3. **Fix the `variables` type mismatch** — update the backend to return structured `TemplateVariable`-compatible objects, OR update the frontend to handle both string arrays and object arrays. The frontend type is `TemplateVariable[]` (with `name`, `label`, `default_value`, `required`). The backend stores `variables` as `TEXT[]` in PostgreSQL. Fix: change the backend to store and return JSONB objects, OR keep strings and convert them on the frontend to `{ name: v, label: v, required: false }`.

## Acceptance Criteria

- [ ] Clicking "Management" tab does not crash — no error boundary triggered
- [ ] Templates list renders in the Management → Templates sub-tab
- [ ] Templates with variables render without error
- [ ] `cd frontend && npx tsc --noEmit` passes
- [ ] `cargo build -p io-api-gateway` passes (if backend changed)

## Files to Create or Modify

- `frontend/src/pages/alerts/index.tsx` — fix crash in TemplatesPanel or GroupsPanel
- `services/api-gateway/src/handlers/notifications.rs` — (if needed) fix `variables` field handling
- `frontend/src/api/notifications.ts` — (if needed) fix type definitions

## Verification Checklist

- [ ] `cargo build -p io-api-gateway` passes (if backend changed)
- [ ] `cd frontend && npx tsc --noEmit` passes
- [ ] Management tab loads without error boundary in browser
- [ ] Templates list visible in Management → Templates sub-tab

## Do NOT

- Do not remove the `variables` field from the API response
- Do not hardcode template data
- Do not break the Send Alert tab template selector

## Dev Notes

UAT failure from 2026-03-24: Management tab crashes with "templates.map is not a function" after DD-31-017 was fixed. The Management tab renders `ManagementPanel` → `TemplatesPanel` (default sub-tab). The `TemplatesPanel` in `index.tsx` at line 1464 calls `templates.map(...)` where `templates` is guarded by `Array.isArray(result.data) ? result.data : []`. Inspect the browser stack trace to find the exact call site. A likely issue is `variables` being `null` in the database for system templates (PostgreSQL `NULL != ARRAY[]`), causing `null.map(...)` when the frontend tries to render them.
