# Right-Click / Context Menu Universal Implementation Plan

> Research source: `/docs/rightclick-research/` — 6 files, ~115KB of research
> Authority: spec_docs win over design-docs. DOC 32 is the point context menu authority.

---

## Executive Summary

The I/O frontend has 47 scattered `onContextMenu` handlers across 8 distinct implementation styles (custom `ContextMenu.tsx`, Radix `ContextMenuPrimitive`, Radix `DropdownMenu`, inline div-based menus in Settings). There is **no global contextmenu prevention** — the browser's native context menu appears on any element without an explicit handler.

This plan consolidates all context menu behavior behind a single architectural system across 8 phases, ensuring the browser default never appears, all spec-defined behaviors are implemented, every surface has coverage, and new features cannot ship without right-click support.

**Current state:**
- 47 `onContextMenu` handlers, 8+ implementation patterns
- No global `contextmenu` event prevention
- No z-index consistency (values range from 1000 to 2500)
- Settings module uses inline div-based menus instead of shared components
- DataTable component has no context menu support at all
- Charts (39+ widget types) have no context menus
- Reports, Rounds, Shifts, Log modules have zero context menu coverage

**Target state:**
- 1 global prevention handler + 1 unified `ContextMenu` component (enhanced)
- All modules covered with consistent context menus
- Z-index standardized at 1800 (above modules at 1000, below modals at 2000)
- DataTable supports `onRowContextMenu` natively
- Developer checklist enforces coverage on every new feature

---

## Architecture Overview

### Component Hierarchy

```
document (global contextmenu listener — preventDefault on everything)
  |
  +-- AppShell.tsx (mounts global listener via useEffect)
       |
       +-- Per-module pages
            |
            +-- Elements with specific context menus:
                 |
                 +-- ContextMenu (enhanced, portal-based, shared component)
                 |     Rendered to document.body via portal
                 |     z-index: 1800
                 |     Keyboard nav, animation, permission gating, submenus
                 |
                 +-- PointContextMenu (wraps ContextMenu for point-bound elements)
                       Adds point-specific actions
                       Long-press 500ms for mobile
```

### Standardization Decision: Custom ContextMenu over Radix ContextMenuPrimitive

**Rationale:** The existing custom `ContextMenu.tsx` is already portal-based with keyboard navigation, ARIA roles, and viewport adjustment. Radix `ContextMenuPrimitive` requires wrapping every trigger element in `<ContextMenuPrimitive.Root>`, which is invasive for retroactive adoption across 144+ pages. The custom component takes `(x, y)` coordinates and an items array — it can be dropped into any `onContextMenu` handler with minimal refactoring.

**Migration strategy:** Existing Radix-based menus (Designer, Alerts, Forensics, Console Palette) continue to use Radix where already integrated. All NEW menus and all Settings/unspecced menus use the enhanced `ContextMenu.tsx`. Over time, as modules are touched, Radix usages can optionally be migrated, but this is not required.

### Z-Index Standard

| Layer | Z-Index | Purpose |
|-------|---------|---------|
| Module content | 1000 | Normal page content |
| Context menus | 1800 | All context menus (unified) |
| Modals/dialogs | 2000 | Modal overlays |
| Emergency overlay | 9999 | Emergency alert banner |

### Permission Gating

All context menu items use the `usePermission` hook (or `hasPermission` for non-React contexts). Unauthorized items are **hidden** (not disabled/grayed). The enhanced ContextMenu component accepts a `permission` field on each item and handles this automatically.

---

## Shared Component Requirements

### Enhanced ContextMenu.tsx (`/frontend/src/shared/components/ContextMenu.tsx`)

The existing component needs these enhancements:

1. **Submenu support** — nested menus for items like "Grid Settings > ..." or "Zoom > ..."
2. **Permission field** on `ContextMenuItem` — `permission?: string` — item is hidden if user lacks permission
3. **Danger/destructive styling** — `danger?: boolean` on items renders them in red/warning color
4. **Z-index fix** — change from 2000 to 1800
5. **Home/End keyboard support** — currently only ArrowUp/Down; add Home (first item) and End (last item)
6. **`onContextMenu` self-prevention** — already present (`e.preventDefault()` on the menu itself)
7. **Submenu arrow indicator** — visual chevron for items that open submenus
8. **Icon column alignment** — reserve 16px icon column even when some items lack icons

