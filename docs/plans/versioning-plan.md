# Versioning and Publishing Plan — Phase Index

Eight planning tasks. Each task, when triggered, launches an Opus planning agent that reads this file plus the architecture doc and produces a detailed phased implementation plan for a Sonnet-class agent to execute.

**Architecture doc:** `docs/architecture/versioning-and-publishing.md` (the single source of truth for all design decisions)

**Kickoff pattern:**
```
read docs/plans/versioning-plan.md and kick off planning task N
```
Change `N` to the next task number. The Opus agent reads this file, reads the architecture doc, explores relevant code, and produces `docs/plans/versioning-phase-N-plan.md`. Then:
```
read docs/plans/versioning-phase-N-plan.md and implement it
```

Tasks must be executed in order. Each task depends on the ones before it.

---

## Task Table

| Task | Name | Summary | Depends On |
|------|------|---------|------------|
| 1 | Schema Foundation | All database migrations + iographic.rs bug fix | -- |
| 2 | Graphic Versioning Backend | Version CRUD endpoints, publish/unpublish, auto-snapshot on save | Task 1 |
| 3 | Workspace Versioning Backend | Same pattern as Task 2 but for workspaces | Tasks 1, 2 |
| 4 | Standalone Charts Backend | saved_charts table API, migrate from localStorage | Task 1 |
| 5 | Frontend Shared Action Primitives | useObjectActions hook, Save/SaveAs/Publish/Unpublish/Delete dialogs | Tasks 2, 3 |
| 6 | Version Recovery Dialog | Full version picker/recovery modal with preview, stats, all actions | Task 5 |
| 7 | Admin Toggles + Audit | Admin filter toggles across all views, permanent delete with audit | Tasks 5, 6 |
| 8 | Integration + Polish | Wire everything together, regression test auto-save, replace VersionHistoryDialog | Tasks 5, 6, 7 |

---

## Task 1 — Schema Foundation

All database migrations. The iographic.rs bug fix commit. No frontend changes, no new API handlers.

**Reads:**
- `docs/architecture/versioning-and-publishing.md` (Schema Design section)
- `migrations/20260314000009_graphics_workspaces.up.sql` (existing design_object_versions schema)
- `migrations/20260319000002_graphic_assets.up.sql` (reference for migration numbering)
- `services/api-gateway/src/handlers/iographic.rs` (~line 3051, the existing bug fix)
- Latest migration files in `migrations/` directory (for timestamp numbering)

**Produces:** `docs/plans/versioning-phase-1-plan.md`

**Prompt:**

You are planning the schema foundation for the I/O versioning and publishing system. Read `docs/architecture/versioning-and-publishing.md` for the full design context.

Your job is to produce a detailed, step-by-step implementation plan at `docs/plans/versioning-phase-1-plan.md` that a Sonnet-class implementation agent can execute cold.

This phase covers ALL database migrations and one existing bug fix:

1. **Migration: add `published` column to `design_objects`**
   - `ALTER TABLE design_objects ADD COLUMN published BOOLEAN NOT NULL DEFAULT false`
   - Partial index: `CREATE INDEX idx_design_objects_published ON design_objects(published) WHERE published = true`

2. **Migration: add version metadata columns to `design_object_versions`**
   - `ALTER TABLE design_object_versions ADD COLUMN deleted_at TIMESTAMPTZ`
   - `ALTER TABLE design_object_versions ADD COLUMN label TEXT`
   - `ALTER TABLE design_object_versions ADD COLUMN parent_version_number INTEGER`

3. **Migration: create `workspace_versions` table**
   - Full DDL is in the architecture doc (Schema Design section)
   - Must reference `workspaces(id)` and `users(id)` FKs
   - Unique constraint on `(workspace_id, version_number)`

4. **Migration: create `saved_charts` table**
   - Full DDL is in the architecture doc (Schema Design section)
   - Indexes on `created_by` and partial on `published`

5. **Bug fix: `services/api-gateway/src/handlers/iographic.rs` ~line 3051**
   - The INSERT into `design_object_versions` uses wrong column names (`graphic_id`, `version`) and is missing `svg_data` (NOT NULL)
   - Fix to use (`design_object_id`, `version_number`, `svg_data`)
   - This fix already exists in the working tree — verify it compiles clean and include it in this phase's commit

