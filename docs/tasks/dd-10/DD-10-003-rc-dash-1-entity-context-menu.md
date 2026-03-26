---
id: DD-10-003
title: Implement RC-DASH-1 right-click context menu on dashboard list cards
unit: DD-10
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Right-clicking any dashboard card in the dashboards list must open a context menu with the RC-DASH-1 items: Open, Open in New Tab, Edit in Designer, Duplicate, Publish/Unpublish (toggle), Share, and Delete (grayed if published). Currently the card has a 3-dot kebab button but no `onContextMenu` handler, meaning right-click does nothing, and the kebab menu itself is missing "Open in New Tab" and the Publish/Unpublish toggle.

## Spec Excerpt (verbatim)

> "Dashboards (RC-DASH-1): Open, Open in New Tab, Edit in Designer, Duplicate, Publish/Unpublish (toggle), Share, Delete (grayed if published)."
> — docs/SPEC_MANIFEST.md, §CX-ENTITY-CONTEXT Non-negotiables #5

> "Right-clicking any row in an entity list opens a context menu. An entity list with no right-click behavior is wrong."
> — docs/SPEC_MANIFEST.md, §CX-ENTITY-CONTEXT Non-negotiables #1

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/dashboards/index.tsx` — `DashboardCard` component (lines 68–291); current 3-dot menu at lines 121–222; no `onContextMenu` on the card div
- `frontend/src/shared/components/PointContextMenu.tsx` — reference for how shared context menus are structured (Radix UI primitives)

## Verification Checklist

- [ ] Right-clicking a dashboard card opens a context menu (not just the 3-dot kebab)
- [ ] Context menu contains: Open, Open in New Tab, Edit in Designer, Duplicate, Publish/Unpublish (toggle), Share, Delete
- [ ] "Delete" is grayed with tooltip when dashboard is published (not simply hidden)
- [ ] "Publish/Unpublish" item is hidden when user lacks `dashboards:publish` permission
- [ ] "Edit in Designer" is hidden when user lacks `dashboards:write` permission
- [ ] Context menu uses Radix UI ContextMenu primitives (not a custom div dropdown)
- [ ] "Open in New Tab" opens dashboard in a new browser tab (`window.open(...)`)
- [ ] Destructive "Delete" action requires a confirmation dialog before executing

## Assessment

- **Status**: ❌ Missing — no `onContextMenu` on DashboardCard; 3-dot kebab present but incomplete

## Fix Instructions

In `frontend/src/pages/dashboards/index.tsx`:

1. Import Radix UI ContextMenu: `import * as ContextMenu from '@radix-ui/react-context-menu'`

2. Wrap the `DashboardCard`'s outer `<div>` (line 82) in `<ContextMenu.Root>` + `<ContextMenu.Trigger asChild>`. The trigger is the card div itself — `asChild` means the div receives the context menu trigger behavior without adding a wrapper element.

3. Add a `<ContextMenu.Portal>` + `<ContextMenu.Content>` with the RC-DASH-1 items. Permission checks:
   - Always show: Open, Open in New Tab, Duplicate, Share, Delete
   - Show "Edit in Designer" only when user has `dashboards:write`
   - Show "Publish/Unpublish" only when user has `dashboards:publish`
   - "Delete": always visible but grayed (`disabled` prop) when `dashboard.published === true`, tooltip "Unpublish before deleting"

4. Actions:
   - **Open**: `navigate(\`/dashboards/${dashboard.id}\`)`
   - **Open in New Tab**: `window.open(\`/dashboards/${dashboard.id}\`, '_blank')`
   - **Edit in Designer**: `navigate(\`/dashboards/${dashboard.id}/edit\`)`
   - **Duplicate**: call existing `onDuplicate(dashboard.id)`
   - **Publish/Unpublish**: call a publish/unpublish mutation (see `dashboardsApi`); toggle based on `dashboard.published`
   - **Share**: copy URL to clipboard (same as existing Share in 3-dot menu, line 174–179)
   - **Delete**: call existing `onDelete(dashboard.id)` which already has a confirm dialog (index.tsx:390–393)

5. Keep the existing 3-dot kebab button as-is — it provides quick access for touch devices that can't right-click. Remove "Share" from the 3-dot menu to avoid duplication (it now lives in the right-click menu).

Do NOT:
- Replace the card navigation click with the context menu — clicking the card should still navigate to the dashboard.
- Build a custom `<div>` dropdown for the right-click menu — use Radix UI `ContextMenu` primitives per CX-ENTITY-CONTEXT spec.
- Hide "Delete" when published — it must be grayed (not hidden) when object has dependencies (published = has dependents).
