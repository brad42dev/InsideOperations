# I/O Frontend Right-Click and Context Menu Implementation Audit

**Date**: April 6, 2026
**Scope**: Complete audit of all right-click and context menu implementations in `/home/io/io-dev/io/frontend/src/`
**Researcher**: Claude Code

---

## Executive Summary

The I/O frontend codebase implements right-click and context menu functionality across multiple modules using a hybrid approach:

1. **Custom Context Menu Component** (`ContextMenu.tsx`) - Portal-based menu with keyboard navigation
2. **Radix UI Primitives** - For complex menus in Designer, Alerts, and Forensics modules
3. **Radix UI DropdownMenu** - For the PointContextMenu (points and alarms)
4. **Custom Implementations** - Simple onContextMenu handlers with custom menu rendering (Settings pages, Import)

**Total occurrences of `onContextMenu` handlers**: 47 across the codebase
**Major context menu systems**: 8 distinct implementations

---

## Frontend Directory Structure

### Main Pages (13 modules)
- `/pages/alerts/` - Notification templates and groups
- `/pages/console/` - Multi-pane workspace with grid layout
- `/pages/dashboards/` - Dashboard viewer with chart widgets
- `/pages/designer/` - Graphics/Dashboard/Report design canvas
- `/pages/forensics/` - Investigation workspace and evidence
- `/pages/log/` - Log entry editing
- `/pages/process/` - Single-graphic viewer
- `/pages/profile/` - User profile and preferences
- `/pages/reports/` - Report generation and history
- `/pages/rounds/` - Round templates and execution
- `/pages/settings/` - System configuration
- `/pages/shifts/` - Shift scheduling and crew management

### Shared Components
- `/shared/components/ContextMenu.tsx` - Custom portal-based menu
- `/shared/components/PointContextMenu.tsx` - Radix DropdownMenu for points/alarms
- `/shared/components/charts/` - Chart-related components
- `/shared/components/expression/` - Expression editor components
- `/shared/hooks/` - Custom React hooks
- `/shared/layout/` - Layout components
- `/shared/routes/` - Routing configuration
- `/shared/theme/` - Theme configuration
- `/shared/utils/` - Utility functions

---

## Detailed Implementation Audit

### 1. Custom ContextMenu Component
**File**: `/shared/components/ContextMenu.tsx`

**Implementation Details**:
- **Framework**: Custom React component using `ReactDOM.createPortal()`
- **Positioning**: Fixed positioning with automatic viewport boundary adjustment
- **Keyboard Support**: Arrow Up/Down navigation, Enter/Space activation, Escape to close
- **Accessibility**: `role="menu"`, `role="menuitem"`, `tabindex` management
- **Animation**: `io-context-menu-in` keyframe animation (0.08s ease)
- **Z-index**: 2000
- **preventDefault()**: Called on `onContextMenu` within menu element to prevent nested menus

**Menu Item Structure**:
```typescript
interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  divider?: boolean; // Shows divider above item
}
```

**Styling**:
- `userSelect: "none"` on items
- Hover state: `var(--io-accent-subtle)` background
- Disabled items: 50% opacity, cursor: default
- Item padding: 6px 14px

**Usage Pattern**:
```tsx
{menuState && (
  <ContextMenu
    x={menuState.x}
    y={menuState.y}
    onClose={() => setMenuState(null)}
    items={[...]}
  />
)}
```

**Where Used**:
1. **Console Module** - Tab context menu (console/index.tsx:1561)
2. **Console Module** - Workspace background context menu (console/index.tsx)
3. **Console Module** - Pane context menu (console/PaneWrapper.tsx:735)
4. **Process Module** - Canvas background context menu (process/index.tsx:2068)

---

### 2. PointContextMenu (Radix DropdownMenu)
**File**: `/shared/components/PointContextMenu.tsx`