Look at the existing migration files to determine the correct timestamp prefix for new migrations. Look at the existing table schemas to verify FK targets exist. Check the iographic.rs bug fix to confirm it's already applied and just needs to be committed.

The plan must include:
- Exact file paths for every file created or modified
- The migration SQL (up and down)
- Verification steps (run migrations, check tables exist, compile check for iographic.rs)
- A checklist the implementation agent can tick off

No frontend changes. No new API handlers. Schema only.

---

## Task 2 — Graphic Versioning Backend

All new and modified API endpoints for graphic versioning.

**Reads:**
- `docs/architecture/versioning-and-publishing.md` (full document)
- `services/api-gateway/src/handlers/graphics.rs` (existing publish handler lines 595-671, existing update handler)
- `services/api-gateway/src/main.rs` (route registration)
- `frontend/src/api/graphics.ts` (API stubs for reference on expected endpoints)
- `migrations/20260314000009_graphics_workspaces.up.sql` (table schema)
- `services/api-gateway/src/handlers/iographic.rs` (reference for version snapshot creation pattern)

**Produces:** `docs/plans/versioning-phase-2-plan.md`

**Prompt:**

You are planning the graphic versioning backend for the I/O versioning and publishing system. Read `docs/architecture/versioning-and-publishing.md` for the full design context. Task 1 (schema migrations) is assumed complete.

Your job is to produce a detailed implementation plan at `docs/plans/versioning-phase-2-plan.md`.

This phase covers ALL backend API work for design_objects versioning:

1. **Update the publish handler** (`graphics.rs` ~line 595): Must set `published = true` on the `design_objects` row AND create a version snapshot with `version_type = 'publish'`. Currently it only creates a version without setting the published flag.

2. **Add unpublish handler**: `POST /api/v1/design-objects/:id/unpublish` — sets `published = false`. Creator or admin only. Requires `designer:publish` permission.

3. **Update the save/update handler**: When a design_object is updated (saved), auto-create a version snapshot. Must:
   - Use advisory lock: `pg_advisory_xact_lock(hashtext(design_object_id::text))` to prevent version_number races
   - Guard against `__autosave_*` rows — NEVER create version snapshots for auto-save rows
   - Compute stats at save time (element_count from scene_data node count, binding_count from point bindings) and store in version `metadata JSONB`
   - Set `parent_version_number` to the current max version_number for this object
   - Auto-label v1 as "Original"
   - Accept optional `label` parameter for user notes

4. **Add list versions endpoint**: `GET /api/v1/design-objects/:id/versions` — returns version list with stats, label, version_type, parent_version_number. Excludes soft-deleted versions by default. Optional `include_deleted=true` query param (admin only).

5. **Add get version content endpoint**: `GET /api/v1/design-objects/:id/versions/:version_number` — returns full version snapshot content.

6. **Add restore version endpoint**: `POST /api/v1/design-objects/:id/versions/:version_number/restore` — loads version content into the live `design_objects` row and creates a new version snapshot at the top of the stack with `parent_version_number` pointing to the restored version.

7. **Add soft-delete version endpoint**: `DELETE /api/v1/design-objects/:id/versions/:version_number` — sets `deleted_at`. Creator or admin only.

8. **Add recover version endpoint (admin only)**: `POST /api/v1/design-objects/:id/versions/:version_number/recover` — clears `deleted_at`.

9. **Add permanent delete endpoint (admin only)**: `DELETE /api/v1/design-objects/:id/versions/:version_number/permanent` — hard deletes the row. Writes audit log entry.

10. **Update GET design_object endpoint**: Return `published` field in the response.

11. **Register all new routes** in `main.rs`.

12. **Update version label**: `PATCH /api/v1/design-objects/:id/versions/:version_number` — updates the `label` field. Creator or admin only.

Explore the existing handler code to understand patterns (error handling, auth extraction, response envelope). The plan must follow existing code patterns exactly. Include exact file paths, handler function signatures, route registrations, and SQL queries.

---

## Task 3 — Workspace Versioning Backend

Same pattern as Task 2 but for workspaces.