Updated interface:
```typescript
export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  divider?: boolean;
  permission?: string;          // NEW: hidden if user lacks permission
  danger?: boolean;             // NEW: red text for destructive actions
  children?: ContextMenuItem[]; // NEW: submenu items
}
```

### New: `useContextMenu` Hook (`/frontend/src/shared/hooks/useContextMenu.ts`)

```typescript
interface UseContextMenuReturn<T = undefined> {
  menuState: { x: number; y: number; data?: T } | null;
  handleContextMenu: (e: React.MouseEvent, data?: T) => void;
  closeMenu: () => void;
}

export function useContextMenu<T = undefined>() {
  const [menuState, setMenuState] = useState<{ x: number; y: number; data?: T } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, data?: T) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuState({ x: e.clientX, y: e.clientY, data });
  }, []);

  const closeMenu = useCallback(() => setMenuState(null), []);

  return { menuState, handleContextMenu, closeMenu };
}
```

### New: `useLongPress` Hook (`/frontend/src/shared/hooks/useLongPress.ts`)

Extracts the 500ms long-press pattern from PointContextMenu into a reusable hook for any context menu on mobile. Returns `{ onTouchStart, onTouchEnd, onTouchMove }` handlers. Clears on move >10px or touchEnd before threshold.

---

## Phase 1: Foundation — Global Prevention and Shared Component Enhancement

### Goal
Prevent the browser's native context menu from appearing anywhere in the application. Enhance the shared ContextMenu component to be production-ready for all use cases.

### Dependencies
None — this is the foundation.

### Files to Create or Modify

**1. `/frontend/src/shared/layout/AppShell.tsx`** — Add global contextmenu listener

Add a `useEffect` in AppShell:
```typescript
useEffect(() => {
  const handler = (e: MouseEvent) => {
    e.preventDefault();
  };
  document.addEventListener("contextmenu", handler);
  return () => document.removeEventListener("contextmenu", handler);
}, []);
```

The global handler only calls `preventDefault()` — does NOT call `stopPropagation()`. This means module-level handlers still receive the event via normal bubbling. The global handler fires last (document level) and ensures the browser never opens its default menu. Individual components call `e.stopPropagation()` to prevent bubbling past their own handler if needed.

**2. `/frontend/src/shared/components/ContextMenu.tsx`** — Enhance existing component

Changes:
- Add `permission?: string`, `danger?: boolean`, `children?: ContextMenuItem[]` to `ContextMenuItem` interface
- Change z-index from 2000 to 1800
- Add Home/End key handling in keyboard listener
- Add submenu rendering (on hover/ArrowRight, show nested ContextMenu at offset position)
- Filter out items where `permission` is set but user lacks it (use `hasPermission` from auth store — filter inside component render with useMemo)
- Add `danger` styling: `color: var(--io-danger)` when `item.danger === true`
- Move `@keyframes io-context-menu-in` out of inline `<style>` into index.css (inject only once globally)
- Submenu arrow indicator: chevron-right icon on items with `children`

**3. `/frontend/src/shared/hooks/useContextMenu.ts`** — New file

See interface definition above.

**4. `/frontend/src/shared/hooks/useLongPress.ts`** — New file

500ms long-press hook for mobile equivalent of right-click.

**5. `/frontend/src/index.css`** — Add context menu animation globally

Move `@keyframes io-context-menu-in` and `io-dropdown-in` from ContextMenu.tsx inline style to global CSS.

### Acceptance Criteria
- Right-clicking anywhere in the application (any page, any element, any empty space) NEVER shows the browser's native context menu
- The enhanced ContextMenu component supports submenus, permission gating, and danger styling
- `useContextMenu` and `useLongPress` hooks are available
- Z-index of all context menus is 1800
- Existing functionality is not broken (Designer, Console, Process, Alerts, Forensics menus all still work)
- `pnpm build` passes, `pnpm test` passes

---

## Phase 2: Unify Existing Implementations — Settings Module and Z-Index Fixes

### Goal
Migrate the 7+ custom inline-div context menus in Settings and the Import page to use the shared ContextMenu component. Fix z-index inconsistencies across ALL existing implementations.

### Dependencies
Phase 1 complete.

### Files to Modify

