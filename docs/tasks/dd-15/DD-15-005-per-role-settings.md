---
id: DD-15-005
title: Add idle timeout and max concurrent sessions per-role settings to Role edit dialog
unit: DD-15
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Each role should have configurable per-role settings: an idle timeout (in minutes, overrides the system default when set) and a maximum number of concurrent sessions (0 = unlimited). These settings are currently absent from both the Role create and edit dialogs.

## Spec Excerpt (verbatim)

> **Per-Role Settings**: Idle timeout (editable per role, overrides system default) and max concurrent sessions (editable per role, 0 = unlimited)
> — 15_SETTINGS_MODULE.md, §Role & Permission Management

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/settings/Roles.tsx` lines 398–540 — `EditRoleDialog` and its `UpdateRoleRequest` form
- `frontend/src/pages/settings/Roles.tsx` lines 296–393 — `CreateRoleDialog` and `CreateRoleRequest` form
- `frontend/src/api/roles.ts` — `UpdateRoleRequest` and `CreateRoleRequest` types need new fields

## Verification Checklist

- [ ] `UpdateRoleRequest` type includes `idle_timeout_minutes: number | null` and `max_concurrent_sessions: number`
- [ ] EditRoleDialog renders a numeric input "Idle Timeout (minutes)" with a placeholder/hint "Leave blank to use system default"
- [ ] EditRoleDialog renders a numeric input "Max Concurrent Sessions" with hint "0 = unlimited"
- [ ] CreateRoleDialog includes the same two fields
- [ ] Values are saved and loaded from the API correctly (existing role data populates the form)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `EditRoleDialog` form (Roles.tsx:415) initializes with `display_name`, `description`, `permissions` only. No `idle_timeout_minutes` or `max_concurrent_sessions`.

## Fix Instructions

1. **Update `UpdateRoleRequest`** in `frontend/src/api/roles.ts`:
   ```ts
   export interface UpdateRoleRequest {
     display_name?: string
     description?: string
     permissions?: string[]
     idle_timeout_minutes?: number | null  // ADD: null = inherit system default
     max_concurrent_sessions?: number      // ADD: 0 = unlimited
   }
   ```

2. **Update `EditRoleDialog` form state** (Roles.tsx:410) to include the new fields:
   ```tsx
   React.useEffect(() => {
     if (role) {
       setForm({
         display_name: role.display_name,
         description: role.description ?? '',
         permissions: role.permissions.map((p) => p.name),
         idle_timeout_minutes: role.idle_timeout_minutes ?? null,   // ADD
         max_concurrent_sessions: role.max_concurrent_sessions ?? 0, // ADD
       })
     }
   }, [role])
   ```

3. **Add two fields** to the form JSX in `EditRoleDialog` (after the description field, before permissions):
   ```tsx
   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
     <div>
       <label style={labelStyle}>Idle Timeout (minutes)</label>
       <input
         type="number"
         style={inputStyle}
         value={form.idle_timeout_minutes ?? ''}
         onChange={(e) => setForm(f => ({ ...f, idle_timeout_minutes: e.target.value ? Number(e.target.value) : null }))}
         placeholder="System default"
         min={1}
       />
     </div>
     <div>
       <label style={labelStyle}>Max Concurrent Sessions</label>
       <input
         type="number"
         style={inputStyle}
         value={form.max_concurrent_sessions ?? 0}
         onChange={(e) => setForm(f => ({ ...f, max_concurrent_sessions: Number(e.target.value) }))}
         placeholder="0 = unlimited"
         min={0}
       />
     </div>
   </div>
   ```

4. Apply the same pattern to `CreateRoleDialog` (line 306).

Do NOT:
- Make idle_timeout_minutes required — null is a valid value meaning "use system default"
- Set a maximum on max_concurrent_sessions in the UI (the backend may enforce its own limit)