**Implementation Details**:
- **Framework**: Radix UI `react-dropdown-menu`
- **Trigger**: Right-click (preventDefault) or 500ms long-press on touch
- **Menu Items**:
  1. Point Detail (always visible)
  2. Trend Point (shown if `console:read` permission)
  3. Investigate Point (shown if `forensics:write` permission)
  4. Report on Point (shown if `reports:read` permission)
  5. Investigate Alarm (shown if isAlarm or isAlarmElement)
  6. Copy Tag Name (always visible)

**Right-Click Handling**:
```tsx
onContextMenu={(e) => {
  e.preventDefault();
  triggerOpen();
}}
```

**Long-Press Handling** (mobile/touch):
- `onTouchStart`: Start 500ms timer
- `onTouchEnd`: Clear timer
- `onTouchMove`: Clear timer if user drags

**Z-index**: 2500 (DropdownMenu.Portal)
**Animation**: `io-dropdown-in` keyframe (0.1s ease)

**Where Used**:
1. **Designer Canvas** - Display element points (DesignerCanvas.tsx:7171)
2. **Console GraphicPane** - Point context menu trigger (panes/GraphicPane.tsx:858)
3. **Process Module** - Point context menu trigger (process/index.tsx:2107)
4. **Console PaneWrapper** - Point context menu trigger (PaneWrapper.tsx)

---

### 3. Radix UI Context Menu (ContextMenuPrimitive)
**File**: `@radix-ui/react-context-menu` (imported in multiple files)

**Implementation Details**:
- **Structured approach**: Separates Trigger from Content
- **SubMenus**: Supports nested submenus via `Sub`, `SubTrigger`, `SubContent`
- **Separators**: `ContextMenuPrimitive.Separator`
- **Portals**: Content rendered via `ContextMenuPrimitive.Portal`

#### 3a. Designer Canvas Context Menu
**File**: `/pages/designer/DesignerCanvas.tsx`

**Structure**: Radix ContextMenuPrimitive.Root → Trigger → Content

**Context Menu Sections** (RC-DES-1 through RC-DES-9):
1. **Canvas Empty** (nodeId === null):
   - Paste (disabled when clipboard empty)
   - Select All (disabled when no children)
   - Separator
   - Grid submenu
     - Show/Hide Grid toggle
     - Enable/Disable Snap to Grid toggle
     - Separator
     - Grid Size sub-submenu (presets: 4, 8, 10, 16, 32px)
   - Zoom submenu
     - Zoom In (1.25x)
     - Zoom Out (0.8x)
     - Zoom to Fit
     - Zoom to 100%
   - Separator
   - Canvas Properties…

2. **Node Selected** (nodeId !== null):
   - Select All
   - Separator
   - Edit operations: Cut, Copy, Paste, Duplicate, Delete
   - Separator
   - Group/Ungroup operations (multi-select only)
   - Arrange operations: Bring to Front, Send to Back, Bring Forward, Send Backward
   - Lock/Unlock
   - Visibility toggle
   - Node type-specific menus:
     - Display Elements: Binding operations, Point detail
     - Groups: Open in Tab, Rename
     - Symbols: Edit Symbol, Detach Instance
     - Text Blocks: Edit Text
     - Images: Replace, Properties
     - Pipes: Edit Pipe
     - Stencils: Save as Stencil

**onContextMenu Handler** (line 6453):
```tsx
<ContextMenuPrimitive.Trigger asChild onContextMenu={handleContextMenu}>
```

**handleContextMenu Function** (line 5750):
- Calculates hit position in canvas coordinates
- Performs hit test to find node at click location
- Updates ctxNodeId state and ref
- In test mode: shows PointContextMenu for display elements only
- Calls preventDefault() in test mode

**Rendering Notes**:
- Z-index: 1000 (itemStyle)
- Item padding: 6px 14px
- Font size: 12px
- Cursor: pointer
- `userSelect: "none"` on items

#### 3b. Designer TabBar Context Menu
**File**: `/pages/designer/DesignerTabBar.tsx`

