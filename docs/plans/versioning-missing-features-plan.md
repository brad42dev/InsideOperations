# Versioning Missing Features Plan

Four areas confirmed missing from the versioning implementation. This document is the source of truth for what to build.

---

## Ground Truth — Current State

Before touching anything, read these files:
- `services/api-gateway/src/handlers/graphics.rs` — graphics + design_objects CRUD
- `services/api-gateway/src/handlers/console.rs` — workspace CRUD
- `services/api-gateway/src/handlers/saved_charts.rs` — chart CRUD (ALREADY has soft delete + publish)
- `frontend/src/api/graphics.ts` — frontend API (DesignObjectUpdateRequest has NO label field)
- `frontend/src/api/console.ts` — saveWorkspace body has no label field
- `frontend/src/shared/components/versioning/SaveConfirmDialog.tsx` — EXISTS, has notes textarea, passes `{ label }` to onConfirm. NOT wired to any page.
- `frontend/src/shared/components/versioning/useObjectActions.ts` — dispatchSaveAs is an explicit stub (marked "Task 8")
- `frontend/src/pages/designer/index.tsx` — handleSave calls graphicsApi.update directly, no dialog
- `frontend/src/pages/console/index.tsx` — handleExplicitSave calls persistWorkspace directly, no dialog

---

## CRITICAL: What "Save As" Means

"Save As" from the version recovery dialog means: take the content of the CURRENTLY PREVIEWED VERSION and create a NEW object with a new name. The new object automatically gets v1 because all new objects start at v1. There is no "fork" — every version is already a full copy. Just:
1. User selects a version in version history dialog
2. User clicks "Save As"
3. SaveAsDialog asks for a name (and optional label)
4. Frontend calls create endpoint with the previewed version's content + new name
5. Backend creates new object + auto-creates v1 snapshot

This already works correctly IF the `onSaveAsOverride` is wired to supply the version content. The stubs in `dispatchSaveAs` don't do this correctly.

---

## Task 1 — Object-level Soft Delete for design_objects

### Problem
`design_objects` has NO `deleted_at` column. Both `delete_graphic` (graphics.rs line ~759) and `delete_workspace` (console.rs line ~505) use hard `DELETE FROM design_objects`. This means deleted objects are unrecoverable.

### Architecture says
> Delete: Soft-deletes the object itself (sets `deleted_at` on the main object row). All associated version snapshots remain. Admins can recover soft-deleted objects.

User says:
> deleting the object itself → soft delete (admin can perm delete)

### What saved_charts already does (reference pattern)
`saved_charts` table HAS `deleted_at`. `delete_saved_chart` handler sets `deleted_at = NOW()` (soft delete). List queries filter `WHERE deleted_at IS NULL`. This is the pattern to replicate.

### What to implement

**Migration** (new file: `migrations/20260512000008_design_objects_soft_delete.up.sql`):
```sql
ALTER TABLE design_objects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX idx_design_objects_deleted ON design_objects(deleted_at) WHERE deleted_at IS NOT NULL;
```

**`services/api-gateway/src/handlers/graphics.rs`**:
- `delete_graphic`: Change hard DELETE to `UPDATE design_objects SET deleted_at = NOW() WHERE id = $1 AND (created_by = $2 OR $3::boolean) RETURNING id`
- `list_graphics`: Add `AND deleted_at IS NULL` to WHERE clause (already has other filters)
- `list_graphics_hierarchy`: Same — add `AND deleted_at IS NULL`
- `get_graphic` / `update_graphic`: Add `AND deleted_at IS NULL` to prevent editing soft-deleted items
- Add `recover_graphic` handler: `POST /api/v1/design-objects/:id/recover` — admin only, sets `deleted_at = NULL`
- Add `permanent_delete_graphic` handler: `DELETE /api/v1/design-objects/:id/permanent` — admin only, hard DELETE

**`services/api-gateway/src/handlers/console.rs`**:
- `delete_workspace`: Same pattern — soft delete with `deleted_at`
- `list_workspaces`: Add `AND deleted_at IS NULL`
- `get_workspace` / `update_workspace`: Add `AND deleted_at IS NULL`
- Add `recover_workspace` handler: `POST /api/console/workspaces/:id/recover` — admin only
- Add `permanent_delete_workspace` handler: `DELETE /api/console/workspaces/:id/permanent` — admin only

**`services/api-gateway/src/main.rs`**:
- Register the 4 new routes (recover + perm delete for graphics and workspaces)

