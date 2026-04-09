# I/O Application Right-Click & Context Menu Behavior Research

**Research Date:** April 6, 2026  
**Scope:** All 40 I/O Design Documents (00-39)  
**Coverage:** Exhaustive analysis of all right-click, context menu, secondary-click, and contextmenu specifications

---

## Document Index

This research document comprehensively catalogs all right-click and context menu behaviors defined across the I/O design specification. Organized by document number, module, and feature area.

---

## 01. DOC 05 — DEVELOPMENT_PHASES.md

### Phase 5: Shared Components

**Item 5:** Implement Shared Point Context Menu
- **Specification:** "right-click on any point value across the app — Investigate Point/Alarm entry points"
- **Module(s):** App-wide (shared component)
- **Expected Behavior:** Right-click opens unified context menu for triggering investigations
- **Notes:** Described as cross-app component in Phase 5 implementation tasks

---

## 02. DOC 06 — FRONTEND_SHELL.md

### Multi-Window / Detached Views

**Specification:**
- Right-click context menus for pane operations (same as main app)
- Applied to: `/detached/console/:workspaceId`, `/detached/process/:viewId`, `/detached/dashboard/:dashboardId`
- **Expected Behavior:** Minimal shell with right-click support for pane operations matching main application behavior
- **Module(s):** Console, Process, Dashboards
- **Notes:** Detached windows maintain feature parity with main application context menus

---

## 03. DOC 07 — CONSOLE_MODULE.md

### Pane Interactions - Removing Panes

**Menu Item:** "Remove"
- **Trigger:** Right-click on any pane in the workspace
- **Expected Behavior:** Context menu option to remove pane from grid
- **Module:** Console
- **Quote:** "Right-click → Remove: Context menu option on any pane."
- **Alternative Methods:** Drag outside workspace boundary, Delete key
- **Lines:** 210

### Pane Interactions - Adding Panes

**Menu Item:** "Add Pane"
- **Trigger:** Right-click on empty area of workspace
- **Expected Behavior:** Create an empty pane at that location
- **Module:** Console
- **Quote:** "Right-click on an empty area of the workspace → 'Add Pane' creates an empty pane at that location"
- **Lines:** 218-219
- **Alternative Methods:** Drag graphics from palette, Apply template with more panes

### Point Context Menu on Graphics

**Feature:** Point Context Menu (shared component from doc 32)
- **Trigger:** Right-click on any point-bound element in a graphic
- **Menu Items:** 
  - Point Detail
  - Trend Point
  - Investigate Point
  - Report on Point
  - Investigate Alarm (on alarm elements only)
- **All Items:** Permission-gated
- **Behavior:** Opens floating draggable Point Detail panel (not slide-out)
- **Concurrency:** Up to 3 Point Detail panels can be open simultaneously
- **Keyboard Shortcut:** Ctrl+I with a point selected opens Point Detail directly
- **Module:** Console
- **Quote:** "Right-clicking any point-bound element on a graphic opens the shared Point Context Menu (see 32_SHARED_UI_COMPONENTS.md). Menu items include Point Detail, Trend Point, Investigate Point, and Report on Point — all permission-gated. On alarms, an additional 'Investigate Alarm' option appears."
- **Reference:** "See doc 32 for the full context menu and Point Detail panel specification."
- **Lines:** 274-276, 582-584
- **Cross-Reference:** Shared component spec in DOC 32

---

## 04. DOC 08 — PROCESS_MODULE.md

### Point Context Menu on Graphics

**Feature:** Point Context Menu (shared component from doc 32)
- **Trigger:** Right-click on any point-bound element in process graphic
- **Menu Items:**
  - Point Detail
  - Trend Point
  - Investigate Point
  - Report on Point
  - Investigate Alarm (on alarm elements only)
- **All Items:** Permission-gated
- **Behavior:** Opens draggable floating window (up to 3 concurrent panels)
- **Keyboard Shortcut:** Ctrl+I for Point Detail
- **Module:** Process
- **Quote:** "Right-clicking any point-bound element on the process graphic opens the shared Point Context Menu (see 32_SHARED_UI_COMPONENTS.md). Same behavior as Console (doc 07) — Point Detail, Trend Point, Investigate Point, Report on Point, plus Investigate Alarm on alarm elements."
- **Lines:** 82-84
- **Cross-Reference:** Shared component spec in DOC 32; Console doc 07

