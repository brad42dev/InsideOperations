---
id: DD-10-002
title: Make widget Export Data kebab accessible in view mode (not only edit mode)
unit: DD-10
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Users should be able to export data from any widget while viewing a dashboard, without needing to enter edit mode. The "Export Data" option in the widget's kebab/three-dot menu must be visible in both view mode and edit mode. Currently the entire kebab menu — including "Export Data" — is hidden unless `editMode={true}`, so published dashboard viewers can never export widget data.

## Spec Excerpt (verbatim)

> "Per-widget export via three-dot (kebab) menu: 'Export Data' option"
> — design-docs/10_DASHBOARDS_MODULE.md, §Data Export

> "Requires `dashboards:export` permission"
> — design-docs/10_DASHBOARDS_MODULE.md, §Data Export

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/dashboards/widgets/WidgetContainer.tsx` — line 187–188: `{editMode && (` gates the entire kebab menu; line 229–231: "Export Data" item is inside this gate
- `frontend/src/pages/dashboards/DashboardViewer.tsx` — line 483: `<WidgetContainer config={widget} variables={varValues} editMode={false} />` — viewer passes `editMode={false}` (the default)

## Verification Checklist

- [ ] In `WidgetContainer.tsx`, the three-dot kebab button is visible when `editMode={false}` AND `canExport={true}`
- [ ] The kebab in view mode shows only "Export Data" (no "Edit" or "Remove" items which are edit-only)
- [ ] The kebab in edit mode still shows "Edit", "Export Data" (if canExport), "Remove"
- [ ] Clicking "Export Data" in view mode opens `ExportDataDialog`
- [ ] Kebab is hidden entirely when user lacks `dashboards:export` AND is not in edit mode (no orphaned 3-dot button)

## Assessment

- **Status**: ⚠️ Wrong — Export Data only accessible in edit mode; view mode has no export affordance

## Fix Instructions

In `frontend/src/pages/dashboards/widgets/WidgetContainer.tsx`:

1. The condition at line 187 (`{editMode && (`) gates the entire kebab on edit mode. Split this into two conditions:
   - Always show the kebab button when `editMode` OR `canExport` is true.
   - Inside the menu, show "Edit" and "Remove" only when `editMode` is true.
   - Show "Export Data" when `canExport` is true (regardless of editMode).

2. A concrete refactor: change the items array to build conditionally:
   ```tsx
   const menuItems = [
     ...(editMode ? [{ label: 'Edit', action: () => { onEdit?.(config.id); setMenuOpen(false) } }] : []),
     ...(canExport ? [{ label: 'Export Data', action: () => { setShowExport(true); setMenuOpen(false) } }] : []),
     ...(editMode ? [{ label: 'Remove', action: () => { onRemove?.(config.id); setMenuOpen(false) }, danger: true }] : []),
   ]
   ```
   Then render the button only when `menuItems.length > 0`.

3. No change needed to `DashboardViewer.tsx` — it correctly passes `editMode={false}`; the fix is entirely in `WidgetContainer.tsx`.

Do NOT:
- Move "Edit" or "Remove" into view mode — those are builder-only actions.
- Show the three-dot button when there are no items in the menu (it would be an empty dropdown).
