# Versioning Phase 8 — Integration and Polish

Final phase. Wires all backend endpoints and frontend components from Tasks 1-7 into the actual application modules. No new backend endpoints are created. No new shared components are created. This phase is pure integration — connecting existing hooks, dialogs, and API clients to the real save/publish/version-history flows in Designer, Console, and Process.

**Architecture reference:** `docs/architecture/versioning-and-publishing.md`
**Prerequisite phases:** 1-7 (schema, graphic versioning backend, workspace versioning backend, saved charts backend, frontend shared action primitives, version recovery dialog, admin toggles + audit)

---

## Current State Assessment

### What already exists (from Tasks 1-7)

| Component | File | Status |
|-----------|------|--------|
| `useObjectActions` hook | `frontend/src/shared/hooks/useObjectActions.ts` | Complete — full implementation with `onSaveOverride`/`onSaveAsOverride` extension points |
| `VersionRecoveryDialog` | `frontend/src/shared/components/versioning/VersionRecoveryDialog.tsx` | Complete — full version list, preview, stats, actions |
| `VersionHistoryDialog` (designer wrapper) | `frontend/src/pages/designer/components/VersionHistoryDialog.tsx` | Complete — wraps `VersionRecoveryDialog` for graphic type |
| `AdminToggle` component | `frontend/src/shared/components/AdminToggle.tsx` | Complete |
| `adminToggleStore` | `frontend/src/store/adminToggleStore.ts` | Complete — `showAllUsersObjects`, `showDeletedVersions` |
| `savedChartsStore` | `frontend/src/store/savedChartsStore.ts` | Complete — API-backed with localStorage migration |
| `savedChartsApi` | `frontend/src/api/savedCharts.ts` | Complete — full CRUD + publish/unpublish |
| Versioning types | `frontend/src/shared/types/versioning.ts` | Complete |
| Graphics API versioning methods | `frontend/src/api/graphics.ts` | Complete — getVersions, getVersionContent, restoreVersion, etc. |
| Console API versioning methods | `frontend/src/api/console.ts` | Complete — workspace version CRUD |
| All backend endpoints | `services/api-gateway/src/handlers/graphics.rs`, `console.rs`, `saved_charts.rs` | Complete — all routes registered in `main.rs` |
| Backend auto-save guard | `graphics.rs` line 718 | Complete — `__autosave_*` rows skip version snapshot |
| Backend advisory lock | `graphics.rs` line 221 | Complete — `pg_advisory_xact_lock` in `create_version_snapshot` |
| Save/SaveAs/Publish/Unpublish/Delete dialogs | `frontend/src/shared/components/versioning/` | Complete — all 5 dialogs |
| `useVersionList` / `useVersionActions` hooks | `frontend/src/shared/components/versioning/` | Complete |
| All migrations | `migrations/20260512000001-000006` | Complete |

### What is NOT yet wired

1. **`useObjectActions` is not imported or used in any page module.** No `grep` hits in `frontend/src/pages/`.
2. **Designer `handleSave` uses direct `graphicsApi.update()` calls** — not routed through the hook.
3. **Designer `handlePublish` uses `window.confirm()` instead of `PublishConfirmDialog`.**
4. **Console workspace save uses `saveMutation` / `persistWorkspace` directly** — not routed through the hook.
5. **Console workspace has no "Version History" option** in any context menu.
6. **Console saved charts section** already uses `savedChartsApi` via `savedChartsStore` (Task 4 complete), but has no version history.
7. **Process sidebar** has no published/unpublished indicator — but the backend `list_graphics` endpoint does NOT return `published` in its `GraphicSummary` response, so this requires a backend fix.
8. **`GraphicSummary` frontend type** (`frontend/src/shared/types/graphics.ts` line 744) is missing the `published` field.
9. **Backend `list_graphics` SQL** does not SELECT the `published` column in its query.
10. **Designer `DesignerGraphicsList.tsx`** has no published/unpublished indicator on graphic cards.

---

## Discovered Gaps from Earlier Tasks

### GAP-1: Backend `list_graphics` does not return `published`

