# Versioning and Publishing Architecture

Canonical design reference for the universal save / publish / version history system across all saveable objects in I/O.

**Status:** Implemented.

---

## Overview

A single, consistent versioning and publishing system applies to all saveable object types: designer graphics (`design_objects`), workspaces, and standalone saved charts. Dashboards and reports are out of scope (separate overhaul).

### Goals

1. Every save creates an immutable version snapshot that the user can browse, preview, restore, or fork.
2. "Published" is a visibility flag — it controls who can discover an object, not how it renders.
3. Admins can see all users' objects, recover soft-deleted versions, and permanently delete with audit trail.
4. The system replaces the current localStorage-only saved charts with a proper database-backed store.
5. Auto-save remains completely silent — it never creates version snapshots or touches the live row.

---

## Publish Semantics

### What `published` means

- `published` is a **boolean flag** on saveable objects.
- **Published = visible** to all users who have module-level read access. The object appears in "public sections" of each module's UI (Console palette, Process graphic selector, Designer library).
- **Unpublished = visible only** to the object's creator and to admins (when the admin toggle is active).

### What `published` does NOT mean

- It does NOT affect rendering. Console and Process modules **always render the live `design_objects` row** regardless of the published flag. Publishing controls listing/discovery only.
- There is no concept of multiple published versions. One published state per object at a time.
- Unpublishing is immediate. Creator or admin only.

---

## Version Model

### Full copies, not diffs

Each version row is a **complete snapshot** of the object at that point in time. No delta computation, no diff assembly on read. This trades storage for simplicity and read performance.

### Linear stack

Versions are numbered sequentially per object (1, 2, 3, ...). There are no branches, no merge points. If you restore version 5 and save, you get version N+1 at the top of the stack with `parent_version_number = 5`.

### No cap

There is no limit on the number of versions stored. Users manage their own cleanup by soft-deleting unwanted versions.

### Soft delete

Versions have a `deleted_at TIMESTAMPTZ` column. Users can soft-delete their own versions. Admins can:
- See soft-deleted versions (via "Show deleted" toggle, OFF by default)
- Recover (un-soft-delete) a version
- Permanently delete a version (multi-step confirmation, audit log entry)

### Stats — computed at save time

Stats are computed when a version snapshot is created and stored in the version's `metadata JSONB` column. They are **never computed at query time**. The version list endpoint returns stats without parsing SVG or scene data.

Stats fields in `metadata`:
- `element_count` — for graphics: count of scene nodes; for workspaces: pane count
- `binding_count` — count of point bindings in the object

### Version numbering and parent tracking

- **v1 is auto-labeled "Original"** (stored in the `label` field by the system).
- Each version stores `parent_version_number` — the version that was live when this version was saved. For v1 this is NULL. If you restore v5 and save as v52, then v52's `parent_version_number` is 5.
- The UI shows "Previous: vN" in the stats panel. No need to traverse ancestor chains — user can click through versions manually.

### Label field

Each version has an optional `label TEXT` field for user notes / commit messages. Can be set at save time or edited retroactively in the recovery dialog.

---

## Universal Operations

These four operations apply identically across all saveable object types. They are implemented as a shared frontend hook (`useObjectActions`) and shared UI primitives.

### Save

- Creates a version snapshot in the versions table AND updates the live row.
- RBAC: requires `designer:write` (or module equivalent).
- UI: confirmation dialog "Save all changes?" with an optional notes field inline.
- For embedded dialog saves (chart config dialogs): optional expandable notes section within the existing dialog, not a separate popup.
- Notes can also be added/edited retroactively in the recovery dialog.

### Save As

- Creates a **completely new, unrelated object** — new UUID, fresh version history starting at v1, `published = false`.
- User provides a new name in the Save As dialog.
- No connection to the original object (no fork tracking, no parent reference).
- RBAC: requires `designer:write`.

### Publish

- **IS a save** (creates snapshot + updates live row) AND sets `published = true`.
- Creates a version snapshot with `version_type = 'publish'`.
- RBAC: requires `designer:publish`. Creator or admin only for objects they don't own.
- UI: confirmation dialog.

### Unpublish

- Sets `published = false`. Immediate effect.
- Creator or admin only.
- RBAC: requires `designer:publish`.
- UI: confirmation dialog.