**1–7. Settings pages** — Replace inline div context menus with `useContextMenu` hook + `<ContextMenu>` component:

- `settings/Users.tsx` → Edit User, Reset Password | Delete User (danger) | permission: `settings:users:write`
- `settings/Groups.tsx` → Edit Group | Delete Group (danger) | permission: `settings:groups:write`
- `settings/Roles.tsx` → Edit Role, Clone Role | Delete Role (danger) | permission: `settings:roles:write`
- `settings/OpcSources.tsx` → Edit Source, Test Connection | Delete Source (danger) | permission: `settings:opc:write`
- `settings/Certificates.tsx` → View Certificate, Download Certificate | Delete Certificate (danger) | permission: `settings:certs:write`
- `settings/Recognition.tsx` → Edit Model, Test Model | Delete Model (danger) | permission: `settings:recognition:write`
- `settings/Import.tsx` → Connection: Test, Toggle Enable/Disable | Delete (danger). Definition: Run Now, View History, Toggle Enable/Disable | Delete (danger)

**8. `/frontend/src/shared/components/PointContextMenu.tsx`**
- Change z-index from 2500 to 1800

**9. All existing Radix ContextMenu usages**
- Update `contentStyle` z-index from 1000 to 1800 in:
  - `pages/designer/DesignerCanvas.tsx`
  - `pages/designer/DesignerLeftPalette.tsx`
  - `pages/designer/DesignerRightPanel.tsx`
  - `pages/alerts/index.tsx`
  - `pages/forensics/index.tsx`
  - `pages/console/ConsolePalette.tsx` (if applicable)

### Acceptance Criteria
- All Settings pages use shared ContextMenu component (no inline div menus)
- All context menus across the application render at z-index 1800
- Visual appearance is consistent (same font size, padding, hover colors, animation)
- Permission gating works on all Settings menus
- `pnpm build` passes, `pnpm test` passes

---

## Phase 3: Spec-Defined Behaviors — Point Context Menu Everywhere

### Goal
Ensure the Universal Point Context Menu (DOC 32 authority) appears on every point-bound element across all modules.

### Dependencies
Phase 1 complete.

### Files to Modify

**1. `/frontend/src/shared/components/DataTable.tsx`** — Add `onRowContextMenu` prop

```typescript
// Add to props interface:
onRowContextMenu?: (e: React.MouseEvent, row: T) => void;

// In row rendering:
onContextMenu={onRowContextMenu ? (e) => {
  e.preventDefault();
  e.stopPropagation();
  onRowContextMenu(e, row.original);
} : undefined}
```

**2. Dashboard widgets** — Verify/add PointContextMenu wrapping:
- `dashboards/widgets/LineChart.tsx` — wrap container, map ECharts click event to point ID
- `dashboards/widgets/TrendChartWidget.tsx` — wrap chart area
- `dashboards/widgets/BarChart.tsx` — wrap container
- `dashboards/widgets/PieChart.tsx` — wrap container
- `dashboards/widgets/GaugeWidget.tsx` — verify already wrapped
- `dashboards/widgets/KpiCard.tsx` — verify already wrapped
- `dashboards/widgets/AlertStatusWidget.tsx` — verify already wrapped
- `dashboards/widgets/AlarmListWidget.tsx` — verify, add `isAlarm={true}` to PointContextMenu
- `dashboards/widgets/PointStatusTableWidget.tsx` — add PointContextMenu to rows with point IDs
- `dashboards/widgets/AreaStatusTableWidget.tsx` — add PointContextMenu to rows
- `dashboards/widgets/TableWidget.tsx` — verify already wrapped

**3. `/frontend/src/pages/console/panes/AlarmListPane.tsx`**
- Wrap each alarm row in PointContextMenu with `isAlarm={true}`

**4. `/frontend/src/pages/console/panes/PointTablePane.tsx`**
- Verify PointContextMenu on every row that has a point ID

### Universal Point Context Menu Items
| Item | Action | Permission | Condition |
|------|--------|------------|-----------|
| Copy Tag Name | Copy to clipboard | None | Always |
| Point Detail | Open floating panel | `console:read` | Always |
| Trend Point | Full-screen 24h trend | `console:read` | Always |
| Investigate Point | Create Forensics investigation | `forensics:write` | Always |
| Report on Point | Open report generator | `reports:read` | Always |
| — separator — | | | |
| Investigate Alarm | Create alarm investigation | `forensics:write` | Only when `isAlarm={true}` |