**Frontend**:
- `frontend/src/api/graphics.ts`: Add `recover(id: string)` and `permanentDelete(id: string)` to `graphicsApi`
- `frontend/src/api/console.ts`: Add `recoverWorkspace(id: string)` and `permanentDeleteWorkspace(id: string)` to `consoleApi`
- `frontend/src/pages/designer/DesignerGraphicsList.tsx`: Update delete button behavior — currently calls `graphicsApi.remove(id)` which now soft-deletes. Add admin-only "Permanently Delete" option with confirmation dialog (reuse the inline confirm pattern from VersionActionBar). Admin users should see soft-deleted graphics (greyed out) with Recover option.
- `frontend/src/pages/console/index.tsx`: Update delete mutation — now soft-deletes. Admin can see deleted workspaces and recover them (can handle in the workspaces list UI).

### IMPORTANT: Check existing delete UI patterns before touching
- `DesignerGraphicsList.tsx` — how does the current delete work? Does it have a confirm dialog?
- Console workspace delete — does it have a confirm dialog?
Read these first, understand the pattern, THEN make minimal changes.

---

## Task 2 — Saved Charts Versioning

### Problem
`saved_charts` table exists, `saved_charts.rs` handles CRUD + soft delete + publish. But there are no version snapshots: no `saved_chart_versions` table, no snapshot creation on save/update, no version history endpoints, no version history UI.

### Architecture says
Doc marks this as "Future: `saved_chart_versions`" but the user says this was NOT deferred — it should be fully implemented.

### Reference pattern
Mirror the `design_object_versions` pattern exactly. Same columns, same advisory lock, same endpoint structure.

**Migration** (new file: `migrations/20260512000009_saved_chart_versions.up.sql`):
```sql
CREATE TABLE saved_chart_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chart_id UUID NOT NULL REFERENCES saved_charts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    version_type VARCHAR(10) NOT NULL CHECK (version_type IN ('save', 'publish')),
    config JSONB NOT NULL,
    label VARCHAR(255),
    parent_version_number INTEGER,
    metadata JSONB,
    deleted_at TIMESTAMPTZ,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chart_id, version_number)
);
CREATE INDEX idx_saved_chart_versions_chart_id ON saved_chart_versions(chart_id);
CREATE INDEX idx_saved_chart_versions_deleted ON saved_chart_versions(deleted_at) WHERE deleted_at IS NOT NULL;
```

**`services/api-gateway/src/handlers/saved_charts.rs`**:
- Add `create_chart_version_snapshot(db, chart_id, created_by, version_type, config, label)` helper:
  - Advisory lock: `SELECT pg_advisory_xact_lock(hashtext($1::text))`
  - Get next version number: `SELECT COALESCE(MAX(version_number), 0) + 1 FROM saved_chart_versions WHERE chart_id = $1`
  - Insert version row
  - Auto-label v1 as "Original"
- Call snapshot from `create_saved_chart` (version_type = 'save', label from body if provided)
- Call snapshot from `update_saved_chart` (version_type = 'save', label from body if provided)
- Call snapshot from `publish_saved_chart` (version_type = 'publish') — but only after the content is already saved (publish IS a save: call save first, then publish)
- Add new endpoints mirroring the workspace version endpoints:
  - `GET /api/v1/saved-charts/:id/versions` (list, with include_deleted for admin)
  - `GET /api/v1/saved-charts/:id/versions/:version_number` (get content)
  - `POST /api/v1/saved-charts/:id/versions/:version_number/restore`
  - `DELETE /api/v1/saved-charts/:id/versions/:version_number` (soft delete)
  - `POST /api/v1/saved-charts/:id/versions/:version_number/recover`
  - `DELETE /api/v1/saved-charts/:id/versions/:version_number/permanent`
  - `PATCH /api/v1/saved-charts/:id/versions/:version_number` (update label)
- Register all routes in main.rs

**`CreateSavedChartBody` and `UpdateSavedChartBody`**: Add `pub label: Option<String>` to both.