### Delete

- Soft-deletes the object itself (sets `deleted_at` on the main object row).
- All associated version snapshots remain (they reference the object by FK).
- Admins can recover soft-deleted objects.

---

## Auto-save (unchanged)

Auto-save is completely silent. It does NOT:
- Create version snapshots
- Update the live row in `design_objects`

The existing implementation uses an `__autosave_*` name prefix on a temporary `design_objects` row plus IndexedDB local tracking. **All version snapshot logic must explicitly guard against `__autosave_*` rows** — never create a version snapshot for an auto-save row.

---

## Recovery / Version Picker Dialog

A full-featured modal panel (not inline). Shared across all modules.

### Version list

- Filterable by: date range, type (save vs. publish checkpoint), label/notes text
- Publish checkpoints visually distinguished from regular saves
- Notes visible on hover over a version entry
- Notes editable inline in the dialog

### Preview

- Clicking a version entry loads a preview of that version's content in a preview panel within the dialog.

### Stats panel (per selected version)

- Version number
- Date/time
- `element_count`, `binding_count`
- Parent version ("Previous: vN")
- Label

### Actions on a selected version

| Action | Who | Description |
|--------|-----|-------------|
| Load in current view | Any user | Replaces current working content; subsequent save creates new version at top of stack |
| Open in new tab | Any user | Opens in the appropriate module (designer for graphics, console for workspaces) |
| Save As | Any user | Forks to a new, unrelated object |
| Publish | Creator/admin | Makes this version's content the published state |
| Delete | Creator/admin | Soft-deletes this version entry |
| Recover | Admin only | Un-soft-deletes a deleted version |
| Permanently delete | Admin only | Multi-step confirmation; audit log entry |

### Admin filter toggles

These appear in all list/search dialogs and library panels across the application. Visible only to admins. OFF by default.

- **"Show all users' objects"** — when ON, admin sees unpublished objects belonging to other users in all list/search views across all modules.
- **"Show deleted objects"** — when ON, admin sees soft-deleted version entries in the recovery dialog.

---

## Schema Design

### `design_objects` table — add published flag

```sql
ALTER TABLE design_objects
    ADD COLUMN published BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_design_objects_published
    ON design_objects(published) WHERE published = true;
```

### `design_object_versions` table — add version metadata columns

The table already exists (created in `migrations/20260314000009_graphics_workspaces.up.sql` lines 18-28). Add:

```sql
ALTER TABLE design_object_versions
    ADD COLUMN deleted_at TIMESTAMPTZ,
    ADD COLUMN label TEXT,
    ADD COLUMN parent_version_number INTEGER;
```

- `deleted_at` — soft delete timestamp
- `label` — optional user notes / commit message; v1 auto-set to "Original"
- `parent_version_number` — references the version_number that was live when this snapshot was created (NULL for v1)
- Stats (`element_count`, `binding_count`) stored in the existing `metadata JSONB` column at save time

### `workspace_versions` table — new

```sql
CREATE TABLE workspace_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES design_objects(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    version_type VARCHAR(10) NOT NULL CHECK (version_type IN ('save', 'publish')),
    layout JSONB NOT NULL,
    label TEXT,
    parent_version_number INTEGER,
    metadata JSONB,
    deleted_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, version_number)
);
```

### `saved_charts` table — new (replaces localStorage)

```sql
CREATE TABLE saved_charts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    chart_type INTEGER NOT NULL,
    config JSONB NOT NULL,
    published BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_charts_created_by ON saved_charts(created_by);
CREATE INDEX idx_saved_charts_published ON saved_charts(published) WHERE published = true;
```

---

## RBAC / Permissions

| Permission | Gates |
|-----------|-------|
| `designer:read` | Viewing objects, browsing version history |
| `designer:write` | Save, Save As, Create, Delete (soft) |
| `designer:publish` | Publish, Unpublish |

Admin role inherits all permissions. Admins additionally can:
- See all users' unpublished objects (via toggle)
- See soft-deleted versions (via toggle)
- Recover soft-deleted versions
- Permanently delete versions (with audit log)

---

## Performance Design

### Stats at save time

Stats (`element_count`, `binding_count`) are computed when a version snapshot is created and stored in `metadata JSONB`. The version list query returns stats without any SVG parsing or scene data traversal.