### Acceptance Criteria
- Right-clicking any point-bound element in Console, Process, Dashboards, alarm lists, and point tables opens Point Context Menu
- Long-press (500ms) on mobile triggers same menu
- Permission gating hides items correctly
- DataTable supports `onRowContextMenu` prop
- `pnpm build` passes, `pnpm test` passes

---

## Phase 4: Spec-Defined Behaviors — Designer and Expression Builder

### Goal
Complete all spec-defined context menu behaviors in Designer and Expression Builder. Verify against DESIGNER_WORK_QUEUE.md §3.4.

### Dependencies
Phase 1 complete.

### Files to Modify

**1. `/frontend/src/pages/designer/DesignerCanvas.tsx`** — Verify and complete

**On selected node:**
- Cut, Copy, Paste, Delete, Duplicate
- — separator —
- Group / Ungroup (multi-select only)
- — separator —
- Bring to Front, Send to Back, Bring Forward, Send Backward
- — separator —
- Rotate 90° CW, Rotate 90° CCW, Flip H, Flip V
- — separator —
- Lock / Unlock, Toggle Visibility
- — separator —
- Properties / Bindings
- Save as Stencil… (permission: `designer:write`)
- Promote to Shape… (permission: `designer:write`)
- Switch Variant (only on shape instances)
- Export Shape SVG (only on shapes)

**On empty canvas:**
- Paste, Select All
- — separator —
- Zoom to Fit, Zoom to 100%
- — separator —
- Grid Settings (submenu: Show Grid, Snap to Grid, Grid Size 8/16/32/64px)
- — separator —
- Validate Bindings
- Canvas Properties

**On pipe:**
- Service Type (submenu: process, gas_vapor, steam, water, fuel_gas, chemical, instrument_air, drain)

**2. `/frontend/src/pages/designer/DesignerLeftPalette.tsx`** — Verify stencil context menu
- Promote to Shape (stencils only)
- Export SVG (all shapes/stencils)
- Replace SVG… (user-created shapes only, permission: `designer:write`)

**3. `/frontend/src/pages/designer/DesignerRightPanel.tsx`** — Verify layer panel context menu
- Toggle Visibility, Toggle Lock, Rename, Add Layer, Delete Layer, Duplicate Layer

**4. Designer tab bar** — Verify tab context menu
- Close, Close Others, Close All, Copy Tab Name

**5. Expression Builder tile workspace** (wherever rendered)
- Right-click selected tile(s): Cut, Copy, Delete Tile(s)
- Right-click unselected tile: Copy, Delete
- Right-click empty workspace: Paste, Select All
- Right-click inside container tile: Paste (inside container)
- All Delete operations show confirmation: "Delete [N] tile(s)? This cannot be undone."

### Acceptance Criteria
- Every Designer context menu item from DOC 09 spec works
- Every Expression Builder context menu item from DOC 23 spec works
- Shape variant switching works via right-click
- Pipe service type assignment works via right-click submenu
- All items are permission-gated per spec
- `pnpm build` passes, `pnpm test` passes

---

## Phase 5: Spec-Defined Behaviors — Console, Process, and Export

### Goal
Complete all spec-defined context menu behaviors for Console workspace/pane operations, Process canvas, and .iographic export.

### Dependencies
Phases 1 and 3 complete.

### Files to Modify

**1. `/frontend/src/pages/console/index.tsx`** — Workspace tab context menu
- Switch to Workspace, Open in New Window
- — separator —
- Add to Favorites / Remove from Favorites, Rename, Duplicate Workspace
- — separator —
- Lock / Unlock Workspace
- **Publish / Unpublish** (permission: `console:workspace_publish`) ← specced, may be missing
- — separator —
- Delete Workspace (danger, permission: `console:workspace_write`)

**2. `/frontend/src/pages/console/WorkspaceGrid.tsx`** — Background context menu
- Add Pane, Layout Template (submenu: presets)
- — separator —
- Lock / Unlock Workspace