**Menu Items** (per tab):
- Close
- Close Others
- Close All
- Separator
- Copy Tab Name

**Implementation**: Radix ContextMenu.Root → Trigger (individual tab) → Portal Content

#### 3c. Designer Left Palette Context Menu
**File**: `/pages/designer/DesignerLeftPalette.tsx`

**Menu Items** (per palette shape):
- Duplicate Shape
- Edit Shape (custom shapes only)
- Rename Shape (custom shapes only)
- Separator
- Delete Shape (custom shapes only)

**Implementation**: Radix ContextMenuPrimitive.Root → Trigger (each shape) → Portal Content

#### 3d. Designer Right Panel Context Menu
**File**: `/pages/designer/DesignerRightPanel.tsx`

**Uses**: Radix ContextMenuPrimitive for component properties context menus

#### 3e. Alerts Module Context Menu
**File**: `/pages/alerts/index.tsx`

**Menu Items** (per notification template):
- Edit
- Duplicate
- Delete (if deletable)
- Separator
- Toggle Enabled

**Implementation**: Radix ContextMenuPrimitive.Root → Trigger (template card) → Portal Content

#### 3f. Forensics Module Context Menu
**File**: `/pages/forensics/index.tsx`

**Menu Items** (per investigation):
- Open
- Duplicate
- Delete
- Separator
- Toggle Starred

**Implementation**: Radix ContextMenu.Root → Trigger → Portal Content

#### 3g. Console Palette Context Menu
**File**: `/pages/console/ConsolePalette.tsx`

**Two Context Menu Types**:

1. **Pane Card Context Menu** (RadixContextMenu.Root):
   - Duplicate
   - Remove from Palette
   - Separator
   - Preview

2. **Workspace Thumbnail Context Menu** (RadixContextMenu.Root):
   - Edit Name…
   - Duplicate
   - Delete
   - Separator
   - Toggle Favorite
   - Open in New Window
   - Open Detached

**Implementation Notes**:
- Each card/thumbnail wrapped in RadixContextMenu.Root
- Multiple context menus on single page
- Three instances of `onContextMenu={(e) => e.preventDefault()}` (lines 702, 982, 1825)
  - These prevent default browser context menu on preview areas

---

### 4. Console Module Right-Click Implementation
**File**: `/pages/console/index.tsx`

#### Workspace Tab Context Menu
**Handler** (line 954):
```tsx
const handleTabContextMenu = useCallback(
  (e: React.MouseEvent, workspaceId: string) => {
    e.preventDefault();
    setTabContextMenu({ x: e.clientX, y: e.clientY, workspaceId });
  },
  [],
);
```

**Menu Items** (rendered via ContextMenu component):
- Switch to Workspace
- Open in New Window
- Add to Favorites / Remove from Favorites
- Rename…
- Delete Workspace…
- Duplicate Workspace…
- Lock/Unlock Workspace

**onContextMenu Placement** (line 1566):
```tsx
onContextMenu={(e) => handleTabContextMenu(e, ws.id)}
```

#### Workspace Background Context Menu
**Handler** (line ~948):
```tsx
const handleWorkspaceContextMenu = useCallback((x: number, y: number) => {
  setWorkspaceBgCtxMenu({ x, y });
}, []);
```

**Menu Items** (rendered via ContextMenu component):
- Add Pane
- Add Panel (if not locked)
- Layout Template submenu (16 even + 8 asymmetric templates)
- Separator
- Lock/Unlock Workspace
- Clear Filters

#### WorkspaceGrid Context Menu
**File**: `/pages/console/WorkspaceGrid.tsx`

**Handler** (line 622):
```tsx
const handleGridContextMenu = useCallback(
  (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const isPaneArea = !!target.closest("[data-pane-id]");
    if (!isPaneArea && onWorkspaceContextMenu) {
      e.preventDefault();
      onWorkspaceContextMenu(e.clientX, e.clientY);
    }
  },
  [onWorkspaceContextMenu],
);
```