**Reads:**
- `docs/architecture/versioning-and-publishing.md`
- `docs/plans/versioning-phase-2-plan.md` (the graphic versioning plan, for pattern reference)
- `services/api-gateway/src/handlers/` (look for workspace handlers)
- `services/api-gateway/src/main.rs` (workspace route registration)
- `migrations/20260314000009_graphics_workspaces.up.sql` (workspaces table schema)

**Produces:** `docs/plans/versioning-phase-3-plan.md`

**Prompt:**

You are planning the workspace versioning backend for the I/O versioning and publishing system. Read `docs/architecture/versioning-and-publishing.md` for full design context. Tasks 1-2 are assumed complete. Read `docs/plans/versioning-phase-2-plan.md` to understand the pattern established for graphic versioning — workspace versioning follows the exact same pattern.

Your job is to produce `docs/plans/versioning-phase-3-plan.md`.

This phase covers ALL backend API work for workspace versioning using the `workspace_versions` table created in Task 1:

1. **Workspace save/update handler update**: On workspace save, auto-create a version snapshot in `workspace_versions`. Advisory lock on workspace_id. Guard against any auto-save rows. Compute stats (pane count from layout JSONB). Store stats in `metadata`. Set `parent_version_number`. Accept optional `label`.

2. **Workspace publish/unpublish handlers**: Workspaces already have a `published` column. Add handlers to set/unset it. Publish creates a version snapshot with `version_type = 'publish'`.

3. **List workspace versions**: `GET /api/v1/workspaces/:id/versions`

4. **Get workspace version content**: `GET /api/v1/workspaces/:id/versions/:version_number`

5. **Restore workspace version**: `POST /api/v1/workspaces/:id/versions/:version_number/restore`

6. **Soft-delete, recover, permanent delete workspace versions**: Same pattern as graphics.

7. **Update version label**: `PATCH /api/v1/workspaces/:id/versions/:version_number`

8. **Register all new routes in main.rs**.

Follow the exact same patterns, error handling, and code structure established in Task 2 for graphics. The plan must be detailed enough for a cold implementation agent.

---

## Task 4 — Standalone Charts Backend

Create the saved_charts table API and migrate the frontend store from localStorage to the database.

**Reads:**
- `docs/architecture/versioning-and-publishing.md`
- `frontend/src/store/savedChartsStore.ts` (current localStorage implementation)
- `frontend/src/api/` (API client patterns)
- `services/api-gateway/src/handlers/` (handler patterns)
- `services/api-gateway/src/main.rs` (route patterns)

**Produces:** `docs/plans/versioning-phase-4-plan.md`

**Prompt:**

You are planning the standalone charts backend and localStorage migration for the I/O versioning and publishing system. Read `docs/architecture/versioning-and-publishing.md` for full design context. Task 1 (schema) is assumed complete — the `saved_charts` table already exists.

Your job is to produce `docs/plans/versioning-phase-4-plan.md`.

This phase covers:

1. **CRUD endpoints for saved_charts**:
   - `POST /api/v1/saved-charts` — create a saved chart
   - `GET /api/v1/saved-charts` — list saved charts (user's own + published; admin toggle for all users')
   - `GET /api/v1/saved-charts/:id` — get a single saved chart
   - `PUT /api/v1/saved-charts/:id` — update a saved chart
   - `DELETE /api/v1/saved-charts/:id` — soft-delete a saved chart

2. **Publish/unpublish endpoints**:
   - `POST /api/v1/saved-charts/:id/publish`
   - `POST /api/v1/saved-charts/:id/unpublish`

3. **Backend handler implementation** following existing patterns in the codebase.

4. **Route registration** in main.rs.

5. **Frontend migration**: Update `savedChartsStore.ts` to call the new API instead of using localStorage/Zustand persist. The store should:
   - Fetch charts from the API on initialization
   - Save/update/delete via API calls
   - Remove the Zustand `persist` middleware (no more localStorage)
   - Handle the transition gracefully: on first load, if localStorage has saved charts and the API returns none, offer to migrate them (one-time migration flow)

6. **Frontend API client**: Add `frontend/src/api/savedCharts.ts` with typed API functions matching the endpoint pattern used elsewhere in `frontend/src/api/`.

Note: Chart versioning (a `saved_chart_versions` table) is optional for the first pass. Focus on getting charts into the database and removing localStorage dependency. The architecture doc marks versioning as "future" for charts.

