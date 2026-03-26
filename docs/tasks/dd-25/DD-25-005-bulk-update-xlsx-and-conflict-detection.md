---
id: DD-25-005
title: Add XLSX upload support and conflict detection to Bulk Update
unit: DD-25
status: pending
priority: medium
depends-on: [DD-25-003]
---

## What This Feature Should Do

The Bulk Update workflow must accept both CSV and XLSX files for upload (the template download itself offers XLSX as the primary format for Excel users). Additionally, rows that were modified in the database after the template was exported (detected via `_exported_at` timestamp) must be flagged in the diff preview with a warning rather than silently overwritten.

## Spec Excerpt (verbatim)

> Accepted: .csv, .xlsx   Max: 50 MB / 50,000 rows
>
> Conflict detection: Rows where updated_at > _exported_at are flagged with a warning icon (⚠). These rows were modified by another user or process between template export and reimport. The admin chooses: skip conflicted rows (default) or overwrite with template values.
— design-docs/25_EXPORT_SYSTEM.md, §9.3 (Step 1 UI), §9.3 (Step 3 Diff Preview)

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/settings/BulkUpdate.tsx` — file input `accept` attribute (line 433)
- `services/api-gateway/src/handlers/bulk_update.rs` — `extract_csv_and_target()` (lines 583–618) parses only CSV; `compute_diff()` (lines 355–418) has no conflict detection
- `services/api-gateway/Cargo.toml` — `calamine` is mentioned in §9.5 of the spec as already in the project; verify it's listed
- `services/api-gateway/src/handlers/bulk_update.rs` — `csv_headers()` (lines 78–85) and template generation — must add `_exported_at` column

## Verification Checklist

- [ ] `BulkUpdate.tsx:433` `accept` attribute includes `.xlsx`
- [ ] `extract_csv_and_target()` (or replacement function) detects file content-type and dispatches to CSV parser vs XLSX parser via `calamine`
- [ ] Template download (`get_template` handler) includes `_exported_at` column with current UTC timestamp
- [ ] `compute_diff()` reads `_exported_at` from the uploaded file and compares it to `updated_at` on each matched database row
- [ ] Rows where `updated_at > _exported_at` are returned as a separate `conflicted` list in `DiffPreview` (or as modified rows with `conflict: true` flag)
- [ ] Frontend diff preview shows ⚠ conflict indicator for conflicted rows
- [ ] Frontend diff preview shows conflict resolution option: "Skip conflicted rows" (default) vs "Overwrite with template values"

## Assessment

- **Status**: ❌ Missing (XLSX) / ❌ Missing (conflict detection)
- **If partial/missing**: `BulkUpdate.tsx:433` accepts `.csv,text/csv` only. `bulk_update.rs:355–418` `compute_diff()` performs a pure value comparison with no `updated_at` / `_exported_at` timestamp comparison. No `_exported_at` column appears in template generation (`csv_headers()` at lines 78–85).

## Fix Instructions (if needed)

**XLSX support**:

1. In `Cargo.toml`, verify `calamine` is listed. If not, add `calamine = "0.26"` (MIT license — acceptable).
2. In `bulk_update.rs`, replace `extract_csv_and_target()` with a function that:
   - Detects file format from the multipart `content_type` or filename extension.
   - For `.xlsx`: use `calamine::open_workbook_from_rs::<calamine::Xlsx<_>, _>()` to parse the first sheet into a `Vec<HashMap<String, String>>`.
   - For `.csv`: use existing CSV parser.
   - Returns the same `(Vec<HashMap<String, String>>, TargetType)` regardless of format.
3. Update `BulkUpdate.tsx:433`: change `accept=".csv,text/csv"` to `accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"`.

**Conflict detection**:

1. Add `_exported_at` to all template CSV headers in `csv_headers()`. The value is inserted by the template generation handler as the current UTC timestamp at the moment the template was downloaded.
2. In the template generation handler, set `_exported_at` = `NOW()` as a comment row or dedicated column in the output file. For XLSX, this can be a cell in a metadata sheet.
3. In `compute_diff()`, add logic:
   ```rust
   let exported_at: Option<DateTime<Utc>> = incoming_meta.get("_exported_at")
       .and_then(|v| v.parse().ok());
   if let (Some(exp_at), Some(db_updated_at)) = (exported_at, row_updated_at) {
       if db_updated_at > exp_at { /* mark as conflicted */ }
   }
   ```
4. Add `conflicted: Vec<ModifiedRow>` to `DiffPreview` struct.
5. In `BulkUpdate.tsx` Step 3 diff preview, render conflicted rows with a ⚠ warning badge and add a radio group for conflict resolution (skip / overwrite).

Do NOT:
- Require the admin to manually enter the export timestamp — it must be embedded in the template automatically.
- Treat conflicts as hard errors that block apply — they are warnings; the admin chooses skip vs overwrite.