**Key Feature**: Only triggers on grid background, not on pane elements

---

### 5. Pane Context Menu
**File**: `/pages/console/PaneWrapper.tsx`

**Handler** (line 293):
```tsx
onContextMenu={(e) => {
  const target = e.target as HTMLElement;
  if (target.closest("[data-point-id]")) return; // Skip for point elements
  e.preventDefault();
  e.stopPropagation();
  setPaneCtxMenu({ x: e.clientX, y: e.clientY });
}}
```

**Menu Items** (rendered via ContextMenu component):
1. Full Screen / Exit Full Screen
2. Open in New Window (if workspaceId)
3. Copy
4. Duplicate
5. Replace…
6. Swap With…
7. Separator
8. Configure Pane…
9. Zoom to Fit (graphic panes only)
10. Reset Zoom (graphic panes only)
11. Open in Designer (if graphicId)
12. Separator
13. Remove Pane

**Header Context Menu** (line 342):
- Same menu items as pane context menu
- Triggered from pane header drag handle area

---

### 6. Trend Pane Context Menu
**File**: `/pages/console/panes/TrendPane.tsx`

#### ChartRenderer Mode (line 534):
```tsx
const handleContextMenu = (e: React.MouseEvent) => {
  e.stopPropagation();
  if (!chartConfig) return;
  
  // Special handling for WebGL canvas (3D charts)
  const target = e.target as HTMLElement;
  if (target.tagName === "CANVAS") {
    const canvas = target as HTMLCanvasElement;
    if (canvas.getContext("webgl") || canvas.getContext("webgl2")) {
      e.preventDefault();
      return; // Suppress context menu to avoid disrupting rotation
    }
  }
  
  e.preventDefault();
  setCtxMenu({ x: e.clientX, y: e.clientY });
};
```

#### Legacy Mode (line 759):
```tsx
function handleLegacyContextMenu(e: React.MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  setCtxMenu({ x: e.clientX, y: e.clientY });
}
```

**Menu Items** (custom rendering):
- Save Chart
- Edit Chart
- Export Chart
- Separator
- Toggle Grid
- Toggle Legend
- Zoom options

---

### 7. GraphicPane Context Menu
**File**: `/pages/console/panes/GraphicPane.tsx`

**Handler** (line ~826):
```tsx
const handleSvgContextMenu = useCallback(
  (e: React.MouseEvent<HTMLDivElement>) => {
    const pointId = findPointId(e.target);
    if (!pointId) return; // Only for point-bound elements
    
    e.preventDefault();
    e.stopPropagation();
    
    const pv = tooltipValuesRef.current.get(pointId);
    const tagName = pointId;
    const isAlarm = pv?.quality === "alarm";
    
    setPointCtxMenu({
      x: e.clientX,
      y: e.clientY,
      pointId,
      tagName,
      isAlarm,
      isAlarmElement: false,
    });
  },
  [...]
);
```

**Key Feature**: Only shows menu for point-bound elements (via `data-point-id` lookup)

---

### 8. Process Module Context Menu
**File**: `/pages/process/index.tsx`

#### Container Context Menu
**Handler** (line ~1785):
```tsx
const handleContainerContextMenu = useCallback(
  (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pointId = findPointId(e.target);
    if (pointId) {
      const isAlarmElement = findIsAlarmElement(e.target);
      setPointCtxMenu({
        x: e.clientX,
        y: e.clientY,
        pointId,
        isAlarmElement,
      });
    } else {
      setCanvasCtxMenu({ x: e.clientX, y: e.clientY });
    }
  },
  [...]
);
```

#### Canvas Context Menu (background)
**Menu Items** (rendered via ContextMenu component):
- Zoom to Fit
- Zoom to 100%
- Bookmark This View…
- Open in Designer