**Frontend — `frontend/src/api/savedCharts.ts`**:
Add version methods to `savedChartsApi`:
```typescript
listVersions: (id: string, opts?: { includeDeleted?: boolean }) =>
  api.get<VersionSummary[]>(`/api/v1/saved-charts/${id}/versions${opts?.includeDeleted ? "?include_deleted=true" : ""}`),
getVersionContent: (id: string, versionNumber: number) =>
  api.get<ChartVersionContent>(`/api/v1/saved-charts/${id}/versions/${versionNumber}`),
restoreVersion: (id: string, versionNumber: number) =>
  api.post(`/api/v1/saved-charts/${id}/versions/${versionNumber}/restore`, {}),
softDeleteVersion: (id: string, versionNumber: number) =>
  api.delete(`/api/v1/saved-charts/${id}/versions/${versionNumber}`),
recoverVersion: (id: string, versionNumber: number) =>
  api.post(`/api/v1/saved-charts/${id}/versions/${versionNumber}/recover`, {}),
permanentDeleteVersion: (id: string, versionNumber: number) =>
  api.delete(`/api/v1/saved-charts/${id}/versions/${versionNumber}/permanent`),
updateVersionLabel: (id: string, versionNumber: number, label: string | null) =>
  api.patch(`/api/v1/saved-charts/${id}/versions/${versionNumber}`, { label }),
```

**`frontend/src/shared/types/versioning.ts`**: Add `ChartVersionContent` type (similar to `WorkspaceVersionContent` but with `config: ChartConfig`).

**`frontend/src/shared/components/versioning/useVersionList.ts`**: Add `"chart"` to `ObjectType` and handle it with `savedChartsApi.listVersions`.

**`frontend/src/shared/components/versioning/useVersionActions.ts`**: Add `"chart"` case to all dispatch functions using `savedChartsApi` version methods.

**UI integration**: Find where saved charts are displayed and managed (check TrendPane, chart save/load dialog, ConsolePalette). Add a "Version History" button that opens `VersionRecoveryDialog` with `objectType="chart"`. The `onLoadVersion` callback should receive the chart config and load it into the current chart state.

---

## Task 3 — Wire SaveConfirmDialog to Save Buttons

### Problem
`SaveConfirmDialog.tsx` exists with a notes/label textarea and passes `{ label }` to `onConfirm`. No page uses it. The backend accepts `label` on both graphics saves and workspace saves. The label needs to flow through the entire chain.

### What to implement

**`frontend/src/api/graphics.ts`**:
Add `label?: string` to `DesignObjectUpdateRequest`:
```typescript
export interface DesignObjectUpdateRequest {
  name?: string;
  scene_data?: GraphicDocument;
  label?: string;  // add this
}
```

**`frontend/src/api/console.ts`**:
Add `label?: string` to the `saveWorkspace` body object.

**`frontend/src/pages/designer/index.tsx`**:
- Add `showSaveConfirmDialog` state (boolean) and `pendingSaveLabel` state (string | undefined)
- On explicit Save click (toolbar Save button, Ctrl+S): set `showSaveConfirmDialog = true` instead of calling `handleSave` immediately
- In `SaveConfirmDialog.onConfirm({ label })`: call `handleSave({ explicit: true, label })`
- Update `handleSave` signature to accept `label?: string`, pass it to `graphicsApi.update(id, { name, scene_data, label })`
- On autosave (non-explicit): SKIP the dialog, call `handleSave` directly (autosave is silent)
- Add `<SaveConfirmDialog>` to the JSX

**`frontend/src/pages/console/index.tsx`**:
- Add `showSaveConfirmDialog` state (boolean)
- `handleExplicitSave`: instead of immediately calling `persistWorkspace`, set `showSaveConfirmDialog = true`
- In `SaveConfirmDialog.onConfirm({ label })`: call `persistWorkspace(ws, label)`
- Update `persistWorkspace` to accept `label?: string`, include it in the `saveMutation.mutate({ ...ws, label })`
- Update `saveMutation.mutationFn` (which calls `consoleApi.saveWorkspace`) to pass label
- Update `consoleApi.saveWorkspace` body to include `label`
- Add `<SaveConfirmDialog>` to the JSX

**Also**: Update the Publish confirmation — the `PublishConfirmDialog.tsx` (if it has a label field, wire that through to the publish snapshot too). Check `PublishConfirmDialog.tsx` before modifying.

### Do NOT show SaveConfirmDialog for:
- Autosave (debounced scheduleSave)
- Rename operations (pendingRenameIdsRef)
- Duplicate operations
- Any programmatic save triggered not by user button click

---

## Task 4 — Save As: Wire Version Content

### Problem
`dispatchSaveAs` in `useObjectActions.ts` is explicitly a stub. It creates empty objects with wrong data (`scene_data: {} as never`). When "Save As" is used from the version history dialog, it should create a new object with the previewed version's content.

### What to implement

**`frontend/src/shared/components/versioning/VersionRecoveryDialog.tsx`**:
- The dialog already has `previewContent` state (the currently loaded version content)
- Pass `onSaveAsOverride` to `useObjectActions` that closes over `previewContent`:

```typescript
const objectActions = useObjectActions({
  objectType,
  objectId,
  onSaveAsOverride: async ({ name, label }) => {
    if (!previewContent) return { success: false, error: { message: "No version selected" } };
    switch (objectType) {
      case "graphic": {
        const gc = previewContent as GraphicVersionContent;
        return graphicsApi.create({ name, scene_data: gc.scene_data as GraphicDocument, label });
      }
      case "workspace": {
        const wc = previewContent as WorkspaceVersionContent;
        const layout = wc.layout as WorkspaceLayout;
        return consoleApi.saveWorkspace({ ...layout, name, id: undefined });
      }
      case "chart": {
        const cc = previewContent as ChartVersionContent;
        return savedChartsApi.create({ name, chart_type: cc.chart_type, config: cc.config });
      }
    }
  },
  ...
});
```

Note: `onSaveAsOverride` is already in `UseObjectActionsOptions` — it's the intended extension point for exactly this use case.

**`frontend/src/api/graphics.ts`**:
Add `label?: string` to `DesignObjectCreateRequest` as well (for Save As label).

**`frontend/src/api/savedCharts.ts`**:
`CreateSavedChartRequest` already exists — no changes needed.

**Backend**: Both `create_graphic` and `create_workspace` already create v1 snapshot on creation. `create_saved_chart` will also create v1 snapshot after Task 2. So Save As automatically gets a proper v1 snapshot with no additional backend changes.

---

## Execution Order

1. Write this file (done)
2. Have Opus read this file and all referenced files, then produce specific implementation steps
3. Implement Task 1 (object soft delete) — migration + backend + frontend
4. Implement Task 2 (chart versioning) — migration + backend + frontend API + shared types/hooks
5. Implement Task 3 (save dialog wiring) — frontend only
6. Implement Task 4 (save as content wiring) — frontend only
7. Run `cargo clippy` and `pnpm build` after each task
8. Re-compare against architecture doc

---

## Key Files to Read Before Implementing Each Task

**Task 1**:
- `services/api-gateway/src/handlers/graphics.rs` — all of delete_graphic, list_graphics, list_graphics_hierarchy
- `services/api-gateway/src/handlers/console.rs` — delete_workspace, list_workspaces
- `frontend/src/pages/designer/DesignerGraphicsList.tsx` — current delete UI
- `frontend/src/pages/console/index.tsx` — current workspace delete flow
- `services/api-gateway/src/main.rs` — route registration pattern

**Task 2**:
- `services/api-gateway/src/handlers/saved_charts.rs` — full file
- `services/api-gateway/src/handlers/console.rs` — create_workspace_version_snapshot helper (reference pattern)
- `frontend/src/shared/types/versioning.ts` — existing types to extend
- `frontend/src/shared/components/versioning/useVersionList.ts` — extend for chart type
- `frontend/src/shared/components/versioning/useVersionActions.ts` — extend for chart type
- Check TrendPane and ConsolePalette for where to add version history button

**Task 3**:
- `frontend/src/pages/designer/index.tsx` — full handleSave function + toolbar buttons
- `frontend/src/pages/console/index.tsx` — handleExplicitSave + persistWorkspace + saveMutation
- `frontend/src/shared/components/versioning/SaveConfirmDialog.tsx` — verify current interface
- `frontend/src/shared/components/versioning/PublishConfirmDialog.tsx` — check if it has label field

**Task 4**:
- `frontend/src/shared/components/versioning/VersionRecoveryDialog.tsx` — full file, find where objectActions is initialized and where SaveAsDialog is rendered
- `frontend/src/shared/hooks/useObjectActions.ts` — onSaveAsOverride option (already exists)
- `frontend/src/shared/types/versioning.ts` — GraphicVersionContent, WorkspaceVersionContent types

---

## Notes on Scope Boundaries

**NOT in scope for this plan**:
- Adding a UI for admins to browse/recover soft-deleted objects from a centralized admin panel (the recover action is enough for now — discoverable through the objects list if we show deleted items to admins)
- Charts versioning in the designer (charts exist only in console TrendPane)
- Changing the publish permission name for charts (console:workspace_publish is used throughout, leave it)

**In scope but minimal**:
- Soft-deleted objects in list views: for now, just filter them out for all users including admins. Admin recover access is through the object-level endpoint, not the list. If we add a "show deleted" toggle to lists later, that's a separate task.
- Actually, reconsider: admins need SOME way to see and recover soft-deleted objects. Minimum viable: add a toggle in the graphics list (DesignerGraphicsList) and workspaces list. Check how the version history dialog does it (showDeleted toggle) and replicate that pattern.
