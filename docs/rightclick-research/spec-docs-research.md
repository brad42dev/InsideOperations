# Spec Docs Right-Click & Context Menu Research

> Compiled from comprehensive review of all spec documents in /home/io/io-dev/io/spec_docs/

---

## SPEC FILE 1: 32_SHARED_UI_COMPONENTS.md

### Universal Point Context Menu

**Trigger:** Right-click on ANY point-bound element anywhere in the application (graphic, table cell, chart data point, widget value, alarm row)

**Mobile equivalent:** Long-press (500ms)

**Architecture:** Shell-level shared component — individual modules do NOT implement their own point context menus

**Menu Items:**
1. **Point Detail** — Opens Point Detail floating panel for this point | Permission: `console:read` or module equivalent
2. **Trend Point** — Opens a full-screen trend chart for this point (last 24h default, adjustable) | Permission: `console:read` or module equivalent
3. **Investigate Point** — Creates a new Forensics investigation anchored to this point | Permission: `forensics:write`
4. **Report on Point** — Opens Report generation with this point pre-selected as the data source | Permission: `reports:read`

**Alarm-Specific Addition:**
- If user right-clicks on an **alarm** (alarm list row, alarm banner, alarm widget), an additional item appears:
- **Investigate Alarm** — Creates a new Forensics investigation anchored to this alarm | Permission: `forensics:write`

**Permission Rule:** Items the user lacks permission for are **hidden** (not grayed out).

**Point Detail Window Behavior:**
- Draggable, resizable, pinnable, minimizable
- Up to 3 concurrent instances
- Session persistence of position and size
- Z-index layer: popover (above module content, below modals and emergency overlay)

**Keyboard Shortcut:** Ctrl+I opens Point Detail panel for the hovered/selected point

---

## SPEC FILE 2: 07_CONSOLE_MODULE.md

### Point Context Menu on Graphics

- Right-click any point-bound element on a graphic opens the shared **Point Context Menu**
- Menu items: Point Detail, Trend Point, Investigate Point, Report on Point — all permission-gated
- On alarms: additional "Investigate Alarm" option appears
- Point Detail is a draggable, resizable floating window (not a slide-out)
- Up to 3 Point Detail panels can be open simultaneously
- Ctrl+I with a point selected opens Point Detail directly

### Pane Operations (Detached Windows)
- "Right-click context menus for pane operations (same as main app)" supported in minimal shell detached windows

### Workspace Tab Context Menu
- Publish/Unpublish toggle available in tab context menu

---

## SPEC FILE 3: 08_PROCESS_MODULE.md

### Point Context Menu on Graphics

- Right-click any point-bound element on the process graphic opens the shared **Point Context Menu**
- Same behavior as Console: Point Detail, Trend Point, Investigate Point, Report on Point, plus Investigate Alarm on alarm elements
- All permission-gated
- Point Detail opens as a draggable floating window, up to 3 concurrent panels
- Ctrl+I shortcut

---

## SPEC FILE 4: 09_DESIGNER_MODULE.md

### Designer Object Context Menu (right-click on selected object)
- Cut
- Copy
- Paste
- Delete
- Bring to Front
- Send to Back
- Bring Forward
- Send Backward
- Group
- Ungroup
- Rotate 90° CW / CCW
- Flip H / Flip V
- Properties / Bindings
- Save as Stencil… (enabled when elements selected) → triggers SaveAsStencilDialog
- Promote to Shape… (enabled when elements selected) → triggers PromoteToShapeWizard

### Designer Canvas Context Menu (right-click on empty canvas)
- Paste
- Select All
- Zoom to Fit
- Grid Settings
- Toggle Grid
- Validate Bindings

### Designer Layer Panel Context Menu (right-click on layer)
- Toggle visibility
- Toggle lock
- Inline rename
- Add layer
- Delete layer
- Duplicate layer

### Designer Stencil Palette Context Menu (right-click stencil tile)
- Promote to Shape
- Export SVG (triggers download)
- Replace SVG… (file picker → PUT, warns on viewBox change)
  - Library shapes show only "Export SVG"

### Designer Pipe Properties
- Service type assignment available via right-click (in addition to dropdown in properties panel)
- Service types: process, gas_vapor, steam, water, fuel_gas, chemical, instrument_air, drain

### Designer Shape Variant (right-click placed shape instance)
- "Switch Variant" — overrides global default for that specific instance

### Export Graphic (from Console/Process)
- Right-click graphic pane → "Export Graphic"
- Exports graphic as portable .iographic package

---

## SPEC FILE 5: 10_DASHBOARDS_MODULE.md

### Point Context Menu in Widgets

- Point values displayed in dashboard widgets (trend charts, KPI gauges, value tables, alert status) support the shared **Point Context Menu** (right-click on any point value)
- Menu items: Point Detail, Trend Point, Investigate Point, Report on Point, plus Investigate Alarm on alarm rows
- All items permission-gated

---

## SPEC FILE 6: 12_FORENSICS_MODULE.md

### Investigation Entry Points

- Right-click an alarm → "Investigate Alarm" creates new Forensics investigation with alarm context pre-loaded
- Right-click a point → "Investigate Point" creates new Forensics investigation anchored to that point
- Both are standard items in the shared Point Context Menu (doc 32)
- User story: "As an engineer, I want to right-click an alarm and start an investigation, so I can immediately begin root cause analysis with relevant context pre-loaded."