#### Point Context Menu
- Uses shared PointContextMenu component
- Positioned at right-click/long-press location

#### Long-Press Support (line 914):
```tsx
const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

// Start timer on pointer down
longPressTimer.current = setTimeout(() => {
  longPressTimer.current = null;
  longPressOrigin.current = null;
  // Show context menu
}, 500);

// Clear timer on pointer up or move
```

---

### 9. Settings Pages Context Menus
**Files**: Multiple settings pages using custom context menu rendering

#### Implementation Pattern
Each settings page implements a simple custom context menu:

```tsx
function handleContextMenu(e: React.MouseEvent, item: T) {
  e.preventDefault();
  setContextMenu({ item, pos: { x: e.clientX, y: e.clientY } });
}
```

#### Pages Implementing Context Menus:

1. **Users** (`/settings/Users.tsx` - line 1036)
   - Menu Items: Edit, Delete, Reset Password

2. **Groups** (`/settings/Groups.tsx` - line 1198)
   - Menu Items: Edit, Delete

3. **Roles** (`/settings/Roles.tsx` - line 1057)
   - Menu Items: Edit, Delete, Clone Role

4. **OPC Sources** (`/settings/OpcSources.tsx` - line 2933)
   - Menu Items: Edit, Delete, Test Connection

5. **Certificates** (`/settings/Certificates.tsx` - line 669)
   - Menu Items: View, Download, Delete

6. **Recognition** (`/settings/Recognition.tsx` - line 463)
   - Menu Items: Edit, Delete, Test Model

7. **Import** (`/settings/Import.tsx` - lines 1018, 2857)
   - **ImportConnectionContextMenu** (custom menu):
     - Test Connection
     - Toggle Enable/Disable
     - Delete Connection
   - **ImportDefinitionContextMenu** (custom menu):
     - Run Now
     - View Run History
     - Toggle Enable/Disable

**Custom Menu Rendering** (Import.tsx):
- Uses `useContextMenuDismiss` hook for closing
- Inline `<div>` with `role="menu"` and `role="menuitem"` items
- Positioned via inline styles (`top: pos.y, left: pos.x`)
- Z-index: 2000

---

### 10. Dashboard Widgets Context Menu
**File**: `/pages/dashboards/widgets/LineChart.tsx`

**Handler** (line 219):
```tsx
onContextMenu={(e) => {
  e.preventDefault();
  e.stopPropagation();
  // Custom handling
}}
```

---

### 11. Designer Canvas Display Elements
**File**: `/pages/designer/DesignerCanvas.tsx`

**DisplayElementRenderer Component** (line 709):
```tsx
const handleContextMenu = useCallback(
  (e: React.MouseEvent<SVGGElement>) => {
    if (!pointCtxMenuSetter) return;
    e.preventDefault();
    e.stopPropagation();
    const pointId = de.binding.pointId || "";
    pointCtxMenuSetter({
      pointId,
      tagName: pointId,
      x: e.clientX,
      y: e.clientY,
    });
  },
  [pointCtxMenuSetter, de.binding.pointId],
);
```

**Applied to SVG Elements**:
- text_readout (line 741)
- gauge (line 782)
- led (line 827)
- traffic_light (line 851)
- state_indicator (line 887)

---

## Right-Click Prevention Implementations

### explicit preventDefault() Calls
1. **ContextMenu.tsx** (line 139): `onContextMenu={(e) => e.preventDefault()}`
   - Prevents right-click on menu itself

2. **PointContextMenu.tsx** (line 155): `onContextMenu={(e) => e.preventDefault()}`
   - Prevents right-click on dropdown trigger

3. **ConsolePalette.tsx** (lines 702, 982, 1825): `onContextMenu={(e) => e.preventDefault()}`
   - Prevents browser context menu on preview areas

4. **TrendPane.tsx** (line 534): Custom logic with preventDefault() for WebGL canvas detection

