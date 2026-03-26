---
id: DD-25-006
title: Implement selective restore and field-level restore preview for Change Snapshots
unit: DD-25
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When an admin restores a snapshot, they must first see a restore preview showing exactly what will change (field-level old → new diff), with an option to restore all rows or select specific rows. Rows that have been modified again since the snapshot was taken must be flagged with a warning. A pre-restore safety snapshot is created (if checkbox enabled, default on) before execution.

## Spec Excerpt (verbatim)

> Restoration supports two modes: Full Rollback: Restore all rows from the snapshot. Selective Restore: Select individual records from the snapshot. Both modes follow the same workflow: 1. Admin selects a snapshot and clicks "Restore". 2. System generates a restore preview showing what will change [with field-level diff table]. 3. Conflict detection: If any row has been modified again after the snapshot, those rows are flagged with a warning. 4. Pre-restore snapshot: If checkbox enabled (default), system creates a new snapshot of the current state.
— design-docs/25_EXPORT_SYSTEM.md, §10.6

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/settings/BulkUpdate.tsx` — `SnapshotsTab` restore flow (lines 596–630); currently shows a simple confirm dialog with no preview
- `frontend/src/pages/settings/Snapshots.tsx` — separate Snapshots page; also has restore button with simple confirm dialog
- `services/api-gateway/src/handlers/bulk_update.rs` — `restore_snapshot` handler (~line 845); `restore_snapshot_rows()` (lines 568–576) — no preview, no selective restore
- `services/api-gateway/src/main.rs` — `/api/snapshots/:id/restore` route (line 581)

## Verification Checklist

- [ ] `GET /api/snapshots/:id/restore-preview` endpoint exists and returns field-level diff (current values vs snapshot values)
- [ ] Restore Preview includes `conflicted_rows` — rows with `updated_at` > snapshot `created_at`
- [ ] Frontend shows restore preview modal before executing restore (not just a confirm dialog)
- [ ] Restore preview modal has mode selector: "Restore all N rows" vs "Select specific rows"
- [ ] In selective mode, rows are listed with checkboxes; admin can pick a subset
- [ ] Pre-restore safety snapshot checkbox defaults to checked
- [ ] `POST /api/snapshots/:id/restore` accepts `{ mode: "all" | "selective", row_ids?: string[], create_safety_snapshot: boolean }`
- [ ] Safety snapshot ID is returned in restore response and displayed in UI

## Assessment

- **Status**: ❌ Missing (restore preview, selective restore) / ⚠️ Partial (safety snapshot)
- **If partial/missing**: `BulkUpdate.tsx:596–630` — clicking Restore opens a generic confirm dialog with no diff preview. `restore_snapshot_rows()` (lines 568–576) restores all rows unconditionally with no row selection. The safety snapshot is created (snapshot_id in response at `BulkUpdate.tsx:602`), but there is no way for the admin to see what will change before executing.

## Fix Instructions (if needed)

**Backend**:

1. Add `GET /api/snapshots/:id/restore-preview` handler: loads snapshot rows (`change_snapshot_rows` for the snapshot), fetches current values for the same record IDs from the target table, computes a field-level diff (snapshot value vs current value), and flags rows where `updated_at > snapshot.created_at` as conflicted.

2. Modify `POST /api/snapshots/:id/restore` body to accept `{ mode: "all" | "selective", row_ids?: uuid[], create_safety_snapshot: bool }`. When `mode = "selective"`, only restore rows whose UUIDs are in `row_ids`.

3. Register new route in `main.rs`:
   ```
   .route("/api/snapshots/:id/restore-preview", get(handlers::bulk_update::restore_preview))
   ```

**Frontend**:

1. Replace the simple `ConfirmDialog` for restore in `BulkUpdate.tsx` (lines 625–630) and `Snapshots.tsx` with a multi-step `RestorePreviewModal` component:
   - Step 1: Load preview via `GET /api/snapshots/:id/restore-preview`. Show loading state.
   - Step 2: Display mode selector (all / selective). Display field-level diff table. Flag conflicted rows with ⚠. Show "Create safety snapshot before restoring" checkbox (default checked).
   - Step 3: Confirmation with row count and "Restore N Rows" button.

2. In selective mode, the diff table rows have checkboxes. Selected row UUIDs are sent in the restore request body.

Do NOT:
- Execute restore directly from a confirm dialog — the preview step is a hard requirement from §10.6.
- Skip the pre-restore safety snapshot option — it must be a checkbox defaulting to checked.
