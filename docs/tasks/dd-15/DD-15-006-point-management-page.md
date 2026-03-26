---
id: DD-15-006
title: Implement Point Configuration page (aggregation types, lifecycle, metadata version history)
unit: DD-15
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Settings > Points page must allow admins to configure per-point settings: aggregation type toggles (Allow Averaging, Allow Sum/Totaling, Allow Accumulation), application config columns (active toggle, criticality dropdown, area, default graphic, GPS, barcode, notes, write_frequency_seconds), a Custom Conversion button to open the Expression Builder, point lifecycle management (deactivate/reactivate), and a metadata version history viewer. The current implementation is a 10-line stub.

## Spec Excerpt (verbatim)

> Configure per-point aggregation types via `aggregation_types` bitmask on `points_metadata`
> Top-level toggles determine which aggregate operations are semantically valid for each point:
>   - **Allow Averaging**: Value can be meaningfully averaged over time
>   - **Allow Sum/Totaling**: Value can be meaningfully summed over time
>   - **Allow Accumulation**: Value represents a running total or accumulator
> Bulk configuration: allow selecting multiple points and applying the same aggregation types
> Point configuration UI is accessible from the Settings module under a "Points" tab
> — 15_SETTINGS_MODULE.md, §Point Configuration

> **Application config columns** (editable per point): `active` toggle, `criticality` dropdown, `area`, `default_graphic_id`, `gps_latitude`/`gps_longitude`, `barcode`, `notes`, `write_frequency_seconds`
> — 15_SETTINGS_MODULE.md, §Point Configuration

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/settings/PointManagement.tsx` — 10-line stub; needs full implementation
- `frontend/src/api/` — check for existing points API file used by other modules

## Verification Checklist

- [ ] Page renders a searchable, filterable table of points (tag name, source, area, criticality, active status, aggregation types)
- [ ] Each row has an inline edit or "Configure" action opening a detail panel
- [ ] Aggregation type controls: three toggles for Allow Averaging, Allow Sum/Totaling, Allow Accumulation
- [ ] App config columns are all editable: active toggle, criticality (4 options), area (text), barcode (text), notes (text), write_frequency_seconds (number)
- [ ] "Custom Conversion" button opens Expression Builder modal with `context="conversion"`
- [ ] Deactivate/reactivate actions with confirmation dialog
- [ ] Metadata version history tab/section showing `points_metadata_versions` records (read-only timeline)
- [ ] Bulk selection: select multiple rows and apply same aggregation types to all selected

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `PointManagement.tsx` is 10 lines: a div with heading "Points" and paragraph "OPC UA point configuration and metadata — Phase 7"

## Fix Instructions

This is a substantial new page. Implementation approach:

1. **Fetch points** from `GET /api/points` (existing endpoint). Display in a TanStack Table with virtual scrolling (the points table can be 10,000+ rows per spec).

2. **Filter bar**: active/inactive toggle (default: active only), source filter dropdown, area filter, search by tag name.

3. **Point configuration panel** (slide-out or dialog): use a tabbed layout:
   - **General**: active toggle, criticality dropdown (safety_critical/environmental/production/informational), area text, write_frequency_seconds number
   - **Aggregation**: three checkboxes for Allow Averaging / Allow Sum / Allow Accumulation. Add a note that `min`, `max`, `count` are always available.
   - **Location**: gps_latitude, gps_longitude (number inputs), barcode text field
   - **Custom Conversion**: button opening Expression Builder modal. When a custom_expression_id is set, show the expression name + "Edit" + "Clear" controls.
   - **History**: read-only table of `points_metadata_versions` records for this point (fetch `GET /api/points/:id/metadata-versions`).

4. **Bulk edit**: Checkbox column, "Apply to selected" toolbar that appears when ≥1 rows are checked. Only show the aggregation toggles in bulk mode (safer to not bulk-apply per-point fields like GPS).

5. **Point lifecycle**: Deactivate button per row (confirmation: "This will hide the point from operational views. It can be reactivated later."). Reactivate button appears when `active = false`.

Do NOT:
- Allow point deletion (spec enforces never-delete via `prevent_point_deletion` DB trigger)
- Show raw `aggregation_types` bitmask to the user — always render the three named toggles
- Use a generic shimmer loader — use a table skeleton with the correct number of columns
