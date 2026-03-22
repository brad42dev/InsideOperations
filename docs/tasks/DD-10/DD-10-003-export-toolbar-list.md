---
id: DD-10-003
title: Add export toolbar button to dashboard list page
unit: DD-10
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The dashboards list page needs a standard `[Export v]` toolbar button that exports the list of dashboards (metadata: name, category, published, widget count, created_at, etc.) in the user's chosen format. The button follows the standard CX-EXPORT pattern: visible only when the user has `dashboards:export` permission, exports the currently filtered view.

## Spec Excerpt (verbatim)

> Dashboard list table also has a standard `[Export v]` toolbar button
> Dashboard definition export available as JSON only (complex JSONB layout + widget configs)
> Requires `dashboards:export` permission
> — design-docs/10_DASHBOARDS_MODULE.md §Data Export

> Every qualifying module table/toolbar has an Export button. It is not buried in a menu.
> — CX-EXPORT contract, docs/SPEC_MANIFEST.md §Wave 0

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/dashboards/index.tsx` — lines 390–421: page header div with "New Dashboard" button; export button should go here
- `frontend/src/pages/dashboards/index.tsx` — lines 364–372: `filtered` array contains the currently filtered dashboards to export

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Page header area (`index.tsx` lines 390–421) contains an `[Export v]` button alongside "New Dashboard"
- [ ] Export button is hidden (not rendered) when user lacks `dashboards:export` permission
- [ ] Clicking the button opens a format dropdown or dialog
- [ ] Export uses the currently `filtered` array (respects active search and category filter)
- [ ] Exported file has format-correct content (CSV with dashboard metadata columns; JSON with full definition)
- [ ] Filename follows `dashboards_list_{YYYY-MM-DD_HHmm}.{ext}` convention

## Assessment

- **Status**: ❌ Missing
- `index.tsx` page header (lines 390–421) has only a "New Dashboard" button. No export button exists anywhere on the dashboards list page.

## Fix Instructions

In `frontend/src/pages/dashboards/index.tsx`:

1. Import auth store hook to check `dashboards:export` permission.

2. Add an export button to the page header `<div>` (line 406 area), before the "New Dashboard" button:

```tsx
{hasPermission('dashboards:export') && (
  <button
    onClick={() => handleExport('json')}
    style={{ /* match existing button styles, use var(--io-*) tokens */ }}
  >
    Export ▾
  </button>
)}
```

3. The `handleExport` function should:
   - Build a JSON payload from the `filtered` array (for dashboard definition export) or a CSV from metadata fields (name, category, published, widget count, created_at)
   - For JSON: `POST /api/v1/export/dashboards` with `{ ids: filtered.map(d => d.id), format: 'json' }`
   - For metadata CSV/XLSX: build client-side from `filtered` array using a simple serializer

4. For the spec-required 6 formats: per the spec, dashboard definition export supports JSON only; metadata export supports CSV, XLSX, JSON. Do not offer PDF or Parquet for the list export.

5. Filename: `dashboards_list_${new Date().toISOString().slice(0,16).replace('T','_').replace(':','')}.json`

Do NOT:
- Disable the button when permission is absent — hide it entirely
- Export all dashboards ignoring the active `filtered` array (WYSIWYG export requirement)