Explore the existing `savedChartsStore.ts` to understand the current data model, what fields are stored, and how the store is consumed across the application. The migration must preserve all existing functionality.

---

## Task 5 — Frontend Shared Action Primitives

The shared hook and dialogs used by all modules for Save / Save As / Publish / Unpublish / Delete.

**Reads:**
- `docs/architecture/versioning-and-publishing.md` (Universal Operations section)
- `frontend/src/api/graphics.ts` (API functions)
- `frontend/src/pages/designer/index.tsx` (current save flow, auto-save ~line 985+)
- `frontend/src/pages/designer/components/VersionHistoryDialog.tsx` (existing shell)
- `frontend/src/components/` (existing dialog/modal patterns)
- `frontend/src/hooks/` (existing hook patterns)
- `frontend/src/store/` (auth store for RBAC checks)

**Produces:** `docs/plans/versioning-phase-5-plan.md`

**Prompt:**

You are planning the frontend shared action primitives for the I/O versioning and publishing system. Read `docs/architecture/versioning-and-publishing.md` for full design context. Tasks 1-4 (all backend work) are assumed complete — all API endpoints exist.

Your job is to produce `docs/plans/versioning-phase-5-plan.md`.

This phase creates the shared frontend infrastructure that all modules will use:

1. **`useObjectActions` hook** — a generic hook that provides Save / Save As / Publish / Unpublish / Delete operations for any saveable object type. It should:
   - Accept the object type ('graphic' | 'workspace' | 'chart'), object ID, and callbacks
   - Call the appropriate API endpoints based on object type
   - Handle RBAC checks (check user permissions before enabling actions)
   - Return action functions + loading/error state
   - Handle the auto-save guard (never trigger version snapshot logic for `__autosave_*` objects)

2. **Save confirmation dialog** — modal with:
   - "Save all changes?" message
   - Optional notes/label text field (inline, not a separate step)
   - Save / Cancel buttons
   - Used by module top-bar save buttons (Designer Save button, etc.)

3. **Save As dialog** — modal with:
   - Text input for new object name
   - Optional notes/label field
   - Save As / Cancel buttons

4. **Publish confirmation dialog** — modal with:
   - Clear explanation of what publishing means (makes visible to all users)
   - Optional notes/label field
   - Publish / Cancel buttons

5. **Unpublish confirmation dialog** — modal with:
   - Warning that the object will only be visible to the creator
   - Unpublish / Cancel buttons

6. **Delete confirmation dialog** — modal with:
   - Warning about soft-delete
   - Delete / Cancel buttons

Explore existing dialog and modal patterns in the codebase to match the established UI conventions. Look at how the designer currently handles save to understand the existing flow that needs to be refactored. The hook and dialogs must be generic enough to work across designer, console (workspaces), and chart config contexts.

All components should be in a shared location (e.g., `frontend/src/components/versioning/` or similar, following existing conventions).

---

## Task 6 — Version Recovery Dialog

The full-featured version picker/recovery modal.

**Reads:**
- `docs/architecture/versioning-and-publishing.md` (Recovery Dialog section)
- `docs/plans/versioning-phase-5-plan.md` (shared primitives plan)
- `frontend/src/pages/designer/components/VersionHistoryDialog.tsx` (existing shell to replace)
- `frontend/src/api/graphics.ts` (version API functions)
- `frontend/src/components/` (existing modal/dialog patterns, table/list patterns)

**Produces:** `docs/plans/versioning-phase-6-plan.md`

**Prompt:**

You are planning the version recovery dialog for the I/O versioning and publishing system. Read `docs/architecture/versioning-and-publishing.md` for full design context (especially the "Recovery / Version Picker Dialog" section). Task 5 (shared action primitives) is assumed complete.

Your job is to produce `docs/plans/versioning-phase-6-plan.md`.

This phase implements the full version recovery dialog — a modal panel that replaces the existing empty `VersionHistoryDialog.tsx` shell:

1. **Version list panel** (left side or top):
   - Scrollable list of version entries showing version number, date/time, version_type indicator
   - Publish checkpoints visually distinguished (badge, icon, or color) from regular saves
   - Filter controls: date range picker, type filter (save/publish/all), text search on label/notes
   - Notes visible on hover tooltip; click to edit inline
   - Selected version highlighted