**Location:** `services/api-gateway/src/handlers/graphics.rs` lines 372-417 (the data SQL queries)
**Issue:** The SELECT clause is `id, name, type, metadata->>'module' AS module, created_at, created_by, bindings_count`. It does not include `published`. The `GraphicSummary` struct (line 67) also lacks `published`.
**Impact:** No list view can show published status for graphics until this is fixed.
**Fix:** Add `published` to both SQL queries and the `GraphicSummary` struct.

### GAP-2: Frontend `GraphicSummary` missing `published`

**Location:** `frontend/src/shared/types/graphics.ts` line 744
**Issue:** The interface does not have `published?: boolean`.
**Fix:** Add `published?: boolean` field.

### GAP-3: Designer publish uses `window.confirm`

**Location:** `frontend/src/pages/designer/index.tsx` line 1659
**Issue:** Uses raw `window.confirm()` instead of the `PublishConfirmDialog` from Task 5.
**Fix:** Replace with dialog state + `PublishConfirmDialog` component.

### GAP-4: Backend `list_graphics_hierarchy` does not filter by published

**Location:** `services/api-gateway/src/handlers/graphics.rs` line 1966
**Issue:** The hierarchy endpoint returns all graphics in the process scope. It already has an `include_all_users` param that controls visibility, but the visibility clause does filter by published (line 1983). Verify this is working correctly.
**Fix:** Likely no fix needed — the existing visibility clause at line 1983 already filters unpublished objects for non-admin, non-owner users. Verify end-to-end.

---

## Implementation Checklist

### Phase 8.1 — Backend: Add `published` to list responses

- [ ] **8.1.1** — Add `published` field to the backend `GraphicSummary` struct in `services/api-gateway/src/handlers/graphics.rs` (line 67-78)

  ```rust
  // Add after `bindings_count`:
  pub published: bool,
  ```

- [ ] **8.1.2** — Add `published` to the SELECT clause in the `list_graphics` data SQL queries (lines 372-417). There are two SQL strings (with and without module filter). In both, add `published` to the SELECT list:

  **With module filter (line 372):**
  ```sql
  SELECT
      id, name, type,
      metadata->>'module' AS module,
      published,
      created_at, created_by,
      (SELECT count(*)::bigint FROM jsonb_object_keys(COALESCE(bindings, '{}'::jsonb)) k) AS bindings_count
  FROM design_objects
  ...
  ```

  **Without module filter (line 396):**
  Same change — add `published,` to the SELECT list.

- [ ] **8.1.3** — Add `published` field extraction in the row mapping loop (lines 451-478). After `let bindings_count` line 468, add:

  ```rust
  let published: bool = row.try_get("published").unwrap_or(false);
  ```

  And add `published,` to the `items.push(GraphicSummary { ... })` block.

- [ ] **8.1.4** — Verify `cargo build -p io-api-gateway` compiles clean.

### Phase 8.2 — Frontend: Add `published` to `GraphicSummary` type

- [ ] **8.2.1** — Edit `frontend/src/shared/types/graphics.ts` line 754 (after `version: number;`). Add:

  ```typescript
  published?: boolean;
  ```

### Phase 8.3 — Designer: Wire `useObjectActions` into save flow

The Designer page currently has its own `handleSave`, `handlePublish`, and `handleDeleteActiveGraphic` inline in the page component. The integration strategy is:

- Keep the existing `handleSave` as the primary save function (it has complex auto-save cleanup, lock re-acquisition, preview tab handling, and out-of-bounds warnings that are designer-specific).
- Use `useObjectActions` for **publish**, **unpublish**, and **delete** operations only.
- Wire `PublishConfirmDialog` to replace `window.confirm`.
- Wire the existing `VersionHistoryDialog` (already a wrapper around `VersionRecoveryDialog`).

**Why not route all saves through `useObjectActions`?** The designer's `handleSave` has 100+ lines of module-specific logic (auto-save IDB cleanup, lock cycling, preview tab handling, tab graphicId promotion for new documents). Ripping that out and passing it all through `onSaveOverride` would create a fragile, over-abstracted wrapper. The hook is designed for modules that have simpler save flows. Designer save stays as-is; the backend already auto-snapshots on every non-autosave update (line 718).

#### Files to modify

