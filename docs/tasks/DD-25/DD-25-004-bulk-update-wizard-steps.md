---
id: DD-25-004
title: Complete Bulk Update wizard — add Step 2 (Validate & Map) and full Step 4 Results
unit: DD-25
status: pending
priority: medium
depends-on: [DD-25-003]
---

## What This Feature Should Do

The Bulk Update wizard is a 4-step modal flow. Currently implemented as a 3-step page (Choose Target, Upload CSV, Review Changes). Missing: Step 2 "Validate & Map" (column mapping UI, validation errors with downloadable error report) and the full Step 4 "Results" page (failed/skipped rows table, downloadable error report CSV, "Undo All Changes" button that triggers a restore from the auto-created snapshot).

## Spec Excerpt (verbatim)

> Step 2: Validate & Map — File: points_config_updated.xlsx (2,847 rows detected). COLUMN MAPPING — [Matched/Read-only/Unmapped per column]. VALIDATION — [OK] 2,847 rows have valid record IDs. [!!] 3 rows: invalid criticality value. [Download error report].
>
> Step 4 Results — [OK] 308 rows updated. [⚠] 4 rows skipped (modified since export). [!!] 4 rows failed validation. Failed/Skipped Rows table. [Download Error Report] [Download Full Results]. [Undo All Changes] — triggers restore from snapshot.
— design-docs/25_EXPORT_SYSTEM.md, §9.3

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/settings/BulkUpdate.tsx` — current 3-step implementation (lines 290–513); add Step 2 between upload and preview
- `services/api-gateway/src/handlers/bulk_update.rs` — `preview_bulk_update` handler; extend to return validation errors and column mapping info
- `frontend/src/api/bulkUpdate.ts` — `DiffPreview` type; extend to include `validation_errors` and `column_mapping`

## Verification Checklist

- [ ] Step 2 "Validate & Map" screen exists between upload and review
- [ ] Column mapping table shown: file column → system field → status (Matched/Read-only skip/Unmapped)
- [ ] Unmapped columns have a dropdown to select system field or ignore
- [ ] Validation summary shows: valid record IDs count, duplicate ID count, type errors, range errors, required field errors
- [ ] "Download error report" button in Step 2 generates CSV of rows with `_error` column
- [ ] Step 4 Results shows per-category counts: updated, unchanged, skipped (conflict), failed validation
- [ ] Failed/skipped rows table in Step 4 with Tag/ID and Reason columns
- [ ] "Download Error Report" button in Step 4 produces CSV of failed/skipped rows with `_error` column
- [ ] "Undo All Changes" button in Step 4 triggers restore from the auto-created safety snapshot
- [ ] Snapshot ID displayed in Step 4 Results is the safety snapshot created before apply

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: `BulkUpdate.tsx:290–513` implements a 3-step flow with no column mapping step and no validation step. Step 4 Results (`BulkUpdate.tsx:495–510`) shows basic counts (modified, unchanged, snapshot_id) but has no failed/skipped rows table, no downloadable error report, and no "Undo All Changes" button.

## Fix Instructions (if needed)

**Frontend (BulkUpdate.tsx)**:

1. Refactor `BulkUpdateTab` to use a step state machine: `step: 1 | 2 | 3 | 4`. Current Step 1 (choose target + download template) stays. Current Step 2 (upload) stays as Step 2 part 1.

2. After `previewMutation` resolves, transition to new Step 2 "Validate & Map" showing:
   - Column mapping table from `preview.column_mapping` (new field from API).
   - Validation error summary from `preview.validation_errors` (new field).
   - "Download error report" button that calls `bulkUpdateApi.downloadErrorReport(...)`.
   - "Next" to proceed to Step 3 (current Review Changes).

3. After `applyMutation` resolves, transition to Step 4 Results showing:
   - Count summary (modified/unchanged/skipped conflicts/failed validation).
   - If `applyResult.failed_rows?.length > 0`: render a table with ID and Reason columns.
   - "Download Error Report" button: calls `bulkUpdateApi.downloadErrorReport(applyResult.id)`.
   - "Undo All Changes" button: calls `snapshotsApi.restore(applyResult.snapshot_id)`, then shows restore confirmation dialog.

**Backend (bulk_update.rs)**:

1. Extend `DiffPreview` struct to include `column_mapping: Vec<ColumnMapping>` and `validation_errors: Vec<ValidationError>`.
2. In `preview_bulk_update`, after parsing CSV, validate:
   - All `id` values are valid UUIDs and exist in the target table.
   - No duplicate IDs in the uploaded file.
   - Type checks per field (e.g., `criticality` is integer 1–5, `enabled` is boolean).
   - Required fields are non-empty.
3. Add `GET /api/bulk-update/:id/error-report` endpoint that returns a CSV of failed/skipped rows with an `_error` column.

Do NOT:
- Lose the existing 3-step flow data — refactor it into the 4-step model, not replace it.
- Block apply if validation errors exist for some rows — the spec uses a partial success model: valid rows apply, invalid rows are skipped and reported.
