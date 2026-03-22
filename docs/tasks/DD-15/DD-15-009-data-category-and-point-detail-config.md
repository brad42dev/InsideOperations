---
id: DD-15-009
title: Add Data Category selection to source config and implement Point Detail Configuration admin UI
unit: DD-15
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Two related configuration features are absent: (1) When configuring any data source (OPC or import), the admin must select a Data Category from a dropdown (9 predefined categories + ability to manage custom categories). (2) A Point Detail Configuration admin UI (Settings > Imports > Point Detail tab) must allow admins to configure which data sections appear in the floating Point Detail panel and in what order.

## Spec Excerpt (verbatim)

> **Data Category**: When configuring any new data connection (OPC or import), admin selects a data category from a dropdown:
>   - 9 predefined categories: Process, Event, Access Control, Personnel, Financial, Maintenance, Ticketing, Environmental, General
>   - "Manage Categories" link opens a category CRUD panel where admins can create custom categories
>   - Category controls which users (by role/permission) can see data from this connection
>   - Category also affects which modules display data from this connection
> — 15_SETTINGS_MODULE.md, §Point Source Management

> **Point Detail Configuration**: Admin UI for configuring the Point Detail floating panel (Settings > Imports > Point Detail tab)
> **Section Configuration**: Configure which data sections appear in the Point Detail panel and in what order
> **Per-Section Settings**: For each section (e.g., CMMS work orders, ERP inventory, tickets), configure: source dataset, display columns, sort order, row limit, enabled/disabled
> — 15_SETTINGS_MODULE.md, §Point Detail Configuration

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/settings/OpcSources.tsx` lines 332–438 — `SourceFormState` and `SourceFormFields` (add data_category_id field)
- `frontend/src/pages/settings/Import.tsx` — connection creation forms (add data_category_id field)
- `frontend/src/pages/settings/Import.tsx` — needs a "Point Detail" tab added to the Import settings page

## Verification Checklist

- [ ] `SourceFormState` in OpcSources.tsx includes `data_category_id: string | null`
- [ ] OPC Source create/edit form renders a "Data Category" dropdown populated from `GET /api/data-categories`
- [ ] Dropdown includes a "Manage Categories" link that opens a CRUD panel (or navigates to a category management page)
- [ ] Import connection creation form also has a Data Category dropdown
- [ ] Settings > Import page has a "Point Detail" tab
- [ ] Point Detail tab lists configurable sections with enable/disable toggles, sort order drag handles, and per-section settings (source dataset, display columns, row limit)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: No `data_category_id` in OpcSources.tsx SourceFormState (line 332). No Point Detail tab in Import.tsx. No data-categories API call found anywhere in the settings module.

## Fix Instructions

**Data Category field (OPC Sources)**:

1. Add `data_category_id: string | null` to `SourceFormState` (OpcSources.tsx:332)
2. Add a query inside `SourceFormFields` or its parent to fetch `GET /api/data-categories`
3. Render a `<select>` labeled "Data Category *" with the 9 predefined categories + any custom ones
4. Add a small "Manage Categories" link button next to the dropdown that opens a CRUD modal (create/rename/delete custom categories; predefined ones can only be toggled, not deleted)

**Data Category field (Import connections)**:

Apply the same pattern to Import.tsx connection configuration forms. The `data_category_id` field should be part of `CreateConnectionBody`.

**Point Detail Configuration tab**:

In `frontend/src/pages/settings/Import.tsx`, add a "Point Detail" tab to the existing tabbed layout. The tab content renders:

1. A section list showing all configured Point Detail sections (ordered). Each section shows: name, enabled toggle, source dataset label, row limit.
2. Drag-to-reorder handles (use a simple up/down arrow buttons if drag-and-drop is complex).
3. An "Edit Section" panel/dialog with fields: enabled toggle, source dataset dropdown (from available import definitions), display columns (multi-select), sort column + direction, row limit (number).
4. Support for Equipment Class Overrides (toggle "Override for equipment class" + a class picker + the same section config fields).

API: `GET /api/settings/point-detail-config`, `PUT /api/settings/point-detail-config`.
Permission: `system:point_detail_config`.

Do NOT:
- Allow deletion of the 9 predefined categories — they can only be used or hidden
- Make data_category_id required for existing sources (migrations should default existing sources to "General")
