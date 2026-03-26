---
id: DD-10-007
title: Implement chained variable cascade (parent change reloads child options)
unit: DD-10
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When a dashboard has chained variables (e.g., Area → Unit → Equipment), changing a parent variable must clear and reload the child variable's option list. Currently the `depends_on` field is stored and typed correctly, but no cascade logic exists in `handleVariableChange` — the child variable retains its old options when the parent changes.

## Spec Excerpt (verbatim)

> "Chained cascade: Changing a parent variable clears and reloads child variable options (e.g., changing Area reloads available Units, changing Unit reloads available Equipment)"
> — design-docs/10_DASHBOARDS_MODULE.md, §Variable Behavior

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/dashboards/DashboardViewer.tsx` — `handleVariableChange` at lines 200–212; `varValues` state; `VariableBar` component receives `variables` and `values`
- `frontend/src/pages/dashboards/DashboardViewer.tsx` — `VariableBar` at lines 13–140; no cascade re-fetch on parent change
- `frontend/src/api/dashboards.ts` — check for a `variable-options` query endpoint, or if options must be re-fetched from the variable's `query` field

## Verification Checklist

- [ ] Changing a parent variable value causes any child variable (where `child.depends_on === parent.name`) to have its options cleared
- [ ] Child variable options are re-fetched using the new parent value as a parameter
- [ ] While child options are loading, the child dropdown shows a loading indicator or is disabled
- [ ] If a chained variable's current selection is no longer valid after parent changes, the selection is reset to the default or `$__all`
- [ ] Non-chained variables are unaffected when any variable changes

## Assessment

- **Status**: ⚠️ Partial — `depends_on` field stored in variable type and builder, but cascade re-fetch not implemented in viewer

## Fix Instructions

In `frontend/src/pages/dashboards/DashboardViewer.tsx`:

1. The `varValues` state holds current selections. The `dashboard.variables` array holds `depends_on` relationships.

2. Modify `handleVariableChange` (lines 200–212) to additionally detect dependent children:
   ```tsx
   const handleVariableChange = useCallback(
     (name: string, val: string[]) => {
       setVarValues((prev) => {
         const next = { ...prev, [name]: val }
         // Clear selections for any variables that depend on this one
         for (const variable of dashboard?.variables ?? []) {
           if (variable.depends_on === name) {
             next[variable.name] = variable.default ? [variable.default] : []
           }
         }
         return next
       })
       // ... existing URL sync logic ...
     },
     [searchParams, setSearchParams, dashboard?.variables],
   )
   ```

3. For chained variable option loading: `VariableBar` currently renders options from `variable.options` (pre-loaded). For chained variables, options must be fetched dynamically. Add a `useQuery` inside `VariableBar` (or hoist to `DashboardViewer`) that fetches options for chained variables using the parent's current value:
   - Endpoint: `GET /api/v1/dashboards/variable-options?query={encodeURIComponent(variable.query)}&{parentName}={parentValues}`
   - Re-fetch when `varValues[variable.depends_on]` changes

4. Pass `varValues` down to `VariableBar` (already done — `values` prop at line 449) and use it in the dynamic option fetch.

Do NOT:
- Apply cascade clearing to non-chained variables.
- Use a `useEffect` inside `VariableBar` that calls APIs — hoist the data fetching to `DashboardViewer` and pass resolved options as a prop, keeping `VariableBar` presentational.
