---
id: MOD-CONSOLE-003
title: Persist aspect ratio lock per-workspace in WorkspaceConfig.settings
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The aspect ratio lock toggle (whether graphics letterbox/pillarbox vs. stretch to fill their pane) should be a per-workspace setting stored in each workspace's configuration, not a global module-level flag. When a user switches from workspace A (aspect ratio locked) to workspace B (stretch to fill), the toggle should reflect the setting for workspace B, not the last global state.

## Spec Excerpt (verbatim)

> **Toggle: Ignore Aspect Ratio:**
> - When toggled on, graphics render with `preserveAspectRatio="none"` — stretched to fill pane completely
> - This is a **per-workspace setting** stored in `WorkspaceSettings.preserveAspectRatio`
> - Toggle control: icon button in workspace toolbar (aspect ratio lock/unlock icon)
> - Applies to all panes in the workspace uniformly
>
> ```typescript
> interface WorkspaceSettings {
>   templateId: string;
>   preserveAspectRatio: boolean; // Default: true
>   autoSave: boolean;
> }
> ```
> — console-implementation-spec.md, §4.5 and §3.1

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/types.ts` — `WorkspaceLayout` interface (missing `settings` / `preserveAspectRatio` field)
- `frontend/src/store/workspaceStore.ts` — `preserveAspectRatio` at line 74 (global store field, not per-workspace)
- `frontend/src/pages/console/index.tsx` — toggle button reads `useWorkspaceStore().preserveAspectRatio` at line 1085

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `WorkspaceLayout` in `types.ts` has a `settings` field of type `{ preserveAspectRatio: boolean; autoSave: boolean }` (or similar)
- [ ] `preserveAspectRatio` is NOT a top-level field on `WorkspaceState` in `workspaceStore.ts`
- [ ] When switching `activeId`, the toolbar toggle reflects the `settings.preserveAspectRatio` of the newly active workspace
- [ ] Toggling the button calls `updateWorkspace(activeId, ws => ({ ...ws, settings: { ...ws.settings, preserveAspectRatio: !current } }))` and triggers auto-save

## Assessment

After checking:
- **Status**: ⚠️ Wrong — `preserveAspectRatio` is stored as a global `WorkspaceState` field at `store/workspaceStore.ts:74`. `WorkspaceLayout` in `types.ts` has no `settings` field. The toggle at `index.tsx:1085-1116` reads/writes the global field. Switching workspaces does not restore the per-workspace aspect ratio setting.

## Fix Instructions (if needed)

1. **`frontend/src/pages/console/types.ts`**: Add `settings` to `WorkspaceLayout`:
   ```typescript
   export interface WorkspaceSettings {
     preserveAspectRatio: boolean;
     autoSave: boolean;
   }

   export interface WorkspaceLayout {
     // existing fields...
     settings?: WorkspaceSettings;  // optional for backwards compat with saved workspaces
   }
   ```

2. **`frontend/src/store/workspaceStore.ts`**: Remove the global `preserveAspectRatio: boolean` field from `WorkspaceState` at line 74. Remove `setPreserveAspectRatio` action at line 112. The setting now lives inside each `WorkspaceLayout.settings`.

3. **`frontend/src/pages/console/index.tsx`**:
   - Replace `const { ..., preserveAspectRatio, ..., setPreserveAspectRatio } = useWorkspaceStore()` with reading from `activeWorkspace.settings?.preserveAspectRatio ?? true`
   - The toggle handler should call `updateWorkspace(activeId, ws => ({ ...ws, settings: { ...(ws.settings ?? {}), preserveAspectRatio: !current } }))` then `scheduleSave(ws)`

4. **Default value**: When creating a new workspace in `makeNewWorkspace()`, add `settings: { preserveAspectRatio: true, autoSave: true }`.

5. **Backwards compat**: In all reads use `workspace.settings?.preserveAspectRatio ?? true` so workspaces saved before this change continue to work with the default.

Do NOT:
- Keep `preserveAspectRatio` as a global Zustand field — this is the exact false-DONE pattern the spec calls out.
- Add a migration step — use the optional chaining `?.` fallback approach for backwards compat.