### Advisory lock for version numbering

```sql
SELECT pg_advisory_xact_lock(hashtext($1::text))
-- where $1 is the design_object_id
```

Used inside the snapshot INSERT transaction to prevent `version_number` race conditions when multiple saves happen concurrently for the same object. Transaction-scoped (released on commit/rollback). Cheap.

### No rendering performance impact

The `design_object_versions` table is **never read during normal graphic rendering**. Console and Process modules read from `design_objects` only. The version count has zero impact on rendering performance.

### Image asset deduplication

Image assets (`graphic_assets` table) are content-addressed BYTEA in the database. They are referenced by hash in `svg_data`, not duplicated across versions. Full-copy version snapshots do not multiply image storage.

---

## Object Types

### In scope

| Object Type | Table | Version Table | Notes |
|-------------|-------|---------------|-------|
| Designer graphics | `design_objects` | `design_object_versions` (exists) | Add `published` column, version metadata columns |
| Workspaces | `workspaces` | `workspace_versions` (new) | Already has `published` column |
| Standalone saved charts | `saved_charts` (new) | Future: `saved_chart_versions` | Replace localStorage; versioning optional in first pass |
| Charts embedded in graphics | Part of `design_objects.svg_data` | Versioned with the graphic | No additional work needed |

### Out of scope

- Dashboards (separate overhaul)
- Reports (separate overhaul)

---

## Implementation Notes

### Existing bug fix (not yet committed)

`services/api-gateway/src/handlers/iographic.rs` ~line 3051: INSERT into `design_object_versions` used wrong column names (`graphic_id`, `version`) and was missing `svg_data` (NOT NULL). Fixed to use (`design_object_id`, `version_number`, `svg_data`). Compiles clean. This fix must be included in the first migration/backend phase commit.

### Key existing code locations

| What | Where |
|------|-------|
| Migration (design_object_versions schema) | `migrations/20260314000009_graphics_workspaces.up.sql` lines 18-28 |
| Existing publish handler | `services/api-gateway/src/handlers/graphics.rs` lines 595-671 |
| Route registration (main.rs) | Only `POST /api/v1/design-objects/:id/publish` registered; no GET/restore routes |
| Frontend API stubs (all return 404) | `frontend/src/api/graphics.ts` — `getVersions` (line 199), `getVersionContent` (line 213), `restoreVersion` (line 232) |
| VersionHistoryDialog (renders empty) | `frontend/src/pages/designer/components/VersionHistoryDialog.tsx` |
| Auto-save implementation | `frontend/src/pages/designer/index.tsx` ~line 985+ |
| savedChartsStore (localStorage) | `frontend/src/store/savedChartsStore.ts` |
| graphic_assets table (images, already DB) | `migrations/20260319000002_graphic_assets.up.sql` |

### What already exists vs. what's missing

**Exists:**
- `design_object_versions` table (basic schema, no metadata columns)
- `POST /api/v1/design-objects/:id/publish` route + handler (needs update to set published flag)
- Frontend API function stubs for version operations (return 404)
- `VersionHistoryDialog` component shell (renders empty)
- Auto-save mechanism (untouched by this work)
- `workspaces.published` column (already in schema)
- `graphic_assets` table with content-addressed images

**Missing:**
- `published` column on `design_objects`
- `deleted_at`, `label`, `parent_version_number` columns on `design_object_versions`
- `workspace_versions` table
- `saved_charts` table
- All backend handlers for: list versions, get version content, restore version, unpublish
- Updated publish handler (must set `published = true` on the `design_objects` row)
- Updated save/update handler (must auto-snapshot on save with advisory lock + auto-save guard + stats)
- All new route registrations in main.rs
- `useObjectActions` shared frontend hook
- Save / Save As / Publish / Unpublish confirmation dialogs
- Version recovery dialog (full implementation replacing empty shell)
- Admin filter toggles across all list/search views
- Permanent delete with audit log
- Migration of savedChartsStore from localStorage to database

---

## Related Documents

- `docs/plans/versioning-plan.md` — planning trigger file (8 implementation phases)
- `design-docs/04` — schema authority (all table DDL)
- `design-docs/03` — RBAC permissions reference