**3. `/frontend/src/pages/console/PaneWrapper.tsx`** — Pane context menu
- Full Screen / Exit Full Screen, Open in New Window
- — separator —
- Copy, Duplicate, Replace Graphic, Swap With Pane
- — separator —
- Configure Pane, Zoom to Fit, Reset Zoom (graphic panes only), Open in Designer
- **Export Graphic** (permission: `designer:export`) ← specced in DOC 39
- — separator —
- Remove Pane (danger)

**4. `/frontend/src/pages/process/index.tsx`** — Canvas background context menu
- Zoom to Fit, Zoom to 100%, Bookmark This View
- — separator —
- Open in Designer
- **Export Graphic** (permission: `designer:export`) ← specced in DOC 39

**5. Detached window routes** (`/detached/console/`, `/detached/process/`, `/detached/dashboard/`)
- Verify feature-parity context menus with main application

### Acceptance Criteria
- Console workspace tabs show Publish/Unpublish in context menu
- Console panes show Export Graphic option
- Process canvas background shows Export Graphic option
- Detached windows have same context menus as main app
- All permission gates work correctly
- `pnpm build` passes, `pnpm test` passes

---

## Phase 6: Module-by-Module Rollout — Unspecced but Expected Behaviors

### Goal
Add context menus to all interactive elements lacking spec-defined menus: table rows, list items, cards, navigation items. Every module covered.

### Dependencies
Phases 1, 2, and 3 complete.

### Reports Module

**`pages/reports/ReportTemplates.tsx`** — Right-click template row
- Open, Edit (permission: `reports:write`), Duplicate (permission: `reports:write`), Export
- — separator —
- Delete (danger, permission: `reports:write`)

**`pages/reports/ReportSchedules.tsx`** — Right-click schedule row
- Edit, Run Now, Toggle Enable/Disable (permission: `reports:write`)
- — separator —
- Delete (danger, permission: `reports:write`)

**`pages/reports/ReportHistory.tsx`** — Right-click history row
- View Report, Download PDF, Download CSV (permission: `reports:read`)
- Re-run (permission: `reports:write`)
- — separator —
- Delete (danger, permission: `reports:write`)

**`pages/reports/MyExports.tsx`** — Right-click export row
- Download | Delete (danger)

### Rounds Module

**`pages/rounds/RoundTemplates.tsx`** — Right-click template
- Open, Edit, Duplicate, Print (permission: `rounds:write`) | Delete (danger)

**`pages/rounds/RoundSchedules.tsx`** — Right-click schedule
- Edit, Run Now, Toggle Enable/Disable (permission: `rounds:write`) | Delete (danger)

**`pages/rounds/ActiveRounds.tsx`** — Right-click active round
- View, Resume (permission: `rounds:execute`) | Abandon (danger)

**`pages/rounds/RoundHistory.tsx`** — Right-click history row
- View, Print, Export (permission: `rounds:read`) | Delete (danger, permission: `rounds:write`)

**`pages/rounds/TemplateDesigner.tsx`** — Right-click checkpoint
- Edit, Duplicate, Move Up, Move Down (permission: `rounds:write`) | Delete (danger)

### Shifts Module

**`pages/shifts/ShiftSchedule.tsx`** — Right-click calendar block
- Edit Shift, Copy Shift (permission: `shifts:write`) | Delete Shift (danger)

**`pages/shifts/CrewList.tsx`** — Right-click crew member
- View Profile, Edit (permission: `shifts:write`) | Remove from Crew (danger)

### Log Module

**`pages/log/index.tsx`** — Right-click log entry
- View, Edit (permission: `log:write`), Export Entry
- — separator —
- Delete (danger, permission: `log:write`)

**`pages/log/LogTemplates.tsx`** — Right-click template
- Edit, Duplicate (permission: `log:write`) | Delete (danger)

**`pages/log/LogSchedules.tsx`** — Right-click schedule
- Edit, Run Now, Toggle Enable/Disable (permission: `log:write`) | Delete (danger)

### Alerts Module (gap filling)

**`pages/alerts/ActiveAlerts.tsx`** — Right-click active alert
- Acknowledge (permission: `alerts:acknowledge`), Shelve (permission: `alerts:shelve`)
- Investigate Alarm (permission: `forensics:write`), View History

**`pages/alerts/AlertHistory.tsx`** — Right-click history row
- View Details, Investigate Alarm (permission: `forensics:write`), Export