### Event Handler Chaining
- Multiple handlers use `e.stopPropagation()` to prevent bubbling
- Most handlers call both `e.preventDefault()` and `e.stopPropagation()`

---

## Long-Press Support (Mobile/Touch)

### PointContextMenu Implementation
**File**: `/shared/components/PointContextMenu.tsx` (lines 162-176)

```tsx
onTouchStart={() => {
  longPressTimer.current = setTimeout(() => triggerOpen(), 500);
}}
onTouchEnd={() => {
  if (longPressTimer.current) {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }
}}
onTouchMove={() => {
  if (longPressTimer.current) {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }
}}
```

### Process Module Implementation
**File**: `/pages/process/index.tsx` (lines 914-1000)

- Tracks long-press origin position
- Clears timer on touch move (if distance > threshold)
- Shows context menu after 500ms without movement

---

## Keyboard Navigation

### ContextMenu Component
- **Arrow Up/Down**: Navigate menu items, wraps at ends
- **Enter/Space**: Activate focused item
- **Escape**: Close menu
- **First Item Focus**: Auto-focuses first non-disabled item on open

### Implementation** (ContextMenu.tsx, lines 67-89)
```tsx
if (e.key === "ArrowDown" || e.key === "ArrowUp") {
  e.preventDefault();
  const items = Array.from(
    menuRef.current.querySelectorAll<HTMLElement>(
      "[data-menu-item]:not([data-disabled])"
    )
  );
  if (items.length === 0) return;
  const focused = document.activeElement as HTMLElement;
  const idx = items.indexOf(focused);
  if (e.key === "ArrowDown") {
    const next = idx < items.length - 1 ? items[idx + 1] : items[0];
    next?.focus();
  } else {
    const prev = idx > 0 ? items[idx - 1] : items[items.length - 1];
    prev?.focus();
  }
}
```

---

## Styling and Visual Design

### Color Variables Used
- `var(--io-surface)` - Background
- `var(--io-surface-elevated)` - Elevated background
- `var(--io-surface-secondary)` - Secondary background
- `var(--io-border)` - Border color
- `var(--io-text-primary)` - Primary text
- `var(--io-text-muted)` - Muted text
- `var(--io-accent)` - Accent/highlight
- `var(--io-accent-subtle)` - Subtle accent (hover state)

### Animations
- **ContextMenu**: `io-context-menu-in` (0.08s ease)
  - From: opacity 0, scale 0.97, translateY -3px
  - To: opacity 1, scale 1, translateY 0
  
- **DropdownMenu**: `io-dropdown-in` (0.1s ease)
  - From: opacity 0, scale 0.96, translateY -4px
  - To: opacity 1, scale 1, translateY 0

### Z-Index Hierarchy
- DropdownMenu (PointContextMenu): 2500
- ContextMenu: 2000
- Designer Canvas Items: 1000

### Item Styling
- **Padding**: 6px 14px (ContextMenu), 7px 10px (PointContextMenu)
- **Font Size**: 12-13px
- **Cursor**: pointer (normal), default (disabled)
- **Hover**: `var(--io-accent-subtle)` background
- **Disabled**: 50% opacity, cursor default, text color muted

---

## Global Context Menu Prevention

### Document-Level Listeners
No global document-level context menu prevention found. All preventDefault() calls are element-specific.

### CSS User-Select
- Inline `userSelect: "none"` on menu items (ContextMenu.tsx, PointContextMenu.tsx)
- No global `user-select: none` in index.css

---

## Accessibility Implementation

### ARIA Attributes
- `role="menu"` on menu container
- `role="menuitem"` on individual items
- `tabindex={0}` or `-1` on items (based on disabled state)
- `aria-disabled={item.disabled}` on items

### Focus Management
- Auto-focus first item on menu open
- Focus returns to trigger on close (Radix UI DropdownMenu handles this)
- Focus trap within menu (keyboard navigation wraps)