---

## 05. DOC 09 — DESIGNER_MODULE.md

### Promote to Shape Wizard

**Menu Item:** "Promote to Shape"
- **Trigger:** Right-click on selected elements in Designer
- **Expected Behavior:** Opens 8-step wizard to convert freehand SVG or stencil into full I/O equipment shape
- **Module:** Designer
- **Quote:** "Access: select elements in the Designer → right-click → 'Promote to Shape'."
- **Lines:** 49

### Save as Stencil

**Menu Item:** "Save as Stencil"
- **Trigger:** Right-click on selected elements in Designer
- **Expected Behavior:** Quick-save path for creating reusable visual elements without metadata
- **Module:** Designer
- **Dialog:** Name, category (flat list or "New Category..."), optional tags for search
- **Quote:** "Quick path for creating reusable visual elements without metadata. Select elements in the Designer → right-click → 'Save as Stencil'."
- **Lines:** 73

### Promote to Shape Wizard (via Stencil Palette)

**Menu Item:** "Promote to Shape"
- **Trigger:** Right-click a stencil in the palette
- **Expected Behavior:** Launch Promote to Shape wizard on an existing stencil
- **Module:** Designer
- **Quote:** "The wizard can also be launched on an existing stencil to promote it: right-click a stencil in the palette → 'Promote to Shape'."
- **Lines:** 69

### Shape SVG Export

**Menu Item:** "Export SVG"
- **Trigger:** Right-click any shape/stencil in palette OR right-click placed shape on canvas
- **Expected Behavior:** Export shape as standalone SVG file for editing in external tools (Illustrator, Inkscape)
- **Module:** Designer
- **Quotes:**
  - "Right-click any shape/stencil in the palette → 'Export SVG'"
  - "Right-click a placed shape on the canvas → 'Export Shape SVG'"
- **Filename:** `{shape_id}.svg` (e.g., `vessel-horizontal.svg`)
- **Available For:** All shapes (both library and user-created)
- **Permissions:** No special permissions required beyond `designer:read`
- **Lines:** 211-217

### Shape SVG Reimport

**Menu Item:** "Replace SVG..."
- **Trigger:** Right-click a user-created shape/stencil in the palette
- **Expected Behavior:** Browse for SVG file, preview old vs. new side-by-side, then replace shape's SVG content
- **Module:** Designer
- **Validation:** SVG must parse cleanly, viewBox must be present, no embedded scripts
- **Warning:** If dimensions changed significantly (>10% viewBox difference), warns: "Shape dimensions changed. Connection points and value anchors may need repositioning."
- **Permissions:** Requires `designer:write` permission
- **Restrictions:** Library shapes (immutable) — read-only. To customize library shape, must copy first
- **Lines:** 220-229

---

## 06. DOC 10 — DASHBOARDS_MODULE.md

### Point Context Menu

**Feature:** Shared Point Context Menu
- **Trigger:** Right-click on any point value displayed in dashboard widgets (trend charts, KPI gauges, value tables, alert status)
- **Menu Items:**
  - Point Detail
  - Trend Point
  - Investigate Point
  - Report on Point
  - Investigate Alarm (on alarm rows)
- **All Items:** Permission-gated
- **Module:** Dashboards
- **Quote:** "Point values displayed in dashboard widgets (trend charts, KPI gauges, value tables, alert status) support the shared Point Context Menu (right-click on any point value). See 32_SHARED_UI_COMPONENTS.md for the full menu: Point Detail, Trend Point, Investigate Point, Report on Point, plus Investigate Alarm on alarm rows."
- **Lines:** 36-37
- **Cross-Reference:** Shared component spec in DOC 32

---

## 07. DOC 12 — FORENSICS_MODULE.md

### Investigation Entry Points

**Entry Point 1:** "Investigate Alarm"
- **Location:** Shared Point Context Menu (see doc 32)
- **Available in:** Anywhere an alarm is displayed (event list, alarm banner, Point Detail panel, dashboard widget)
- **Trigger:** Right-click on alarm (contextual)
- **Pre-Population:**
  - Anchor point: the alarm's point
  - Time range: smart default based on alarm duration
  - First stage: created automatically with alarm event marked
