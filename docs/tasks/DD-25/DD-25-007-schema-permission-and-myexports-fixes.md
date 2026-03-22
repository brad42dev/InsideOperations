---
id: DD-25-007
title: Fix snapshot schema mismatch, bulk-update permission, and My Exports page scope
unit: DD-25
status: pending
priority: medium
depends-on: [DD-25-001]
---

## What This Feature Should Do

Three separate but small correctness gaps: (1) The `change_snapshots` table schema used in the handler diverges from the spec-defined schema (wrong column names, missing columns). (2) The bulk update endpoints use `settings:write` permission instead of the spec-mandated `system:bulk_update`. (3) The "My Exports" page queries the reports job API instead of the universal exports API, and is missing Retry, Cancel, and Clear Completed actions.

## Spec Excerpt (verbatim)

> CREATE TABLE change_snapshots (id UUID, table_name VARCHAR(100) NOT NULL, snapshot_type VARCHAR(20) CHECK (snapshot_type IN ('automatic', 'manual')), description TEXT, row_count INTEGER, filter_criteria JSONB, related_job_id UUID REFERENCES export_jobs(id) ON DELETE SET NULL, created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ)
>
> [Bulk Update] Permission required: system:bulk_update
>
> My Exports page: Status values: queued, processing, completed, failed, cancelled. Actions: Download, Retry, Delete, Cancel, Clear Completed.
— design-docs/25_EXPORT_SYSTEM.md, §12.2, §13.2, §7.2, §7.3

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/handlers/bulk_update.rs` — `snapshot_target()` INSERT (lines 229–244); permission checks (lines 629, 684, 712, 749, 775, 845)
- Database migrations in `services/api-gateway/` or `migrations/` — `change_snapshots` table DDL
- `frontend/src/pages/reports/MyExports.tsx` — queries `reportsApi.listMyExports` (line 97); uses `ReportJob` type
- `frontend/src/api/exports.ts` — does not exist yet; needed for MyExports to query `/api/exports`

## Verification Checklist

- [ ] `change_snapshots` table has `table_name` column (not `target_type`)
- [ ] `change_snapshots` table has `snapshot_type VARCHAR(20) CHECK (snapshot_type IN ('automatic', 'manual'))`
- [ ] `change_snapshots` table has `description TEXT` and `filter_criteria JSONB`
- [ ] `change_snapshots` table has `related_job_id UUID REFERENCES export_jobs(id) ON DELETE SET NULL`
- [ ] `bulk_update.rs` permission checks use `system:bulk_update` (not `settings:write`)
- [ ] `MyExports.tsx` queries `/api/exports` (not `/api/reports/exports`)
- [ ] `MyExports.tsx` shows status values: queued, processing, completed, failed, cancelled
- [ ] `MyExports.tsx` has Retry button for failed exports
- [ ] `MyExports.tsx` has Cancel button for in-progress exports
- [ ] `MyExports.tsx` has "Clear Completed" bulk action button

## Assessment

- **Status**: ⚠️ Wrong (schema and permissions) / ⚠️ Wrong (My Exports)
- **If partial/missing**: `bulk_update.rs:231` — INSERT uses `target_type` column; spec §12.2 names it `table_name`. No `snapshot_type`, `description`, `filter_criteria`, or `related_job_id` in the INSERT. All permission checks at lines 629/684/712/749/775/845 use `settings:write`; spec §13.2 mandates `system:bulk_update`. `MyExports.tsx:97` calls `reportsApi.listMyExports` (report jobs, not export jobs); status enum at line 28 only has `pending | running | completed | failed` (missing `cancelled`); no Retry, Cancel, or Clear Completed actions.

## Fix Instructions (if needed)

**Schema and handler (bulk_update.rs)**:

1. Write a database migration to alter `change_snapshots` to match the spec schema:
   - Rename `target_type` column to `table_name` (or add it if the current schema differs).
   - Add `snapshot_type VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (snapshot_type IN ('automatic', 'manual'))`.
   - Add `description TEXT`.
   - Add `filter_criteria JSONB`.
   - Add `related_job_id UUID REFERENCES export_jobs(id) ON DELETE SET NULL`.

2. Update the `snapshot_target()` INSERT in `bulk_update.rs` to use `table_name` and insert `snapshot_type` = `'automatic'` for auto-snapshots, `'manual'` for manual creates.

3. Replace all `check_permission(&claims, "settings:write")` calls in `bulk_update.rs` with `check_permission(&claims, "system:bulk_update")`. The permission name `system:bulk_update` must exist in `frontend/src/shared/types/permissions.ts` as well.

**My Exports page**:

1. Create `frontend/src/api/exports.ts` (this is also needed for DD-25-001). Add `exportsApi.listMyExports(params?)` calling `GET /api/exports` and `exportsApi.deleteExport(id)`, `exportsApi.cancelExport(id)`, `exportsApi.retryExport(id)`.

2. Update `MyExports.tsx` to:
   - Import from `exportsApi` instead of `reportsApi`.
   - Add `cancelled` to the `JobStatus` type and `StatusBadge`.
   - Add action buttons: Retry (for `failed`), Cancel (for `queued` / `processing`), Delete (for all).
   - Add "Clear Completed" button that calls DELETE for all `completed` and `failed` jobs in the list.
   - The existing file can keep the `ReportJob`-style display structure; just point it at the correct API and extend the type.

Do NOT:
- Remove the existing reports My Exports functionality — the same page can show both report jobs and universal export jobs, or separate pages can coexist. The key requirement is that universal export jobs (from `/api/exports`) are accessible from the user menu.
- Change the `settings:write` permission on snapshot READ endpoints (list, get) — those are fine to keep accessible with `settings:read`.