**`frontend/src/pages/designer/index.tsx`**

- [ ] **8.3.1** — Import `PublishConfirmDialog` and `UnpublishConfirmDialog` from the versioning components:

  ```typescript
  import {
    PublishConfirmDialog,
    UnpublishConfirmDialog,
  } from "../../shared/components/versioning";
  ```

- [ ] **8.3.2** — Add state for publish/unpublish confirmation dialogs. Near the existing `showVersionHistory` state (line 991), add:

  ```typescript
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);
  ```

- [ ] **8.3.3** — Replace the `handlePublish` callback (lines 1654-1684). Remove the `window.confirm` gate. The new flow:

  ```typescript
  const handlePublish = useCallback(async () => {
    const currentId = useSceneStore.getState().graphicId;
    if (!currentId || isPublishing) return;

    setIsPublishing(true);
    try {
      // Save first to ensure the snapshot captures the latest content
      await handleSave();
      const result = await graphicsApi.publishGraphic(currentId);
      if (result.success) {
        showToast({ title: "Graphic published", variant: "success", duration: 3000 });
      } else {
        showToast({
          title: "Publish failed",
          description: (result as { error: { message: string } }).error?.message ?? "Unknown error",
          variant: "error",
        });
      }
    } catch (err) {
      console.error("[DesignerPage] Publish failed:", err);
      showToast({ title: "Publish failed", variant: "error" });
    } finally {
      setIsPublishing(false);
    }
  }, [isPublishing, handleSave]);
  ```

  The confirm dialog is now handled by the button click: clicking Publish opens `showPublishConfirm`, and confirming calls `handlePublish`.

- [ ] **8.3.4** — Add an `handleUnpublish` callback:

  ```typescript
  const handleUnpublish = useCallback(async () => {
    const currentId = useSceneStore.getState().graphicId;
    if (!currentId) return;
    try {
      const result = await graphicsApi.unpublishGraphic(currentId);
      if (result.success) {
        showToast({ title: "Graphic unpublished", variant: "success", duration: 3000 });
      } else {
        showToast({ title: "Unpublish failed", variant: "error" });
      }
    } catch {
      showToast({ title: "Unpublish failed", variant: "error" });
    }
  }, []);
  ```

- [ ] **8.3.5** — Update the `DesignerToolbar` prop wiring. Change `onPublish`:

  Currently (line 3257):
  ```typescript
  onPublish={canPublish ? handlePublish : undefined}
  ```

  Change to open the confirm dialog instead of calling directly:
  ```typescript
  onPublish={canPublish ? () => setShowPublishConfirm(true) : undefined}
  ```

- [ ] **8.3.6** — Render the `PublishConfirmDialog` in the JSX, near the other dialog renders (after the existing `VersionHistoryDialog` around line 3128). Note: `PublishConfirmDialog` uses Radix Dialog with `onOpenChange`, not `onClose`. Its `onConfirm` receives `{ label?: string }`:

  ```tsx
  <PublishConfirmDialog
    open={showPublishConfirm}
    onOpenChange={setShowPublishConfirm}
    objectName={doc?.name ?? "Untitled"}
    onConfirm={() => {
      setShowPublishConfirm(false);
      void handlePublish();
    }}
  />
  ```

- [ ] **8.3.7** — (Optional but recommended) Add an Unpublish button to the toolbar or the mode tabs menu. This can be added as a toolbar item visible only when the graphic is already published. However, since the frontend `GraphicSummary` list view type now has `published`, the toolbar would need to know the current graphic's published state. For now, add "Unpublish" as an item in the `DesignerModeTabs` File menu, next to "Version History". This is lower priority and can be deferred if complex.

#### Files to modify (DesignerToolbar)

No changes needed to `DesignerToolbar.tsx` itself — it already accepts `onPublish`, `isPublishing`, `onShowVersionHistory` props and renders them correctly. The publish button and version history button are already wired.

### Phase 8.4 — Designer Graphics List: Published badge

- [ ] **8.4.1** — Edit `frontend/src/pages/designer/DesignerGraphicsList.tsx`. In the `GraphicCard` component (line 287), add a published badge next to the scope/mode badges. After the mode badge `<span>` (around line 420), add:

  ```tsx
  {graphic.published && (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 4,
        background: "rgba(16,185,129,0.15)",
        color: "#10b981",
      }}
    >
      Published
    </span>
  )}
  ```