2. **Preview panel** (right side or bottom):
   - When a version is selected, loads and displays a preview of that version's content
   - For graphics: render a read-only preview of the SVG/scene
   - For workspaces: show layout structure
   - Loading state while content is fetched

3. **Stats panel** (sidebar or overlay on selected version):
   - Version number
   - Date/time (formatted)
   - element_count, binding_count
   - Parent version display: "Previous: vN" (clickable to jump to that version)
   - Label text (editable)

4. **Action buttons** (on selected version):
   - Load in current view — replaces current working content; user is warned that unsaved changes will be lost
   - Open in new tab — opens version content in the appropriate module
   - Save As — opens the Save As dialog from Task 5; forks to new object
   - Publish — uses the Publish dialog from Task 5
   - Delete — soft-delete this version entry

5. **Admin-only section** (visible when user has admin role):
   - "Show deleted" toggle — reveals soft-deleted versions (grayed out / strikethrough)
   - Recover button on deleted versions — clears deleted_at
   - Permanently delete button — multi-step confirmation (click -> "Are you sure?" -> click again)

6. **Integration points**:
   - The dialog accepts object type and object ID as props
   - It calls the appropriate version list/content/action APIs based on object type
   - Wire it into designer (replace VersionHistoryDialog import), console (workspace context menu), and chart config (settings menu)

Explore the existing `VersionHistoryDialog.tsx` to understand where it's imported and how it's triggered. The new component should be a drop-in replacement. Look at existing modal/dialog patterns in the codebase for consistent styling.

---

## Task 7 — Admin Toggles + Audit

Admin filter toggles wired across all list/search views. Permanent delete audit logging.

**Reads:**
- `docs/architecture/versioning-and-publishing.md` (Admin capabilities section)
- `frontend/src/pages/` (all pages that have list/search/library views)
- `frontend/src/store/` (auth store for admin role check)
- `services/api-gateway/src/handlers/` (handlers that list objects)
- Backend audit logging patterns (if any exist)

**Produces:** `docs/plans/versioning-phase-7-plan.md`

**Prompt:**

You are planning the admin toggles and audit logging for the I/O versioning and publishing system. Read `docs/architecture/versioning-and-publishing.md` for full design context. Tasks 1-6 are assumed complete.

Your job is to produce `docs/plans/versioning-phase-7-plan.md`.

This phase adds two cross-cutting admin features:

1. **"Show all users' objects" toggle**:
   - A toggle control visible only to admin users
   - When OFF (default): user sees only their own unpublished objects + all published objects (normal behavior)
   - When ON: admin sees ALL objects including other users' unpublished objects
   - Must appear in every list/search/library view across the application:
     - Designer graphic library / open dialog
     - Console workspace selector
     - Console saved charts palette
     - Process graphic selector
     - Any other object picker dialogs
   - Backend: list endpoints must accept an `include_all_users=true` query param; must verify admin role server-side

2. **"Show deleted objects" toggle**:
   - A toggle control visible only to admin users
   - When OFF (default): soft-deleted versions are hidden
   - When ON: soft-deleted versions appear (visually distinct — grayed out, strikethrough, or similar)
   - Appears in the version recovery dialog (Task 6 already has the UI slot for this)
   - Backend: version list endpoints already support `include_deleted=true` from Task 2

3. **Toggle state management**:
   - Store toggle state in a lightweight frontend store (Zustand or React context)
   - Persist across page navigation within a session
   - Do NOT persist to localStorage or database — resets on page refresh (safe default)

4. **Permanent delete audit logging**:
   - When an admin permanently deletes a version, write an audit log entry
   - Determine if an audit log table already exists in the schema; if so, use it; if not, create a minimal one
   - Log entry must include: admin user ID, object type, object ID, version number, timestamp, action type
   - This is server-side only — no frontend audit log viewer in this phase

Explore the codebase to find every list/search/library/picker view that shows saveable objects. The plan must enumerate each view and describe exactly where the toggle appears in the UI. Check for existing audit log infrastructure.

---

## Task 8 — Integration + Polish

Wire all pieces together. Regression testing. Replace stubs with real implementations.