---

## SPEC FILE 7: 20_MOBILE_ARCHITECTURE.md

### Gesture Mapping

- Long-press (500ms) → equivalent to right-click → opens Point Context Menu
- Same shared menu as desktop: Point Detail, Trend Point, Investigate Point, Report on Point
- Platform-agnostic: mobile and desktop trigger the same shared component

---

## SPEC FILE 8: 23_EXPRESSION_BUILDER.md

### Tile Context Menu (right-click on tile)

**Copy:**
- Ctrl+C or right-click > "Copy": Copies selected tile(s) to clipboard
- Right-click an unselected tile > "Copy": Copies just that tile

**Cut:**
- Ctrl+X or right-click > "Cut": Copy + Delete (with confirmation for delete portion)

**Paste:**
- Ctrl+V or right-click empty workspace > "Paste": Pastes at cursor position
- If cursor is inside a container tile: pastes inside that container
- Right-click inside a container > "Paste": Pastes inside that container

**Delete:**
- Delete key: Deletes all selected tiles (with confirmation prompt)
- Right-click selected tile(s) > "Delete Tile(s)": Deletes all selected (with confirmation)
- Right-click an unselected tile > "Delete": Deletes just that tile (with confirmation)
- All delete operations prompt: "Delete [N] tile(s)? This cannot be undone." — "Delete" and "Cancel" buttons

---

## SPEC FILE 9: 35_SHAPE_LIBRARY.md

### Shape Variant Selection

- Right-click any placed shape in Designer → "Switch Variant" to override global default for that specific instance
- Stored in shape instance metadata
- Designer palette groups variants under a single equipment entry; user picks variant via toggle or right-click menu

---

## SPEC FILE 10: context-menu-implementation-spec.md + context-menu-addendum.md

*(Highest authority for context menu implementation — overrides design-docs)*

These specs define:
- The unified ContextMenu component architecture
- Portal-based rendering (above all other content)
- Z-index management
- Keyboard navigation (ArrowUp/Down, Enter, Escape, Home, End)
- Dismissal behavior (click outside, Escape, scroll)
- Animation: fade-in + scale
- Item types: normal action, separator, submenu, disabled item
- Permission gating: hide unauthorized items (not disable)
- Mobile: long-press trigger at 500ms threshold
- Browser default context menu: ALWAYS prevented (e.preventDefault() on all contextmenu events)

---

## SUMMARY TABLE — All Specified Right-Click Behaviors by Module

| Module | Target Element | Context Menu Items | Permission Required |
|--------|---------------|-------------------|---------------------|
| **ALL (Point Context)** | Any point-bound element | Point Detail, Trend Point, Investigate Point, Report on Point | console:read / forensics:write / reports:read |
| **ALL (Alarm Context)** | Any alarm element | + Investigate Alarm | forensics:write |
| **Console** | Workspace tab | Publish, Unpublish | console:workspace_publish |
| **Console/Process** | Graphic pane | Export Graphic | designer:export |
| **Designer** | Canvas object | Cut, Copy, Paste, Delete, Z-order, Group/Ungroup, Rotate, Flip, Properties, Save as Stencil, Promote to Shape | designer:write |
| **Designer** | Empty canvas | Paste, Select All, Zoom to Fit, Grid Settings, Toggle Grid, Validate Bindings | designer:write |
| **Designer** | Layer in panel | Toggle visibility/lock, Rename, Add/Delete/Duplicate | designer:write |
| **Designer** | Stencil tile | Promote to Shape, Export SVG, Replace SVG | designer:write |
| **Designer** | Placed shape | Switch Variant | designer:write |
| **Designer** | Pipe | Service type assignment | designer:write |
| **Expression Builder** | Tile | Copy, Cut, Paste, Delete (with confirmation) | expression:write |
| **Mobile (ALL)** | Any point element | Same as desktop Point Context Menu | same as desktop |

---

## CRITICAL IMPLEMENTATION REQUIREMENT

**The browser's native context menu MUST NEVER appear anywhere in the I/O application.**

This means:
1. A global `contextmenu` event listener on `document` or `window` with `preventDefault()` must be in place
2. OR every interactive element must call `event.preventDefault()` on contextmenu
3. Elements with no defined right-click behavior silently consume the event (no menu, no browser default)
4. This applies to ALL pages, ALL modules, ALL interactive elements

---

## IMPLICIT RIGHT-CLICK OPPORTUNITIES (not explicitly specced but expected by UX)

These are areas where right-click context menus are NOT explicitly defined in specs but are expected by professional industrial software UX:

1. **Data tables everywhere** — Table rows in Settings, Reports, Rounds, Log, Shifts, Alerts all need row context menus
2. **Navigation sidebar items** — Module nav, workspace lists, view lists
3. **Chart data points** — Beyond point-bound elements; chart series, axes
4. **Report/Schedule list items** — Reports module lists
5. **Log entries** — Log module entry rows
6. **Rounds checklists** — Item manipulation
7. **Investigation panels** — Forensics investigation items
8. **Alert/notification items** — Alert lists

These will need design decisions before implementation.