### Forensics Module (gap filling)

**`pages/forensics/index.tsx`** — Verify/enhance investigation card context menu
- Open, Duplicate, Toggle Starred (permission: `forensics:write`)
- Export Investigation, Archive
- — separator —
- Delete (danger)

### Dashboards Module (gap filling)

**`pages/dashboards/index.tsx`** — Right-click dashboard card
- Open, Edit, Duplicate (permission: `dashboards:write`), Export
- — separator —
- Delete (danger, permission: `dashboards:write`)

**`pages/dashboards/DashboardViewer.tsx`** — Right-click widget
- Viewer mode: Refresh Widget, Export Data, Full Screen
- Edit mode: Edit Widget, Duplicate, Move to Front, Move to Back | Delete (danger)

**`pages/dashboards/PlaylistManager.tsx`** — Right-click playlist item
- Edit, Duplicate, Reorder (permission: `dashboards:write`) | Delete (danger)

### Settings Module (remaining pages)

- `settings/PointManagement.tsx` — View, Edit, Add to Trend, Export | Delete (danger) | permission: `settings:points:write`
- `settings/Sessions.tsx` — View Details | Terminate Session (danger) | permission: `settings:sessions:write`
- `settings/ExpressionLibrary.tsx` — Edit, Duplicate | Delete (danger) | permission: `settings:expressions:write`
- `settings/ExportPresets.tsx` — Edit, Duplicate | Delete (danger) | permission: `settings:export:write`
- `settings/Badges.tsx` — Edit | Delete (danger) | permission: `settings:badges:write`

### Designer List Pages

- `designer/DesignerGraphicsList.tsx` — Open, Open New Tab, Duplicate, Export (.iographic, permission: `designer:export`) | Delete (danger, permission: `designer:write`)
- `designer/DesignerDashboardsList.tsx` — Open, Open New Tab, Duplicate | Delete (danger) | permission: `designer:write`
- `designer/DesignerReportsList.tsx` — Open, Open New Tab, Duplicate | Delete (danger) | permission: `designer:write`

### Profile Pages

- `pages/profile/SessionsTab.tsx` — View Details | Terminate Session (danger)

### Acceptance Criteria
- Every table row, list item, and card across all 11 modules has a context menu
- All menus use the shared ContextMenu component
- All items are permission-gated (hidden when unauthorized)
- Destructive items use `danger: true` and confirmation dialogs after selection
- Long-press (500ms) works on mobile for all menus
- `pnpm build` passes, `pnpm test` passes

---

## Phase 7: Charts and Specialized Surfaces

### Goal
Add context menus to charts (ECharts, uPlot), the TrendPane, and remaining specialized surfaces.

### Dependencies
Phases 1 and 3 complete.

### Files to Modify

**1. Chart wrapper / ECharts integration**

For ECharts-based widgets, use the ECharts `contextmenu` event:
- When clicking ON a data point: map to point ID → show PointContextMenu (Copy Tag Name, Point Detail, Trend Point, Investigate Point, Report on Point)
- When clicking ON chart background/axis/empty area:
  - Export Chart Data (CSV)
  - Export Chart Image (PNG)
  - Toggle Legend
  - Toggle Grid Lines
  - Reset Zoom

**2. `/frontend/src/pages/console/panes/TrendPane.tsx`**

Enhance existing context menu:
- Add: Copy Value (at cursor position)
- Add: Add Point to Trend (opens point picker)
- When clicking on a specific trace: show PointContextMenu for that point

**3. uPlot chart surfaces**

Wrap uPlot chart containers with contextmenu handler:
- On chart data point (nearest): show PointContextMenu
- On chart background: show export/toggle menu

**4. Individual chart renderers with point data:**

For each renderer in `shared/components/charts/renderers/`:
- `chart01-live-trend.tsx` — point-specific menu on traces
- `chart05-bar-column.tsx` — value-specific menu on bars
- `chart06-pie-donut.tsx` — segment-specific menu
- `chart15-data-table.tsx` — row-specific menu via DataTable `onRowContextMenu`
- `chart35-state-timeline.tsx` — segment-specific menu
- `chart36-scorecard-table.tsx` — cell-specific menu

