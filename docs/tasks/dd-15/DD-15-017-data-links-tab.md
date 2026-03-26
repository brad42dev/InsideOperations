---
id: DD-15-017
title: Implement Data Links tab in Settings > Imports
unit: DD-15
status: pending
priority: medium
depends-on: [DD-15-009]
---

## What This Feature Should Do

The Import settings page needs a "Data Links" tab where admins configure cross-dataset joins — linking a column in one import dataset to a column in another (e.g., linking a Maximo asset ID to an OPC UA point tag). Each link has a transform pipeline (chip stack) applied to each side, a match type (exact/case-insensitive/transformed), and a bidirectional toggle. A live preview with sample data validates the transform output. The tab also shows a validation warning if a link chain has no path to a point column.

## Spec Excerpt (verbatim)

> **Link List**: Table showing all configured data links with source dataset, source column, target dataset, target column, match type, direction, enabled status
> **Add Link**: "Add Link" button opens a form: pick source dataset, pick source column, pick target dataset, pick target column, match type (exact/case_insensitive/transformed), bidirectional toggle
> **Transform Pipeline**: Each side of a link can have a chain of transforms applied. Chip stack UI — each transform is a chip showing plain English description. Add transforms from a dropdown of 12 built-in operations, plus regex fallback. Drag to reorder. Live preview with sample data from the dataset.
> **Validation**: On save, the system validates link chains. If a link's dataset has no path to a dataset with a designated point column, a warning is displayed.
> Requires `system:data_link_config` permission
> — 15_SETTINGS_MODULE.md, §Data Links

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/settings/Import.tsx` — add a "Data Links" tab to the existing tabbed layout (around the tab definitions section); Import.tsx already has tabs for Connector Templates, Connections, Definitions, Run History, Point Detail
- `frontend/src/api/` — need a `dataLinksApi` module for `GET/POST/PUT/DELETE /api/v1/data-links`
- `services/import-service/src/` — backend data links endpoints

## Verification Checklist

- [ ] Import.tsx tab bar includes a "Data Links" tab rendered only when user has `system:data_link_config` permission
- [ ] Data Links tab shows a table of existing links with columns: Source Dataset, Source Column, Target Dataset, Target Column, Match Type, Direction, Enabled, Actions
- [ ] "Add Link" button opens a form with: source dataset dropdown, source column dropdown (populated from selected dataset's columns), target dataset dropdown, target column dropdown, match type select (exact/case_insensitive/transformed), bidirectional toggle
- [ ] Each link side has a transform pipeline chip stack (add transform from dropdown of 12 built-in ops, drag-to-reorder, live preview)
- [ ] Saving a link triggers validation; links with no path to a point column show a warning badge
- [ ] Enable/disable toggle per link with immediate PATCH to `PUT /api/v1/data-links/{id}`

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: No `DataLink`, `data_link`, or "Data Links" found in Import.tsx. No `dataLinksApi` exists in `frontend/src/api/`. The `system:data_link_config` permission exists in design-docs/03 but is not referenced in any frontend file.

## Fix Instructions

**1. API module** — create `frontend/src/api/dataLinks.ts`:

```typescript
export interface DataLink {
  id: string
  source_dataset_id: string
  source_column: string
  target_dataset_id: string
  target_column: string
  match_type: 'exact' | 'case_insensitive' | 'transformed'
  bidirectional: boolean
  enabled: boolean
  source_transforms: LinkTransform[]
  target_transforms: LinkTransform[]
}

export interface LinkTransform {
  op: 'uppercase' | 'lowercase' | 'trim' | 'remove_dashes' | 'remove_spaces' |
      'remove_underscores' | 'leading_zeros' | 'strip_prefix' | 'strip_suffix' |
      'replace' | 'regex_extract' | 'substring'
  params?: Record<string, string>
}

export const dataLinksApi = {
  list: () => apiFetch<DataLink[]>('/api/v1/data-links'),
  create: (body: Omit<DataLink, 'id'>) => apiFetch<DataLink>('/api/v1/data-links', { method: 'POST', body }),
  update: (id: string, body: Partial<DataLink>) => apiFetch<DataLink>(`/api/v1/data-links/${id}`, { method: 'PUT', body }),
  delete: (id: string) => apiFetch<void>(`/api/v1/data-links/${id}`, { method: 'DELETE' }),
}
```

**2. Tab addition in Import.tsx**:

Find the tab definition array (already has tabs for "templates", "connections", "definitions", "runs", "point_detail"). Add:
```tsx
{ id: 'data_links', label: 'Data Links', permission: 'system:data_link_config' }
```

Render the `DataLinksTab` component when this tab is active.

**3. DataLinksTab component** (can be defined inside Import.tsx or extracted):

- Table using TanStack Table with the columns listed above
- "Add Link" opens a Radix UI Dialog with the source/target form
- Transform pipeline: use a chip list where each chip shows the transform label; "Add Transform" dropdown with the 12 ops; use `@dnd-kit/sortable` for reorder (already used in this project for Expression Builder)
- Live preview: show a sample value from the source dataset and the output after all transforms
- Validation warning: after save, if the API returns `{ valid: false, reason: "no_point_column_path" }`, show an amber warning badge on the link row

Do NOT:
- Make the transform pipeline a separate page — it must be inline in the Add/Edit link dialog
- Require drag-and-drop for transform reorder if @dnd-kit is not already in Import.tsx — up/down arrow buttons are acceptable
- Skip the permission check — wrap the tab content in `usePermission('system:data_link_config')` and show "Access Denied" if false