### Phase 8.5 — Console: Wire workspace version history

The Console module already has full workspace save/publish/unpublish/delete wired through `saveMutation`, `publishMutation`, `deleteActiveWorkspace`, etc. These use direct API calls via `consoleApi`. The `useObjectActions` hook is NOT needed here — the Console's workspace management is more complex (multi-workspace tabs, draft local save, dirty tracking, close-and-save flows) and is already fully functional.

What IS missing: a "Version History" option in the workspace context menus.

#### Files to modify

**`frontend/src/pages/console/index.tsx`**

- [ ] **8.5.1** — Import `VersionRecoveryDialog`:

  ```typescript
  import { VersionRecoveryDialog } from "../../shared/components/versioning/VersionRecoveryDialog";
  ```

  Also import `useWorkspaceStore` `loadGraphic` equivalent — actually, the Console needs to handle `onLoadVersion` by replacing the active workspace's layout. Import the types:

  ```typescript
  import type { WorkspaceVersionContent } from "../../shared/types/versioning";
  ```

- [ ] **8.5.2** — Add state for the version history dialog. Near the existing state declarations (around line 500-550), add:

  ```typescript
  const [versionHistoryWorkspaceId, setVersionHistoryWorkspaceId] = useState<string | null>(null);
  ```

- [ ] **8.5.3** — Add a handler for loading a version into the current workspace:

  ```typescript
  const handleLoadWorkspaceVersion = useCallback(
    (content: WorkspaceVersionContent | unknown) => {
      const vc = content as WorkspaceVersionContent;
      if (!vc.layout || !activeId) return;
      // Parse the version's layout data and apply it to the active workspace
      const layoutData = vc.layout as {
        layout?: string;
        panes?: PaneConfig[];
        gridItems?: GridItem[];
        overflowPanes?: PaneConfig[];
      };
      const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId);
      if (!ws) return;
      const updated: WorkspaceLayout = {
        ...ws,
        layout: (layoutData.layout as LayoutPreset) ?? ws.layout,
        panes: layoutData.panes ?? ws.panes,
        gridItems: layoutData.gridItems ?? ws.gridItems,
        overflowPanes: layoutData.overflowPanes ?? ws.overflowPanes,
      };
      setWorkspaces(
        useWorkspaceStore.getState().workspaces.map((w) =>
          w.id === activeId ? updated : w,
        ),
      );
      showToast({ title: "Version restored", variant: "success", duration: 3000 });
    },
    [activeId, setWorkspaces],
  );
  ```

- [ ] **8.5.4** — Add "Version History" to the workspace tab context menu. In the tab context menu items array (around line 3236-3316), add a new item after "Duplicate":

  ```typescript
  {
    label: "Version History",
    onClick: () => {
      setVersionHistoryWorkspaceId(ws.id);
      setTabContextMenu(null);
    },
  },
  ```

- [ ] **8.5.5** — Add "Version History" to the workspace background context menu (around lines 3129-3183). Add a new item:

  ```typescript
  {
    label: "Version History",
    onClick: () => {
      setWorkspaceBgCtxMenu(null);
      if (activeId) setVersionHistoryWorkspaceId(activeId);
    },
  },
  ```

- [ ] **8.5.6** — Render the `VersionRecoveryDialog` in JSX (after the existing dialogs, around line 3222):

  ```tsx
  {versionHistoryWorkspaceId && (
    <VersionRecoveryDialog
      open={!!versionHistoryWorkspaceId}
      onClose={() => setVersionHistoryWorkspaceId(null)}
      objectType="workspace"
      objectId={versionHistoryWorkspaceId}
      objectName={
        workspaces.find((w) => w.id === versionHistoryWorkspaceId)?.name
      }
      onLoadVersion={handleLoadWorkspaceVersion}
    />
  )}
  ```

### Phase 8.6 — Console: Workspace selector published indicator

The Console already shows "Published" / "Publish" button in the toolbar header (lines 2222-2254) and in the tab context menu (lines 3292-3304). The workspace tab rendering should also show a visual indicator.