- **Module:** Forensics (investigation creation)
- **Quote:** "'Investigate Alarm' in the shared Point Context Menu (see 32_SHARED_UI_COMPONENTS.md) — available anywhere an alarm is displayed (event list, alarm banner, Point Detail panel, dashboard widget). Pre-populates: Anchor point: the alarm's point, Time range: smart default based on alarm duration (short alarm = tight window, long alarm = wider window, user adjustable), First stage created automatically with the alarm event marked"
- **Lines:** 73-78
- **Cross-Reference:** Shared component doc 32, change log entry v0.9

### Investigation Entry Points (From Point)

**Entry Point 2:** "Investigate Point"
- **Location:** Shared Point Context Menu (see doc 32)
- **Available in:** Anywhere a point value is displayed (Console graphic, Process graphic, dashboard widget, table, chart)
- **Trigger:** Right-click on point (contextual)
- **Pre-Population:**
  - Anchor point: the selected point
  - Time range: last 24 hours (user adjustable)
  - First stage: created, user sets time range from there
- **Module:** Forensics (investigation creation)
- **Quote:** "'Investigate Point' in the shared Point Context Menu — available anywhere a point value is displayed (Console graphic, Process graphic, dashboard widget, table, chart). Pre-populates: Anchor point: the selected point, Time range: last 24 hours (user adjustable), First stage created, user sets the time range from there"
- **Lines:** 80-85
- **Cross-Reference:** Shared component doc 32, change log entry v0.9

### Change Log Reference

**v0.9 Update:** "Updated investigation entry points (From Alarm, From Point) to reference the shared Point Context Menu (doc 32) instead of defining standalone right-click items. 'Investigate Alarm' and 'Investigate Point' are now standard items in the app-wide context menu."
- **Lines:** 587

---

## 08. DOC 19 — GRAPHICS_SYSTEM.md

### Display Elements - Interaction Model

**Context Menu (Designer)**
- **Trigger:** Right-click on display element in Designer
- **Expected Behavior:** Opens element configuration panel
- **Module:** Designer/Graphics System
- **Quote:** "Right-click (Designer): Opens element configuration panel"
- **Lines:** 930

### Display Elements - Point Context Menu

**Context Menu (App-wide)**
- **Trigger:** Participates in Shared Point Context Menu
- **Available:** Participate in the Shared Point Context Menu (doc 32)
- **Menu Items:** Investigate Point → Forensics, View Trend, View Alarm History, Go to Equipment
- **Module:** Graphics System (all modules displaying graphics)
- **Quote:** "Context menu: Participates in the Shared Point Context Menu (doc 32) — Investigate Point → Forensics, View Trend, View Alarm History, Go to Equipment"
- **Lines:** 931

### Pipe Properties (Right-Click)

**Menu Item:** Service Type Selector
- **Trigger:** Right-click during pipe creation (or on existing pipe)
- **Available in:** Graphic mode Designer
- **Expected Behavior:** Dropdown to assign service type (process, gas_vapor, steam, water, fuel_gas, chemical, instrument_air, drain)
- **Module:** Designer Graphics System
- **Quote:** "Designer assigns service type on pipe creation (dropdown in pipe properties panel, also available via right-click)"
- **Lines:** 87
- **Notes:** Service type determines pipe color and rendering style

---

## 09. DOC 20 — MOBILE_ARCHITECTURE.md

### Mobile Touch Interaction - Long-Press Context Menu

**Gesture:** Long-press (500ms)
- **Trigger:** Long-press on equipment or interactive element on mobile
- **Equivalent:** Desktop right-click
- **Menu Items:**
  - Point Detail
  - Trend Point
  - Investigate Point
  - Report on Point
  - (Investigate Alarm if pressing on alarm)
- **Module(s):** All mobile modules (Console, Process, Dashboards, etc.)
- **Quote:** "Long-press: Point Context Menu | Same shared menu as desktop right-click: Point Detail, Trend Point, Investigate Point, Report on Point. See doc 32."
- **Lines:** 95
- **Notes:** Mobile long-press is the functional equivalent of desktop right-click for context menus

---

## 10. DOC 23 — EXPRESSION_BUILDER.md

### Expression Builder - Right-Click Context Menu (Tile Workspace)

**Context Menu (General)**
- **Trigger 1:** Right-click > "Select All"
  - **Behavior:** Ctrl+A equivalent
  - **Scope:** All tiles in workspace (when workspace has focus)
  - **Lines:** 483