### Keyboard Support
- Full keyboard navigation (arrows, Enter, Escape)
- Shortcuts displayed on menu items (kbd elements)
- Screen reader announcements (via ARIA roles)

---

## Permission-Based Menu Items

### PointContextMenu
- **Trend Point**: Hidden if no `console:read` permission
- **Investigate Point**: Hidden if no `forensics:write` permission
- **Report on Point**: Hidden if no `reports:read` permission
- **Investigate Alarm**: Hidden if not alarm and not alarm element
- **Point Detail**: Always visible

### Designer Canvas
- Some menu items disabled based on selection state
- All items visible but disabled when conditions not met

### Settings Pages
- Visibility controlled by permission checks in parent component
- Full delete operations require confirmation dialogs

---

## Special Cases and Edge Conditions

### Designer Canvas
- **Test Mode**: Suppress edit-mode Radix context menu, show PointContextMenu for display elements only
- **WebGL Canvas** (TrendPane): preventDefault() called for WebGL detection, but not for 2D canvas context menu

### GraphicPane
- **Point Finder**: Uses `findPointId()` utility to locate point at click location
- **Tooltip Value Cache**: Resolves alarm state from cached values (quality === "alarm")
- **Point Context Menu Only**: Menu only appears for point-bound elements (has `data-point-id`)

### Pane Context Menu
- **Point Element Exclusion**: Checks `target.closest("[data-point-id]")` to skip point-specific context menus
- **Pane ID Tracking**: Uses `data-pane-id` attribute for identification

### Long-Press Detection
- **Process Module**: Tracks origin position, clears timer on move
- **PointContextMenu**: Simpler 500ms timer without position tracking
- **Threshold**: 500ms timeout before menu appears

---

## Missing or Incomplete Implementations

### Possible Gaps
1. **No global context menu suppression** - Each module implements its own prevention
2. **No CSS user-select: none globally** - Only inline styles on specific components
3. **No custom browser context menu replacement on canvas backgrounds** - Uses Radix or custom components instead

### Consistency Issues
1. **Multiple context menu implementations**:
   - Custom ContextMenu component (custom solution)
   - Radix UI ContextMenuPrimitive (designer, alerts, forensics)
   - Radix UI DropdownMenu (points/alarms)
   - Custom div-based menus (settings imports)

2. **Inconsistent menu positioning**:
   - Custom ContextMenu: Automatic viewport boundary adjustment
   - Radix UI: Uses Radix positioning (sideOffset, align)
   - Settings imports: Inline style positioning

3. **Different styling approaches**:
   - ContextMenu: Portal-based with global z-index
   - Radix UI: Uses Radix theming
   - Settings: Inline styles

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| onContextMenu handlers | 47 |
| Pages with context menus | 13 |
| Shared context menu components | 2 |
| Radix UI implementations | 5 (Designer, Alerts, Forensics, Console Palette, TabBar) |
| Custom implementations | 7+ (Settings, Import, Dashboards) |
| Long-press implementations | 2 |
| Permission-gated menu items | 3 |
| preventDefault() instances | 8+ explicit |

---

## Recommendations

1. **Standardize on Radix UI**: Consider migrating custom ContextMenu and settings context menus to Radix UI for consistency
2. **Centralize Menu Item Rendering**: Create a higher-order component wrapper around Radix primitives
3. **Document Permission Model**: Create a utility for permission-based menu item visibility
4. **Add Global Tests**: Test context menu positioning near viewport edges
5. **Mobile UX**: Ensure long-press duration (500ms) is optimal for all touch devices

---

## References

### Framework Documentation
- **Radix UI Context Menu**: `@radix-ui/react-context-menu`
- **Radix UI Dropdown Menu**: `@radix-ui/react-dropdown-menu`
- **React**: Portal API, useRef, useState, useCallback hooks

### Files Audited
All files listed in the "Detailed Implementation Audit" section above, totaling 30+ component files across 13 page modules.

---

*End of Research Document*
