# Versioning Fixes Plan

Four bugs to fix, then re-compare implementation against architecture doc.

---

## Task A — Fix architecture doc FK

**File:** `docs/architecture/versioning-and-publishing.md`

**Problem:** The DDL section shows `workspace_versions.workspace_id REFERENCES workspaces(id)` but the `workspaces` table does not exist. The correct FK target is `design_objects(id)` because workspaces are stored as `design_objects` rows with `object_type = 'console_workspace'`.

**Fix:** Find the DDL block for `workspace_versions` and change `REFERENCES workspaces(id)` → `REFERENCES design_objects(id)`.

---

## Task B — Fix autosave (CRITICAL — violation of explicit architectural contract)

### Architecture says (verbatim from doc):
> Auto-save is completely silent. It does NOT:
> - Create version snapshots
> - Update the live row in `design_objects`
>
> The existing implementation uses an `__autosave_*` name prefix on a temporary `design_objects` row plus IndexedDB local tracking.

### Current broken behavior:
- `consoleApi.saveWorkspace()` always POSTs to `/api/console/workspaces` (the live UPSERT endpoint)
- The `autosave: true` flag only prevents VERSION SNAPSHOTS on the backend; it does NOT prevent the live row update
- So every debounced change still overwrites the canonical live row — violating the arch contract

### What the console page already does correctly:
- `scheduleSave()` now calls `saveDraftLocal(ws)` (localStorage only) on the API path
- `handleExplicitSave()` calls `persistWorkspace(ws)` which calls `saveMutation.mutate(ws)`
- `saveMutation` calls `consoleApi.saveWorkspace(ws)` which hardcodes `autosave: true`

### Correct fix:
The frontend already correctly separates autosave (localStorage draft) from explicit save. The problem is that `saveWorkspace` in `console.ts` still hard-codes `autosave: true` even when called from `handleExplicitSave`. The fix:

1. **`frontend/src/api/console.ts`**: Change `saveWorkspace` to NOT include `autosave: true`. Remove that field entirely from the request body. Explicit saves should never be flagged as autosaves.

2. **`services/api-gateway/src/handlers/console.rs`**: The `autosave` field on `CreateWorkspaceBody` and the `is_autosave` guard in `create_workspace` are now both dead code (the frontend no longer sends this flag for explicit saves). However, keep the `__autosave_*` name prefix guard in `update_workspace` as a safety net in case any legacy code path still sends autosave-prefixed names.

3. Verify: `scheduleSave` in `console/index.tsx` calls `saveDraftLocal` (localStorage only) and does NOT call `persistWorkspace`/`saveMutation`. This is already correct — do not change it. Only `handleExplicitSave` calls `persistWorkspace` → `saveMutation` → `saveWorkspace`.

### Key insight:
The architecture says autosave goes to a temp `__autosave_*` design_objects row OR localStorage. The console page was refactored to use localStorage drafts for autosave. That's fine — the important thing is that autosave does NOT update the live row. Since `scheduleSave` only calls `saveDraftLocal`, we just need to remove the `autosave: true` flag from `saveWorkspace` so explicit saves work correctly.

---

## Task C — Fix Publish to be a save first (CRITICAL)

### Architecture says (verbatim from doc):
> Publish IS a save (creates snapshot + updates live row) AND sets `published = true`.

### Current broken behavior:
- Frontend `publishMutation` calls `consoleApi.publishWorkspace(id, published)` WITHOUT first saving current in-memory state
- Backend `publish_workspace` just sets `published = true` on whatever is already in DB and snapshots the (potentially stale) DB state
- If user edits workspace, doesn't click Save, then clicks Publish → stale version gets published

### Reference pattern (graphics designer already does this correctly):
In `frontend/src/pages/designer/index.tsx`, `handlePublish`:
1. Calls `handleSave()` first (saves current in-memory doc to live row)
2. Then calls `graphicsApi.publishGraphic(currentId)`

### Fix — Frontend (`frontend/src/pages/console/index.tsx`):
Change `publishMutation` `mutationFn` to:
1. First call `consoleApi.saveWorkspace(ws)` with the current workspace state
2. Then call `consoleApi.publishWorkspace(id, published)`

Or: restructure `publishMutation` to accept `{ id, published, ws }` and call save first inside `mutationFn`.

The workspace passed to save should be the current in-memory state: `useWorkspaceStore.getState().workspaces.find(w => w.id === id)`.

When `published = false` (unpublish): no save needed, just toggle the flag.

### Fix — Backend (`services/api-gateway/src/handlers/console.rs`):
The backend `publish_workspace` handler currently:
1. Sets `published = true` on existing DB row
2. Snapshots DB state

This is fine IF the frontend saves first. But to be safe and atomic, the backend publish endpoint should accept optional workspace content in request body. If content is provided, it saves it first then publishes. If not provided (unpublish case), just toggles the flag.

**Backend approach**: Simplest fix — keep backend as-is (it saves + publishes whatever is in DB). Rely on frontend to save first. Since we control both sides, this is sufficient.

---

## Task D — Permanent Delete Confirmation Dialog

### Architecture says:
> Permanently delete | Admin only | Multi-step confirmation; audit log entry

### Current state:
- `permDeleteConfirmVersionNumber` state exists in `VersionRecoveryDialog`
- `VersionActionBar` already renders inline "Are you sure?" + "Permanently Delete" + "Cancel" buttons when `permDeleteConfirmVersionNumber === version.version_number`
- This IS a two-step confirmation already

### Assessment:
The perm delete confirmation IS implemented as a two-step flow:
1. Click "Permanently Delete…" → sets `permDeleteConfirmVersionNumber`
2. "Are you sure?" text + "Permanently Delete" + "Cancel" buttons appear inline in `VersionActionBar`

This satisfies the spec requirement for multi-step confirmation. The state is wired correctly.

**HOWEVER**: The "Permanently Delete…" button is only shown when `isDeleted` (i.e., the version has been soft-deleted). It only appears in the `isDeleted` branch of `VersionActionBar`. The spec says "no requirement for soft-delete first." But currently, a non-deleted version shows a "Delete" (soft-delete) button but no perm delete option.

**Fix**: For admin users, add a "Permanently Delete…" button in the NON-deleted branch of `VersionActionBar` as well. This allows admins to permanently delete a version directly without soft-deleting first.

The inline confirmation pattern already exists and works. Just expose the button in the non-deleted branch too.

---

## Execution Order

1. Write this file (done)
2. Plan with Opus
3. Task A: Update architecture doc (trivial, do first)
4. Task B: Fix autosave (remove `autosave: true` from `saveWorkspace`)
5. Task C: Fix publish to save first
6. Task D: Add perm delete button to non-deleted branch
7. Run `cargo clippy` + `pnpm build` to verify
8. Re-compare implementation against architecture doc

---

## Key Files

- `docs/architecture/versioning-and-publishing.md` — architecture doc (Task A)
- `frontend/src/api/console.ts` — `saveWorkspace` function (Task B)
- `services/api-gateway/src/handlers/console.rs` — `create_workspace`, `update_workspace`, `publish_workspace` (Task B, C)
- `frontend/src/pages/console/index.tsx` — `scheduleSave`, `handleExplicitSave`, `publishMutation` (Task B, C)
- `frontend/src/shared/components/versioning/VersionActionBar.tsx` — non-deleted branch (Task D)