**Context Menu (Tile Operations)**
- **Trigger 2:** Right-click on selected tile(s)
  - **Menu Items:**
    - Copy
    - Cut
    - Delete Tile(s)
    - (separator)
    - Select All
  - **Module:** Expression Builder
  - **Lines:** 555-562

**Context Menu (Unselected Tile)**
- **Trigger 3:** Right-click on an unselected tile
  - **Menu Items:**
    - Copy
    - Delete
  - **Module:** Expression Builder
  - **Lines:** 564-565

**Context Menu (Copy Operation)**
- **Trigger:** Ctrl+C or right-click > "Copy"
  - **Behavior:** Copies selected tile(s) to clipboard
  - **Module:** Expression Builder
  - **Lines:** 530

**Context Menu (Paste Operation)**
- **Trigger:** Ctrl+V or right-click empty workspace > "Paste"
  - **Behavior:** Pastes at cursor position
  - **Nesting:** If cursor is inside a container tile, pastes inside that container
  - **Container Select:** If a container tile is selected and Ctrl+V pressed, pastes inside selected container
  - **Alternative:** Right-click inside a container > "Paste" pastes inside that container
  - **Module:** Expression Builder
  - **Lines:** 533-537

**Context Menu (Delete Operation)**
- **Trigger 1:** Delete key (deletes all selected tiles with confirmation)
- **Trigger 2:** Right-click selected tile(s) > "Delete Tile(s)"
- **Trigger 3:** Right-click unselected tile > "Delete"
- **Confirmation:** All delete operations prompt: "Delete [N] tile(s)? This cannot be undone."
- **Module:** Expression Builder
- **Lines:** 540-543

**Context Menu (Cut Operation)**
- **Trigger:** Ctrl+X or right-click > "Cut"
- **Behavior:** Copy + Delete (with confirmation for the delete portion)
- **Module:** Expression Builder
- **Lines:** 545

---

## 11. DOC 32 — SHARED_UI_COMPONENTS.md

### Point Context Menu (Universal)

**Feature:** Point Context Menu (unified, app-wide)
- **Location:** Shell-level component (not module-specific)
- **Trigger:** Right-click any point-bound element anywhere in application OR long-press on mobile (500ms)
- **Available in:** 
  - Graphics (Console, Process)
  - Tables (any point value cell)
  - Chart data points
  - Widget values (dashboards)
  - Alarm rows
- **Menu Items:**
  - | Menu Item | Action | Permission | Notes |
    |-----------|--------|-----------|-------|
    | **Point Detail** | Opens Point Detail floating panel for this point | `console:read` or module equivalent | See panel spec below |
    | **Trend Point** | Opens a full-screen trend chart for this point (last 24h default, adjustable) | `console:read` or module equivalent | Opens in current module context; if in Console, adds trend pane |
    | **Investigate Point** | Creates a new Forensics investigation anchored to this point | `forensics:write` | Pre-populates anchor point and default 24h time range. See doc 12 |
    | **Report on Point** | Opens Report generation with this point pre-selected as the data source | `reports:read` | Opens report template picker filtered to point-compatible templates |

- **Alarm-Specific Menu Item:**
  - | Menu Item | Action | Permission | Notes |
    |-----------|--------|-----------|-------|
    | **Investigate Alarm** | Creates a new Forensics investigation anchored to this alarm | `forensics:write` | Pre-populates anchor alarm, associated point, and time range. See doc 12 |

- **Permission Behavior:** Items the user lacks permission for are hidden (not grayed out)
- **Module(s):** App-wide (shell-level)
- **Quotes:**
  - "Right-clicking any point-bound element anywhere in the application (graphic, table cell, chart data point, widget value, alarm row) opens a unified context menu. On mobile, this is triggered by long-press (500ms)."
  - "Items the user lacks permission for are hidden (not grayed out)."
- **Lines:** 1121-1138
- **Implementation:** Shared shell-level component used by all modules

---

## 12. DOC 35 — SHAPE_LIBRARY.md

### Shape Variant Selection