### Acceptance Criteria
- Right-clicking a data point on any chart shows Point Context Menu (when point ID available)
- Right-clicking chart background shows chart operations menu
- Chart export (CSV, PNG) works from context menu
- TrendPane has enhanced context menu per spec
- No native browser menu appears on any chart canvas
- `pnpm build` passes, `pnpm test` passes

---

## Phase 8: No Right-Click Debt — Ongoing Process

### Goal
Establish processes and documentation to ensure every new feature ships with right-click coverage.

### Dependencies
All previous phases complete.

### Deliverables

**1. `/frontend/docs/CONTEXT_MENU_CHECKLIST.md`**

```markdown
# Context Menu Checklist for New Features

Before merging any PR that adds a new interactive element:

- [ ] Every new page/view relies on the global contextmenu prevention (verify no browser default)
- [ ] Every new table uses DataTable's `onRowContextMenu` prop
- [ ] Every new list item has a context menu: at minimum Open/View, Edit, Delete
- [ ] Every new point-bound element is wrapped in PointContextMenu
- [ ] Every new chart has context menu: point menu on data points, export on background
- [ ] All context menu items have `permission` field set (empty string = no restriction)
- [ ] Destructive items have `danger: true` and post-click confirmation dialog
- [ ] Mobile long-press (500ms) triggers the same menu via useLongPress
- [ ] Context menu appears at z-index 1800 (use shared ContextMenu component)
- [ ] New menu items are documented in the module's spec or decision file

Standard menu items by element type:
| Element Type | Minimum Required Items |
|---|---|
| Table row | Open/View, Edit, Duplicate, Delete |
| List item | Open, Edit, Duplicate, Delete |
| Card | Open, Edit, Duplicate, Export, Delete |
| Chart data point | Point Context Menu (if point-bound) OR Copy Value |
| Chart background | Export Data, Export Image |
| Navigation item | Open, Open in New Tab |
| Point-bound element | Full PointContextMenu |
```

**2. PR template addition (`.github/PULL_REQUEST_TEMPLATE.md` or equivalent)**

```markdown
## Context Menu Coverage
- [ ] All new interactive elements have right-click context menus
- [ ] Point-bound elements use PointContextMenu
- [ ] N/A — this PR does not add interactive elements
```

**3. `/docs/decisions/context-menu-standard.md`**

Records:
- Architectural decision to use custom ContextMenu over Radix for new menus
- Z-index standard: 1800
- Permission gating rule: hide (not disable) unauthorized items
- Global prevention strategy
- Standard menu items by element type
- Mobile long-press: 500ms threshold

### Acceptance Criteria
- Checklist file exists at `/frontend/docs/CONTEXT_MENU_CHECKLIST.md`
- PR template includes context menu coverage checkbox
- Decision file is committed at `/docs/decisions/context-menu-standard.md`
- At least one new feature PR has been reviewed against the checklist

---

## Appendix: Complete Menu Inventory by Module

### Global / Universal
| Element | Menu Items |
|---------|-----------|
| Any point-bound element | Copy Tag Name, Point Detail, Trend Point, Investigate Point, Report on Point, (Investigate Alarm if alarm) |
| Any element with no defined menu | (silent — event consumed, no menu shown) |

### Console
| Element | Menu Items |
|---------|-----------|
| Workspace tab | Switch, Open New Window, Favorite, Rename, Duplicate, Lock/Unlock, Publish/Unpublish, Delete |
| Workspace background | Add Pane, Layout Template >, Lock/Unlock |
| Pane | Full Screen, Open New Window, Copy, Duplicate, Replace, Swap, Configure, Zoom Fit, Reset Zoom, Open in Designer, Export Graphic, Remove |
| Point element in graphic | Universal Point Context Menu |
| Alarm row | Universal Point Context Menu + Investigate Alarm |

### Process
| Element | Menu Items |
|---------|-----------|
| Canvas background | Zoom to Fit, Zoom 100%, Bookmark View, Open in Designer, Export Graphic |
| Point element | Universal Point Context Menu |