- [ ] **8.6.1** — In the workspace tab bar rendering, add a small published dot next to the workspace name. The tab rendering is at line ~1967 in `frontend/src/pages/console/index.tsx`, inside a `.map((ws) => ...)` block. The workspace name is rendered as `{ws.name}` at line 1967, followed by a dirty indicator dot. Add a published dot BEFORE the name text:

  Change the button content from:
  ```tsx
  {ws.name}
  {wsIsDirty && ( <span ... /> )}
  ```

  To:
  ```tsx
  {ws.published && (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "#10b981",
        display: "inline-block",
        flexShrink: 0,
      }}
      title="Published"
    />
  )}
  {ws.name}
  {wsIsDirty && ( <span ... /> )}
  ```

  The exact location is inside the `<button>` element at line 1946-1981 in `frontend/src/pages/console/index.tsx`.

### Phase 8.7 — Console: Saved charts integration verification

The saved charts section in `ConsolePalette.tsx` is already fully integrated:
- Charts load from `savedChartsApi` via `savedChartsStore` (lines 1187-1207)
- Published/Personal split is working (lines 1210-1211)
- Publish/Unpublish via context menu is working (lines 1413-1414)
- Migration banner is working (lines 1240-1259)
- Admin toggle "All users" is working (lines 1232-1238)

- [ ] **8.7.1** — Verify that `savedChartsStore.fetchCharts()` is called on initial console load. Currently it is called in the `ChartsSection` component `useEffect` (line 1200). This is correct — charts are fetched lazily when the Charts accordion section mounts.

- [ ] **8.7.2** — Verify that the migration banner appears when `migrationPending` is true and that clicking "Migrate" successfully copies localStorage charts to the database. This is a manual test.

- [ ] **8.7.3** — Verify there is NO remaining localStorage read/write in the saved charts hot path. The `savedChartsStore` (lines 67-79) still reads `localStorage.getItem("io_saved_charts")` to check for migration pending, but this is read-only and only on initial fetch when the API returns zero charts. This is correct behavior — it does not WRITE to localStorage except during `migrateFromLocalStorage` (which removes the key at the end).

### Phase 8.8 — Process: Verify published flag filtering

The Process module sidebar shows graphics filtered by `scope=process`. The backend's `list_graphics` endpoint already applies a visibility clause (line 329):
```sql
AND (created_by = '{user_id}' OR COALESCE(published, false) = true)
```

This means non-admin users can only see graphics they own OR graphics that are published. This is correct behavior.

The Process page uses two separate API calls:
- **Flat list:** `graphicsApi.list({ scope: "process", includeAllUsers: showAllUsers })` — called in `index.tsx` line 700, passed as `graphicsList` prop to `ProcessSidebar`
- **Hierarchy tree:** `graphicsApi.getHierarchy({ includeAllUsers: showAllUsers })` — called inside `ProcessSidebar`'s `NavigationTree` component

Both endpoints apply published-based visibility filtering on the backend.

- [ ] **8.8.1** — Verify the `list_graphics` endpoint's visibility clause works correctly for Process. Since the clause `AND (created_by = '{user_id}' OR COALESCE(published, false) = true)` is already applied, unpublished graphics from other users are hidden. No code change needed.

- [ ] **8.8.2** — Verify the `list_graphics_hierarchy` endpoint also applies the same visibility clause. Check `services/api-gateway/src/handlers/graphics.rs` line 1966+. The hierarchy endpoint at line 1983 uses the same `AND (created_by = '{}' OR COALESCE(published, false) = true)` clause. This is correct.

- [ ] **8.8.3** — Verify that Process always renders from the live `design_objects` row, NOT from a version table. The Process page (`index.tsx` line ~780) fetches via `graphicsApi.get(selectedId)` which reads from `design_objects` directly. No version table involvement. This is correct per the architecture doc.

### Phase 8.9 — Auto-save regression verification

These are manual verification steps, not code changes.