**Reads:**
- `docs/architecture/versioning-and-publishing.md`
- All previous phase plans (`docs/plans/versioning-phase-{1..7}-plan.md`)
- `frontend/src/pages/designer/index.tsx` (designer save flow)
- `frontend/src/pages/designer/components/VersionHistoryDialog.tsx` (to be replaced)
- `frontend/src/pages/console/` (workspace save flow)
- `frontend/src/api/graphics.ts` (API stubs to be verified)

**Produces:** `docs/plans/versioning-phase-8-plan.md`

**Prompt:**

You are planning the final integration and polish phase for the I/O versioning and publishing system. Read `docs/architecture/versioning-and-publishing.md` for full design context. Tasks 1-7 are assumed complete — all backend endpoints exist, all frontend components exist, admin toggles are wired.

Your job is to produce `docs/plans/versioning-phase-8-plan.md`.

This phase wires everything together and handles edge cases:

1. **Designer integration**:
   - Designer Save button uses `useObjectActions` hook from Task 5
   - Designer toolbar gets Publish / Unpublish buttons wired to the hook
   - Designer menu gets "Version History" item that opens the recovery dialog from Task 6
   - Save creates version snapshot automatically (via backend, no extra frontend logic needed)
   - Auto-save flow is unchanged — verify `__autosave_*` guard works end-to-end
   - The old `VersionHistoryDialog.tsx` shell is replaced by the new recovery dialog

2. **Console workspace integration**:
   - Workspace save uses `useObjectActions` hook
   - Workspace context menu gets "Version History" option
   - Workspace selector shows published/unpublished status

3. **Console saved charts integration**:
   - Chart save in config dialog uses `useObjectActions` hook
   - Chart palette shows published/unpublished indicators
   - Charts load from API, not localStorage (verify Task 4 migration works)

4. **Process module integration**:
   - Process graphic selector respects published flag for listing
   - Process always renders from live `design_objects` row (verify no change needed)

5. **Auto-save regression testing checklist**:
   - Auto-save still works silently (no version snapshots created)
   - Auto-save recovery flow (discard/restore) still works
   - `__autosave_*` rows are never version-snapshotted
   - Auto-save rows don't appear in any list/search/library view

6. **Edge cases**:
   - Save As from a published object → new object is unpublished
   - Restore a version → creates new version at top of stack, not an in-place mutation
   - Delete the only published object in a module → Process/Console still renders (it reads live row, not published list)
   - Concurrent saves → advisory lock prevents version_number collision

7. **Cleanup**:
   - Remove any dead API stubs (the 404-returning functions in graphics.ts if they've been replaced)
   - Remove the old VersionHistoryDialog.tsx if not already replaced
   - Remove localStorage persistence from savedChartsStore if not already done in Task 4
   - Verify all frontend imports are clean (no unused imports, no broken references)

8. **Compile + build verification**:
   - `cargo build` passes
   - `cargo clippy -- -D warnings` is clean
   - `pnpm build` passes
   - `pnpm test` passes (if tests exist for affected components)

Explore the codebase to find every place where save/publish/version operations are triggered or where object lists are rendered. The plan must enumerate each integration point with exact file paths and describe the specific wiring needed.

---

## Architecture Decisions (locked — do not re-litigate)

- **Full copies, not diffs.** Each version is a complete snapshot. No delta computation.
- **Linear stack.** Sequential version numbers, no branches.
- **Published = visibility only.** Console and Process always render the live row. Publishing controls listing/discovery.
- **Auto-save is invisible.** Never creates version snapshots. Never touches the live row. Guard with `__autosave_*` prefix check.
- **Stats at save time.** element_count, binding_count computed on snapshot creation, stored in metadata JSONB. Never computed at query time.
- **Advisory lock for version numbering.** `pg_advisory_xact_lock(hashtext(id::text))` in the snapshot transaction. Transaction-scoped.
- **No version cap.** Users manage their own cleanup via soft-delete.
- **Soft delete by default.** Hard delete is admin-only with audit log and multi-step confirmation.
- **v1 labeled "Original".** Automatic system label on the first version.
- **parent_version_number tracks lineage.** Simple "what was live when I saved" indicator, not a full ancestry graph.

---

## Related Documents

- `docs/architecture/versioning-and-publishing.md` — canonical architecture reference (all design decisions)
- `design-docs/03` — RBAC permissions reference
- `design-docs/04` — schema authority