### Designer
| Element | Menu Items |
|---------|-----------|
| Selected node | Cut, Copy, Paste, Duplicate, Delete, Group/Ungroup, Arrange (4), Rotate (3), Flip (2), Lock, Visibility, Properties, Save as Stencil, Promote to Shape, Switch Variant |
| Empty canvas | Paste, Select All, Zoom to Fit, Zoom 100%, Grid >, Canvas Properties, Validate Bindings |
| Stencil in palette | Promote to Shape, Export SVG, Replace SVG |
| Layer in panel | Toggle Visibility, Toggle Lock, Rename, Add, Delete, Duplicate |
| Tab | Close, Close Others, Close All, Copy Tab Name |
| Pipe | Service Type > (8 types) |
| Graphics list item | Open, Open New Tab, Duplicate, Export, Delete |
| Dashboards list item | Open, Open New Tab, Duplicate, Delete |
| Reports list item | Open, Open New Tab, Duplicate, Delete |

### Dashboards
| Element | Menu Items |
|---------|-----------|
| Dashboard card | Open, Edit, Duplicate, Export, Delete |
| Widget (viewer) | Refresh, Export Data, Full Screen |
| Widget (editor) | Edit, Duplicate, Move Front/Back, Delete |
| Point value in widget | Universal Point Context Menu |
| Playlist item | Edit, Duplicate, Reorder, Delete |

### Reports
| Element | Menu Items |
|---------|-----------|
| Template row | Open, Edit, Duplicate, Export, Delete |
| Schedule row | Edit, Run Now, Toggle Enable, Delete |
| History row | View, Download PDF, Download CSV, Re-run, Delete |
| Export row | Download, Delete |

### Rounds
| Element | Menu Items |
|---------|-----------|
| Template item | Open, Edit, Duplicate, Print, Delete |
| Schedule item | Edit, Run Now, Toggle Enable, Delete |
| Active round | View, Resume, Abandon |
| History row | View, Print, Export, Delete |
| Checkpoint (template designer) | Edit, Duplicate, Move Up, Move Down, Delete |

### Shifts
| Element | Menu Items |
|---------|-----------|
| Calendar shift block | Edit, Copy, Delete |
| Crew member | View Profile, Edit, Remove |

### Alerts
| Element | Menu Items |
|---------|-----------|
| Template card | Edit, Duplicate, Delete, Toggle Enabled |
| Group card | Edit, Duplicate, Delete, Manage Members |
| Active alert row | Acknowledge, Shelve, Investigate Alarm, View History |
| History row | View Details, Investigate Alarm, Export |

### Forensics
| Element | Menu Items |
|---------|-----------|
| Investigation card | Open, Duplicate, Toggle Starred, Export, Archive, Delete |

### Log
| Element | Menu Items |
|---------|-----------|
| Log entry | View, Edit, Export, Delete |
| Template item | Edit, Duplicate, Delete |
| Schedule item | Edit, Run Now, Toggle Enable, Delete |

### Settings
| Element | Menu Items |
|---------|-----------|
| User row | Edit, Reset Password, Delete |
| Role row | Edit, Clone, Delete |
| Group row | Edit, Delete |
| OPC Source row | Edit, Test Connection, Delete |
| Certificate row | View, Download, Delete |
| Recognition row | Edit, Test, Delete |
| Import connection | Test, Toggle Enable, Delete |
| Import definition | Run Now, View History, Toggle Enable, Delete |
| Point row | View, Edit, Add to Trend, Export, Delete |
| Session row | View, Terminate |
| Expression row | Edit, Duplicate, Delete |
| Export preset row | Edit, Duplicate, Delete |
| Badge row | Edit, Delete |

### Expression Builder
| Element | Menu Items |
|---------|-----------|
| Selected tile(s) | Cut, Copy, Delete Tile(s), Select All |
| Unselected tile | Copy, Delete |
| Empty workspace | Paste, Select All |
| Inside container | Paste |

---

## Critical Files for Implementation Reference

| File | Relevance |
|------|-----------|
| `frontend/src/shared/layout/AppShell.tsx` | Global contextmenu prevention goes here |
| `frontend/src/shared/components/ContextMenu.tsx` | Core shared component — needs submenus, permission gating, z-index fix |
| `frontend/src/shared/components/PointContextMenu.tsx` | Universal point context menu — z-index fix, verify coverage |
| `frontend/src/shared/components/DataTable.tsx` | Needs `onRowContextMenu` prop |
| `frontend/src/shared/hooks/usePermission.ts` | Permission infrastructure for all context menu gates |
| `docs/rightclick-research/` | All research files — 6 files, 115KB |