- [ ] **8.9.1** — Verify auto-save still works silently. Open a graphic in the Designer, make edits, wait for the auto-save interval. Confirm:
  - An `__autosave_*` row is created in `design_objects`
  - NO entry appears in `design_object_versions` for the auto-save row (backend guard at line 718: `if !row_name.starts_with("__autosave_")`)
  - The auto-save row does NOT appear in the Designer graphics list (backend filter: `name NOT LIKE '__autosave_%'`)

- [ ] **8.9.2** — Verify auto-save recovery flow. Force-close the browser tab during editing, reopen. Confirm:
  - The crash recovery dialog appears
  - "Restore" opens the recovered content in a preview tab
  - "Discard" deletes both the IDB record and the server `__autosave_*` row

- [ ] **8.9.3** — Verify explicit save deletes the auto-save. After triggering auto-save, do Ctrl+S. Confirm:
  - The `__autosave_*` server row is deleted (line 1384-1392 in index.tsx)
  - The IDB record is deleted (line 1393-1399)
  - A version snapshot IS created for the explicit save (backend auto-snapshots non-autosave updates)

- [ ] **8.9.4** — Verify `__autosave_*` rows never appear in:
  - Designer graphics list (DesignerGraphicsList.tsx)
  - Console palette graphics section
  - Process sidebar graphics list
  - Version history dialog

### Phase 8.10 — Edge case verification

- [ ] **8.10.1** — Save As from a published graphic. Open a published graphic, use Save As (if the designer has a Save As flow — check `DesignerModeTabs`). Confirm the new copy has `published = false`.

  **Note:** The Designer currently creates new graphics via `graphicsApi.create()` which defaults `published` to `false` (the DB column default). Save As in the Console (`handleSaveAsPersonal`) explicitly sets `published: false` (line 939). This should be correct.