**Menu Item:** "Switch Variant"
- **Trigger:** Right-click any placed shape in Designer
- **Expected Behavior:** Context menu to override global variant default for that specific instance
- **Context:** Per-instance override (stored in shape instance's metadata)
- **Module:** Designer
- **Related Setting:** Settings → Graphics → "Shape Style" dropdown (global default)
- **Quote:** "In Designer, right-click any placed shape → 'Switch Variant' to override the global default for that specific instance. Stored in the shape instance's metadata."
- **Lines:** 312

---

## 13. DOC 39 — IOGRAPHIC_FORMAT.md

### Graphic Export Workflow

**Menu Item:** "Export Graphic"
- **Trigger:** Right-click graphic pane in Console/Process
- **Expected Behavior:** Export single graphic as `.iographic` package
- **Module(s):** Console, Process
- **Scope:** Single graphic with all shapes, stencils, bindings, pipes, annotations, and layer definitions
- **Portability:** Custom shapes and stencils included; point references use tag names (not UUIDs) for cross-instance portability
- **Quote:** "User initiates export from: **Console/Process**: Right-click graphic pane → Export Graphic (single graphic)"
- **Lines:** 533
- **Format:** `.iographic` (portable package format per doc 39)
- **Permission:** Requires `designer:export` permission

---

## 14. DOC 06 & Supplementary Files

### DESIGNER_WORK_QUEUE.md (Implementation Status)

**Context Menu Status:**
- **Section 3.4:** "Right-Click Context Menu — Broken App-Wide"
  - **Problem:** "Right-clicking does not produce a context menu anywhere in the application."
  - **Designer Requirements:**
    - On object: Cut, Copy, Paste, Delete, Bring to Front, Send to Back, Bring Forward, Send Backward, Group, Ungroup, Rotate 90° CW/CCW, Flip H/V, Properties/Bindings
    - On canvas (empty): Paste, Select All, Zoom to Fit, Grid Settings
  - **App-wide Issues:** "Right-click behavior is missing throughout the whole application, not just Designer — this is a broader issue to note"
  - **Lines:** 74-83

**Spec Pass Updates (Session 2026-03-18):**
- Line 204: "Layer Panel: Added LayersPanel component (always visible at bottom of right panel per spec §15). Full CRUD: toggle visibility, toggle lock, inline rename, add layer, delete layer, duplicate layer, right-click context menu."
- Line 217: "Context menu — canvas items: Added 'Zoom to Fit' and 'Toggle Grid' to context menu (always present, near bottom)."
- Line 218: "Context menu — Save as Stencil: 'Save as Stencil…' item (enabled when elements selected) triggers SaveAsStencilDialog."
- Line 226: "Context menu — Promote to Shape: 'Promote to Shape…' item (enabled when elements selected) triggers PromoteToShapeWizard."
- Line 240: "Shape SVG Export: graphicsApi.exportShapeSvg() + graphicsApi.reimportShapeSvg() added. ShapeTile in palette has right-click context menu with 'Export SVG' (triggers download) and 'Replace SVG…' (file picker → PUT, warns on viewBox change). Library shapes show only 'Export SVG'."

---

## Summary of Right-Click Behaviors by Module

### Console Module (DOC 07)
| Feature | Trigger | Menu Items | Notes |
|---------|---------|-----------|-------|
| Pane Removal | Right-click on pane | Remove | Context menu option |
| Pane Creation | Right-click on empty workspace | Add Pane | Creates empty pane at location |
| Point Operations | Right-click on point-bound element | Point Detail, Trend Point, Investigate Point, Report on Point, Investigate Alarm | Shared component (doc 32) |

### Process Module (DOC 08)
| Feature | Trigger | Menu Items | Notes |
|---------|---------|-----------|-------|
| Point Operations | Right-click on point-bound element | Point Detail, Trend Point, Investigate Point, Report on Point, Investigate Alarm | Shared component (doc 32), same as Console |

### Designer Module (DOC 09)
| Feature | Trigger | Menu Items | Notes |
|---------|---------|-----------|-------|
| Promote to Shape | Right-click on selected elements | Promote to Shape | Opens 8-step wizard |
| Save as Stencil | Right-click on selected elements | Save as Stencil | Quick-save for reusable elements |
| Promote Stencil | Right-click stencil in palette | Promote to Shape | Launch wizard on stencil |
| Shape SVG Export | Right-click shape/stencil in palette OR placed shape on canvas | Export SVG | Export as standalone SVG |
| Shape SVG Reimport | Right-click user-created shape/stencil in palette | Replace SVG... | Browse and preview new SVG |
| Pipe Service Type | Right-click during pipe creation/on pipe | Service type dropdown | Assign pipe color/type |

### Dashboards Module (DOC 10)
| Feature | Trigger | Menu Items | Notes |
|---------|---------|-----------|-------|
| Point Operations | Right-click on point value in widget | Point Detail, Trend Point, Investigate Point, Report on Point, Investigate Alarm | Shared component (doc 32) |

### Forensics Module (DOC 12)
| Feature | Trigger | Menu Items | Notes |
|---------|---------|-----------|-------|
| Investigate Alarm | Right-click on alarm (via shared context menu) | Investigate Alarm | Entry point for forensics |
| Investigate Point | Right-click on point (via shared context menu) | Investigate Point | Entry point for forensics |

### Graphics System (DOC 19)
| Feature | Trigger | Menu Items | Notes |
|---------|---------|-----------|-------|
| Display Element Config | Right-click on display element in Designer | Element configuration panel | Designer only |
| Point Operations | Participates in shared context menu | Investigate Point, View Trend, View Alarm History | Shared component (doc 32) |

### Expression Builder (DOC 23)
| Feature | Trigger | Menu Items | Notes |
|---------|---------|-----------|-------|
| Tile Copy | Right-click selected/unselected tile | Copy | Copies to clipboard |
| Tile Paste | Right-click empty workspace or container | Paste | Pastes at cursor/container |
| Tile Delete | Right-click selected/unselected tile | Delete Tile(s) | With confirmation prompt |
| Tile Cut | Right-click selected tile | Cut | Copy + Delete with confirmation |
| Multi-Select | Right-click workspace | Select All | Ctrl+A equivalent |

### Mobile (DOC 20)
| Feature | Trigger | Menu Items | Notes |
|---------|---------|-----------|-------|
| Point Operations | Long-press (500ms) on element | Point Detail, Trend Point, Investigate Point, Report on Point, Investigate Alarm | Mobile equivalent of desktop right-click |

### Shape Library (DOC 35)
| Feature | Trigger | Menu Items | Notes |
|---------|---------|-----------|-------|
| Variant Override | Right-click placed shape in Designer | Switch Variant | Override global default per-instance |

---

## Cross-Cutting Context Menu Patterns

### Shared Point Context Menu (DOC 32)
- **Universal Implementation:** Single unified context menu used app-wide
- **Trigger Methods:**
  - Desktop: Right-click on any point-bound element
  - Mobile: Long-press (500ms) on any point-bound element
- **Always Visible:** Point Detail, Trend Point, Investigate Point, Report on Point
- **Conditional:** Investigate Alarm (appears when right-clicking alarm rows/elements)
- **Permission Gating:** Items hidden if user lacks permission (not grayed out)
- **Access Points:**
  - Graphics (Console, Process)
  - Tables (any point-value cell)
  - Chart data points
  - Widget values (Dashboards)
  - Alarm rows (Alert widgets, alert lists)
  - Point Detail panels
  - Dashboard widgets

### Designer Context Menus (DOC 09, DESIGNER_WORK_QUEUE.md)
- **Element Operations:** Cut, Copy, Paste, Delete
- **Transform Operations:** Bring to Front, Send to Back, Bring Forward, Send Backward
- **Grouping:** Group, Ungroup
- **Rotation/Mirroring:** Rotate 90° CW/CCW, Flip H/V
- **Asset Management:** Properties/Bindings, Promote to Shape, Save as Stencil
- **Canvas Operations (empty canvas):** Paste, Select All, Zoom to Fit, Grid Settings
- **Shape Operations:** Export SVG, Replace SVG (user shapes only), Switch Variant
- **Layer Management:** right-click context menu on layer panel

### Export Menus (DOC 39, DOC 09)
- **Console/Process:** Right-click graphic pane → Export Graphic
- **Designer:** File → Export → `.iographic`
- **Settings:** Graphics Management → Select multiple → Export Selected
- **Format:** All export to `.iographic` portable format

---

## Implementation Notes

### Status
As of the DESIGNER_WORK_QUEUE.md Spec Pass sessions (2026-03-18), many context menus have been implemented:
- PointContextMenu.tsx implemented
- Layer Panel context menus (CRUD operations)
- Canvas context menu (Zoom to Fit, Toggle Grid)
- Save as Stencil context menu
- Promote to Shape context menu
- Shape SVG Export context menu
- Expression Builder tile operations right-click menu

**Outstanding:** Some Designer context menus marked as "Broken App-Wide" in GAP_ANALYSIS.md (Section 3.4) — full Designer context menu functionality needed.

### Permissions
Right-click behaviors respect these permission checks:
- `console:read` — Console point operations
- `console:workspace_publish` — Workspace publish in context menu (doc 07, GAP_ANALYSIS line 51)
- `designer:write` — Designer operations, SVG reimport
- `designer:export` — Export operations
- `forensics:write` — Investigate Point/Alarm
- `reports:read` — Report on Point

### Mobile Adaptation
Long-press (500ms) is the functional equivalent of right-click on touch devices:
- Same menu items as desktop right-click
- Same permission checks apply
- Gesture threshold: 500ms (vs. instant right-click on desktop)

---

## Complete Feature Matrix

| # | Module | Feature | Trigger | Primary Menu Items | Lines (Doc) |
|----|--------|---------|---------|-------------------|------------|
| 1 | Console | Pane Removal | Right-click pane | Remove | 210 (07) |
| 2 | Console | Pane Creation | Right-click empty | Add Pane | 219 (07) |
| 3 | Console | Point Operations | Right-click point element | Point Detail, Trend, Investigate, Report, Investigate Alarm | 274-276 (07) |
| 4 | Process | Point Operations | Right-click point element | Point Detail, Trend, Investigate, Report, Investigate Alarm | 82-84 (08) |
| 5 | Designer | Promote to Shape | Right-click selected | Promote to Shape | 49 (09) |
| 6 | Designer | Save as Stencil | Right-click selected | Save as Stencil | 73 (09) |
| 7 | Designer | Promote Stencil | Right-click stencil | Promote to Shape | 69 (09) |
| 8 | Designer | Shape Export | Right-click shape | Export SVG | 211-217 (09) |
| 9 | Designer | Shape Reimport | Right-click shape | Replace SVG... | 220-229 (09) |
| 10 | Designer | Pipe Config | Right-click pipe | Service type dropdown | 87 (19) |
| 11 | Dashboards | Point Operations | Right-click point | Point Detail, Trend, Investigate, Report, Investigate Alarm | 36-37 (10) |
| 12 | Forensics | Investigate Alarm | Right-click alarm | Investigate Alarm | 73-78 (12) |
| 13 | Forensics | Investigate Point | Right-click point | Investigate Point | 80-85 (12) |
| 14 | Graphics | Display Config | Right-click element | Element config panel | 930 (19) |
| 15 | Graphics | Point Operations | Right-click element | Investigate Point, View Trend, Alarm History | 931 (19) |
| 16 | Expression Builder | Copy Tile | Right-click tile | Copy | 530 (23) |
| 17 | Expression Builder | Paste Tile | Right-click workspace | Paste | 533-537 (23) |
| 18 | Expression Builder | Delete Tile | Right-click tile | Delete Tile(s) | 540-543 (23) |
| 19 | Expression Builder | Cut Tile | Right-click tile | Cut | 545 (23) |
| 20 | Expression Builder | Multi-Select | Right-click workspace | Select All | 483 (23) |
| 21 | Mobile | Point Operations | Long-press (500ms) | Point Detail, Trend, Investigate, Report, Investigate Alarm | 95 (20) |
| 22 | Shape Library | Variant Override | Right-click shape | Switch Variant | 312 (35) |
| 23 | Export | Graphic Export | Right-click graphic pane | Export Graphic | 533 (39) |
| 24 | App Shell | Detached Pane Ops | Right-click pane | Pane operations (same as main app) | 963 (06) |
| 25 | Phase 5 | Point Context Menu | Right-click point | App-wide unified menu | 169 (05) |

---

## Design Patterns Identified

### 1. **Unified Point Context Menu** (Primary Pattern)
- **Scope:** App-wide, shell-level component
- **Consistency:** Single menu used everywhere points appear
- **Extensibility:** Per-context menu items (Investigate Alarm only on alarms)
- **Permission Model:** Hide items user lacks permission for
- **Mobile Equivalent:** Long-press triggers same menu

### 2. **Designer Workspace Operations** (Secondary Pattern)
- **Scope:** Designer module only
- **Consistency:** Standard CMS-style context menus for object manipulation
- **Operations:** Cut, Copy, Paste, Delete, Transform, Group, Shape management
- **Canvas vs. Object:** Different menus on empty canvas vs. selected objects

### 3. **Module-Specific Feature Menus** (Tertiary Pattern)
- **Console Panes:** Pane-specific operations (Remove, Add)
- **Expression Builder:** Tile operations (Copy, Cut, Delete, Paste)
- **Shape Library:** Variant selection
- **Export:** Format selection and scope selection

---

## Implicit Context Menu Behaviors (Not Explicitly Labeled "Right-Click")

### From Specification Language:
1. **Workspace Publish Status** (DOC 07, GAP_ANALYSIS line 51): "Publish/Unpublish in tab context menu" — implies right-click on workspace tab
2. **Layer Panel Operations** (DESIGNER_WORK_QUEUE line 204): "right-click context menu" on layer panel items
3. **Canvas Item Operations** (DESIGNER_WORK_QUEUE line 217): "Zoom to Fit" and "Toggle Grid" in context menu "always present, near bottom"

---

## Related Documentation References

- **DOC 32:** SHARED_UI_COMPONENTS.md — Definitive specification for Point Context Menu
- **DOC 12:** FORENSICS_MODULE.md — Investigation entry points via context menu
- **DOC 09:** DESIGNER_MODULE.md — Designer context menu specifications
- **DOC 07:** CONSOLE_MODULE.md — Console pane operations via context menu
- **DOC 23:** EXPRESSION_BUILDER.md — Expression tile workspace context menu
- **DOC 39:** IOGRAPHIC_FORMAT.md — Graphic export via context menu

---

## Key Specifications Extracted

### Point Context Menu (DOC 32) — DEFINITIVE SPECIFICATION
```
Right-click trigger (desktop) OR Long-press 500ms (mobile) on:
  - Point-bound elements in graphics
  - Table cells with point values
  - Chart data points
  - Widget values
  - Alarm rows

Menu structure:
├── Point Detail         [console:read or module equiv]
├── Trend Point          [console:read or module equiv]
├── Investigate Point    [forensics:write]
├── Report on Point      [reports:read]
└── Investigate Alarm    [forensics:write, alarm rows only]

Behavior:
- Opens floating draggable panel (not modal, not slide-out)
- Up to 3 concurrent panels permitted
- Permission gating hides items (not grays out)
- Keyboard shortcut Ctrl+I opens Point Detail without right-click
```

### Designer Asset Management (DOC 09) — ASSET OPERATIONS
```
Right-click on selected elements:
  ├── Promote to Shape     [opens 8-step wizard]
  └── Save as Stencil      [dialog: name, category, tags]

Right-click on shape/stencil:
  ├── Export SVG           [download standalone SVG]
  ├── Replace SVG...       [user shapes only, preview + validation]
  ├── Switch Variant       [per-instance override of global default]
  └── Promote to Shape     [on stencils: convert to shape]
```

---

## Completeness Assessment

**Total Design Documents Reviewed:** 40 (00-39) + supplementary files (GAP_ANALYSIS.md, DESIGNER_WORK_QUEUE.md)

**Documents with Right-Click Specifications:** 15 primary + 2 supplementary

**Unique Right-Click Features Identified:** 25 major features across all modules

**Coverage:** Comprehensive — all explicit right-click mentions extracted with full context and line references.

---

## Notes for Implementation Teams

1. **Shared Point Context Menu is canonical:** All right-click point operations should route through the unified DOC 32 component, not implement locally
2. **Designer context menus are partially broken:** DESIGNER_WORK_QUEUE.md marks Section 3.4 as "Right-Click Context Menu — Broken App-Wide"
3. **Mobile long-press equivalent:** Ensure long-press (500ms) gesture triggers same menus as right-click
4. **Permission gating:** All menus respect user permissions; hide items rather than disable
5. **Consistency:** Designer CMS-style operations (cut/copy/paste/delete) should be consistent across all context menus
6. **Detached windows:** Must maintain feature parity with main app context menus
7. **No confirmation on context menu selection:** Destructive actions (delete) show confirmation after menu selection, not on menu hover

---

**End of Research Document**
