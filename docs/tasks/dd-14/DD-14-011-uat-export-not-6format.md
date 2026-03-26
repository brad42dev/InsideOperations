---
id: DD-14-011
unit: DD-14
title: Rounds export not 6-format — History has CSV-only, Templates/Schedules have no export button
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-14/CURRENT.md
---

## What to Build

DD-14-006 required replacing the CSV-only export in the rounds History tab with a 6-format ExportButton, and adding Export buttons to the Templates and Schedules tabs. UAT confirms all three are missing:

1. **History tab**: Shows an "Export CSV" button that directly downloads `table-export.csv` with no format selector. This is the old DataTable built-in CSV export — it was NOT replaced with the 6-format `ExportButton` from `../../shared/components/ExportDialog`.
2. **Templates tab**: No Export button at all. Header has only Print + "New Template".
3. **Schedules tab**: No Export button at all.

The spec (DD-14-006) requires:
- RoundHistory.tsx toolbar: Export button adjacent to date range filters, offering CSV/XLSX/PDF/JSON/Parquet/HTML
- RoundTemplates.tsx header: Export button adjacent to "+ New Template" button
- RoundSchedules.tsx header: Export button
- All Export buttons must offer 6 formats
- Export button hidden when user lacks `rounds:export` permission

## Acceptance Criteria

- [ ] History tab toolbar has an ExportButton (from shared/components/ExportDialog) that offers 6 formats: CSV, XLSX, PDF, JSON, Parquet, HTML
- [ ] The old "Export CSV" DataTable built-in export is suppressed (showExport={false} or equivalent)
- [ ] Templates tab header has an Export button adjacent to the "+ New Template" button
- [ ] Schedules tab header has an Export button
- [ ] Clicking any Export button opens a format selector dialog (not a direct download)
- [ ] Export button is hidden when user lacks `rounds:export` permission

## Verification Checklist

- [ ] Navigate to /rounds → click History tab → Export button visible (not "Export CSV")
- [ ] Click Export button → format selector dialog appears with CSV, XLSX, PDF, JSON, Parquet, HTML options
- [ ] Navigate to /rounds → click Templates tab → Export button visible next to "+ New Template"
- [ ] Navigate to /rounds → click Schedules tab → Export button visible in header
- [ ] No direct CSV downloads when clicking Export — always opens format selector first

## Do NOT

- Do not leave the old "Export CSV" DataTable button in place alongside the new ExportButton
- Do not implement a CSV-only export and claim it satisfies the 6-format requirement

## Dev Notes

UAT failure from 2026-03-25:
- History tab: "Export CSV" button directly downloads table-export.csv (no dialog)
- Templates tab: No export button found (confirmed via CDP query of DOM)
- Schedules tab: No export button found (confirmed via CDP query of DOM)
Screenshot: docs/uat/DD-14/dd14-export-csv-only.png
Spec reference: DD-14-006 (add export button to rounds tables)