- [ ] **8.10.2** — Restore a version. Open version history for a graphic, select a version, click "Load in current view". Confirm:
  - The restored content is loaded into the editor
  - Saving afterwards creates a new version at the top of the stack (the backend's `restore_version` handler creates a new version with `parent_version_number` set to the restored version)

- [ ] **8.10.3** — Delete the only published graphic in Process scope. Confirm:
  - Process sidebar no longer shows the graphic (it was deleted from `design_objects`)
  - If Process was rendering that graphic, the render shows an error/empty state (not a crash)

- [ ] **8.10.4** — Concurrent saves. Open the same graphic in two browser tabs (if lock allows — it should block the second tab). Verify the advisory lock prevents version_number collision. In practice, the pessimistic edit lock prevents this scenario, but the advisory lock is a safety net.

### Phase 8.11 — Cleanup: Dead code removal

- [ ] **8.11.1** — Verify `frontend/src/api/graphics.ts` has no dead stubs. Check all functions in `graphicsApi`. In the current state, all version-related functions (getVersions, getVersionContent, restoreVersion, softDeleteVersion, recoverVersion, permanentDeleteVersion, updateVersionLabel, publishGraphic, unpublishGraphic) are real API calls, not 404-returning stubs. **No cleanup needed.**

- [ ] **8.11.2** — Verify `frontend/src/pages/designer/components/VersionHistoryDialog.tsx` is the new wrapper, not the old empty shell. Current state: it imports and renders `VersionRecoveryDialog` from the shared versioning components. **Already replaced. No cleanup needed.**

- [ ] **8.11.3** — Verify `frontend/src/store/savedChartsStore.ts` no longer writes to localStorage in the normal save path. The `saveChart` method (line 88) calls `savedChartsApi.update()` or `savedChartsApi.create()` — no localStorage writes. The only localStorage interaction is the migration detection in `fetchCharts` (read-only) and `migrateFromLocalStorage` (which removes the key). **Already clean. No cleanup needed.**

- [ ] **8.11.4** — Search for any unused imports introduced by earlier phases:

  ```bash
  cd frontend && pnpm build 2>&1 | grep "is declared but"
  ```

  Fix any unused import warnings.

### Phase 8.12 — Compile and build verification

- [ ] **8.12.1** — Backend build:

  ```bash
  BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build -p io-api-gateway
  ```

- [ ] **8.12.2** — Backend lint:

  ```bash
  cargo clippy -p io-api-gateway -- -D warnings
  ```

- [ ] **8.12.3** — Frontend build:

  ```bash
  cd frontend && pnpm build
  ```

- [ ] **8.12.4** — Frontend tests (if they exist for affected components):

  ```bash
  cd frontend && pnpm test
  ```

---

## Detailed File Change Summary

### Backend files to modify

| File | Change |
|------|--------|
| `services/api-gateway/src/handlers/graphics.rs` | Add `published: bool` to `GraphicSummary` struct; add `published` to both `list_graphics` SQL queries; add `published` extraction in row mapping |

### Frontend files to modify

| File | Change |
|------|--------|
| `frontend/src/shared/types/graphics.ts` | Add `published?: boolean` to `GraphicSummary` interface |
| `frontend/src/pages/designer/index.tsx` | Import `PublishConfirmDialog`; add publish/unpublish confirm dialog state; replace `window.confirm` in `handlePublish`; add `handleUnpublish`; render `PublishConfirmDialog`; update `onPublish` prop to open dialog |
| `frontend/src/pages/designer/DesignerGraphicsList.tsx` | Add published badge to `GraphicCard` component |
| `frontend/src/pages/console/index.tsx` | Import `VersionRecoveryDialog` and types; add `versionHistoryWorkspaceId` state; add `handleLoadWorkspaceVersion` callback; add "Version History" to tab context menu and background context menu; render dialog; add published dot to workspace tabs |

### Frontend files that need NO changes (already complete)

| File | Why |
|------|-----|
| `frontend/src/api/graphics.ts` | All versioning API methods already implemented |
| `frontend/src/api/console.ts` | All workspace versioning API methods already implemented |
| `frontend/src/api/savedCharts.ts` | Full CRUD + publish/unpublish already implemented |
| `frontend/src/store/savedChartsStore.ts` | API-backed store with migration already implemented |
| `frontend/src/store/adminToggleStore.ts` | Complete |
| `frontend/src/shared/components/AdminToggle.tsx` | Complete |
| `frontend/src/shared/hooks/useObjectActions.ts` | Complete (not directly used by Designer/Console, but available for simpler modules) |
| `frontend/src/shared/components/versioning/*` | All dialogs and hooks complete |
| `frontend/src/pages/designer/components/VersionHistoryDialog.tsx` | Already wraps `VersionRecoveryDialog` |
| `frontend/src/pages/designer/DesignerToolbar.tsx` | Already accepts all needed props |
| `frontend/src/pages/console/ConsolePalette.tsx` | Charts section already fully integrated |
| `frontend/src/pages/console/PaneWrapper.tsx` | No versioning-related changes needed |
| `frontend/src/pages/process/index.tsx` | No changes needed — rendering reads from live `design_objects`, visibility filtering is backend-side |
| `frontend/src/pages/process/ProcessSidebar.tsx` | No changes needed — hierarchy and list filtering is backend-side |

---

## Execution Order

Execute in this order to minimize compile/build issues:

1. **Phase 8.1** — Backend `list_graphics` published field (compile backend)
2. **Phase 8.2** — Frontend `GraphicSummary` type update
3. **Phase 8.3** — Designer publish confirm dialog wiring
4. **Phase 8.4** — Designer graphics list published badge
5. **Phase 8.5** — Console workspace version history
6. **Phase 8.6** — Console workspace tab published indicator
7. **Phase 8.7** — Console saved charts verification (manual, no code changes expected)
8. **Phase 8.8** — Process module verification (manual, no code changes expected)
9. **Phase 8.11** — Cleanup pass
10. **Phase 8.12** — Full build verification
11. **Phases 8.9, 8.10** — Manual regression testing (after build passes)

---

## What This Phase Does NOT Do

- Does not route Designer save through `useObjectActions` (the hook's `onSaveOverride` mechanism exists for this, but Designer's save is too complex for the abstraction to add value)
- Does not route Console workspace save through `useObjectActions` (same reason — Console has its own multi-workspace save/draft/dirty tracking)
- Does not add version history to saved charts (the architecture doc marks chart versioning as "optional in first pass" — `saved_chart_versions` table does not exist)
- Does not change the auto-save mechanism in any way
- Does not add new backend endpoints
- Does not create new migrations
