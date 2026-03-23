---
id: DD-25-008
unit: DD-25
title: Bulk update wizard and change snapshots UI not implemented
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-25/CURRENT.md
---

## What to Build

The Export Presets settings page (/settings/export-presets) renders a table for saved report presets, but the following key export system features are entirely absent from the UI:

1. **Bulk Update Wizard**: A multi-step wizard (minimum: Step 2 "Validate & Map" and Step 4 "Upload XLSX") for bulk updating entities (points, tags, etc.) via XLSX file upload
2. **Change Snapshots**: A section in settings or export area showing change history snapshots
3. **Report template presets API**: Backend returns 404 for /api/reports/templates/{uuid}/presets — 12 console errors on page load

## Acceptance Criteria

- [ ] Bulk update wizard accessible from Settings or a dedicated route
- [ ] Bulk update wizard shows entity type selection (points, tags, equipment, etc.)
- [ ] Bulk update wizard Step 2 "Validate & Map" visible and functional
- [ ] XLSX file upload supported in bulk update wizard
- [ ] Change snapshots section accessible with list of historical snapshots
- [ ] /api/reports/templates/{uuid}/presets API returns 200 (not 404)

## Verification Checklist

- [ ] Find and navigate to bulk update UI — it renders without error
- [ ] Bulk update wizard has at minimum an entity type selector and file upload step
- [ ] Change snapshots section accessible with list or empty state
- [ ] /settings/export-presets loads without console errors

## Do NOT

- Do not stub with TODO placeholders
- Do not implement only one step of the wizard

## Dev Notes

UAT failure from 2026-03-23: Navigated to /settings/export-presets — only a simple preset table visible. No bulk update wizard found anywhere in the application. 12 console errors for /api/reports/templates/{uuid}/presets endpoints returning 404.
Spec reference: DD-25-003 (bulk update wizard), DD-25-004 (step 2), DD-25-005 (XLSX upload), DD-25-006 (change snapshots)
