---
id: DD-10-004
title: Gate publish checkbox on dashboards:publish permission
unit: DD-10
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The "Published" checkbox in the DashboardBuilder is currently visible to any user with `dashboards:write` permission. Publishing a dashboard — making it accessible to the team — requires the separate `dashboards:publish` permission. Users who have `dashboards:write` but not `dashboards:publish` should not see or be able to interact with the publish toggle.

## Spec Excerpt (verbatim)

> `dashboards:publish` | Publish dashboards | Supervisor, Content Manager, Admin
> — design-docs/10_DASHBOARDS_MODULE.md §Permissions

> Action buttons (Create, Edit, Delete, Export, Print) are hidden (not disabled) when the user lacks permission.
> — CX-RBAC contract, docs/SPEC_MANIFEST.md §Wave 0

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/dashboards/DashboardBuilder.tsx` — lines 767–784: the "Published" checkbox `<label>` with no permission check

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] The "Published" checkbox in DashboardBuilder.tsx is wrapped in a permission check for `dashboards:publish`
- [ ] Users with only `dashboards:write` do not see the checkbox
- [ ] Users with `dashboards:publish` see and can interact with the checkbox normally
- [ ] The checkbox is hidden (not disabled) when permission is absent

## Assessment

- **Status**: ⚠️ Wrong
- `DashboardBuilder.tsx` lines 767–784: the Published `<label>` element has no permission check. Any user who reaches the builder (which requires `dashboards:write`) can toggle publish.

## Fix Instructions

In `frontend/src/pages/dashboards/DashboardBuilder.tsx`:

1. Import the auth hook used elsewhere in the module (check if `useAuthStore` from `../../store/auth` has a `hasPermission` method, or use the `user.permissions` array).

2. Derive a boolean: `const canPublish = hasPermission('dashboards:publish')`

3. Wrap the publish checkbox label (lines 767–784) with a conditional:
```tsx
{canPublish && (
  <label ...>
    <input type="checkbox" checked={published} onChange={...} />
    Published
  </label>
)}
```

4. When `canPublish` is false and the dashboard is already published (loaded from API), the `published` state value should remain true in local state (it was set by someone with permission) but the checkbox is simply not rendered. The payload sent on save should NOT forcibly set `published: false` when the user lacks publish permission — only pass `published` in the payload if the user has the permission, otherwise omit the field.

Do NOT:
- Render the checkbox as disabled — hide it entirely
- Force `published = false` on load when the user lacks publish permission (that would silently unpublish dashboards on save)
