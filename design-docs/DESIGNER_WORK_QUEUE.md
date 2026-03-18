# Designer Module — Work Queue
_Written from user feedback 2026-03-16_

## 1. Pre-Work: Spec vs Implementation Gap Analysis

Read **09_DESIGNER_MODULE.md** in full — do not skip anything.

Compare spec to what is actually implemented in:
- `frontend/src/pages/designer/`
- All sub-components, panels, hooks, utilities

Produce a gap list: every feature in the spec that is not implemented or is only partially implemented.

---

## 2. What Is Working Well (Do Not Break)

- Color scheme looks great
- Grid and snapping feels great
- Drawing shapes feels great

---

## 3. Known Issues to Fix

### 3.1 Toolbox / Toolbar UX

**Problem:** Tools are labeled with letters only (S for Select, E for Ellipse, etc.) — confusing.

**Fix approach:** Research common design/CAD/HMI apps for icon conventions:
- Photoshop, Blender, GIMP, Visio
- AutoCAD, Bluebeam
- HMI builder software (Wonderware, iFIX, Ignition Designer)

**Expected icon conventions:**
- Select: Arrow/mouse cursor icon (or crosshair). Click+drag → rubber-band selection box.
- Shapes: Small icon of the actual shape — circle icon for ellipse, rectangle icon for rect, triangle, polygon
- Line: diagonal line icon
- Arc: curved arc icon
- Pen/pencil/brush: pencil icon for freehand draw
- Text: "T" icon is acceptable and standard

**Additional toolbox items needed:**
- Free-form/freehand draw tool (pencil/brush)
- Image import tool (for raster images: logos, backgrounds, shape references)

---

### 3.2 Selection & Transform — Broken

**Problems:**
- Resize handles appear on selected shapes but **cannot be dragged** — clicking them does nothing
- **No multi-select**: Ctrl+click does not add to selection, Shift+click does not add to selection
- **No rubber-band / marquee select**: Click+drag on empty canvas should draw a selection rectangle and select all objects within it
- **No rotation**: Objects cannot be rotated. Need:
  - Free rotation handle (circle handle above selected object, drag to rotate)
  - Right-click → Rotate 90° CW, Rotate 90° CCW, Rotate 180°, Flip Horizontal, Flip Vertical

---

### 3.3 Zoom — Broken

**Problems:**
- Mouse wheel does not zoom the canvas (browser may be intercepting Ctrl+wheel)
- The + and − zoom buttons do nothing

**Fix:**
- Mouse wheel (or Ctrl+wheel) should zoom the designer canvas
- + / − buttons should work
- Also add keyboard shortcuts: Ctrl++ / Ctrl+- / Ctrl+0 (fit to screen)

---

### 3.4 Right-Click Context Menu — Broken App-Wide

**Problem:** Right-clicking does not produce a context menu anywhere in the application.

**Designer right-click should provide:**
- On object: Cut, Copy, Paste, Delete, Bring to Front, Send to Back, Bring Forward, Send Backward, Group, Ungroup, Rotate 90° CW/CCW, Flip H/V, Properties/Bindings
- On canvas (empty): Paste, Select All, Zoom to Fit, Grid Settings

**App-wide right-click issues:**
- Right-click behavior is missing throughout the whole application, not just Designer — this is a broader issue to note

---

### 3.5 Dashboard / Report / Graphic Palette — Wrong Layout

**Problem:** The palettes for selecting graphics, dashboards, reports are huge and not set up for drag-and-drop.

**Expected behavior (per spec and industry standard):**
- Left panel should have a compact component library / asset palette
- Items should show as small tiles with thumbnails, not full-screen large panels
- Items should be draggable from the palette onto the canvas
- Dragging a graphic/widget onto the canvas should create an instance of it

---

### 3.6 Report Objects — Non-Functional

**Problem:** Report object/widget items in the designer don't do anything when placed.

**Fix:** Report objects (data tables, charts, text blocks, etc.) should be fully functional or at minimum show a placeholder indicating what they will render.

---

### 3.7 Resizing Modular Drag-and-Drop Elements

**Problem:** Modular elements placed on the dashboard/report canvas cannot be resized.

**Fix:** All placed elements need resize handles that actually work (tied to the same resize fix in 3.2).

---

### 3.8 iographic Import — **PARTIALLY FIXED** (2026-03-18)

**Problem:** When importing `.iographic` (IO native format) files:
- Graphics come in but are not editable — cannot click on any element

**Root cause found:** `getNodeBounds()` in `DesignerCanvas.tsx` had no case for `embedded_svg` nodes — they fell through to the default 64×64 bounding box, making them virtually impossible to select.

**Fix applied:** Added `embedded_svg` case to `getNodeBounds()` using `esn.width / esn.height`. Also added `embedded_svg` to the resize commit logic in `handleMouseUp` so these nodes can be resized.

**Remaining:** Full decomposition of `embedded_svg` blobs into individual primitives (select SVG element → decompose to designer objects) is a larger feature dependent on a client-side SVG parser. For now, imported SVG blobs can be selected, moved, rotated, and resized as a single unit.

---

### 3.9 Navigation — Cannot Be Hidden

**Problem (app-wide):** There is no way to hide the navigation sidebar to maximize workspace.

**Fix:**
- Add a collapse button to the sidebar (chevron/arrow to hide it)
- In Designer specifically: option to go "full workspace" mode where only the canvas and a minimal floating toolbar are visible
- Should be able to toggle back easily

---

### 3.10 Thumbnails in Asset Browsers

**Problem:** Console graphics, reports, dashboards shown in browsers/pickers have no visual thumbnails.

**Fix:**
- Generate and display thumbnail images for graphics, dashboards, reports
- If thumbnail generation is not feasible immediately, show a styled placeholder tile that indicates what type of content it is (e.g., small SVG preview or icon + name on a colored card)
- The thumbnail/tile should be large enough to be visually meaningful but compact enough to show many in a list

---

## 4. Research Tasks for Agent

When beginning the designer deep-dive, agents should:

1. Read 09_DESIGNER_MODULE.md completely
2. Read all files in `frontend/src/pages/designer/` completely
3. Research layout/UX patterns from:
   - Figma, Sketch, Adobe Illustrator, Inkscape (vector design)
   - Photoshop, GIMP (raster/general)
   - AutoCAD, Bluebeam (CAD/engineering drawings)
   - Ignition Designer, Wonderware InTouch, GE iFIX (HMI/SCADA builders)
   - Visio (diagramming)
4. Identify missing features from spec gap analysis
5. Propose and implement improvements

---

## 5. Questions for User (Morning)

The following items may need user input before proceeding:

- **Better design layouts not in spec**: If the research produces a significantly different/better layout than what's in 09_DESIGNER_MODULE.md, should that be implemented or stick strictly to spec?
- **Freehand draw**: Should this be a vector bezier pen tool, a raster brush, or a simple polyline? The spec may define this — check 09_DESIGNER_MODULE.md.
- **Image import formats**: SVG (already partially there), PNG, JPEG, WebP? What about PDF for reference?
- **Right-click context menus**: Is this a global thing to implement across all modules or start just in Designer?
- **Thumbnail generation**: Should thumbnails be pre-rendered server-side (raster thumbnails stored in DB) or rendered client-side on demand?

---

## 6. Priority Order

1. ~~Fix resize handles (broken, high impact)~~ — **CONFIRMED WORKING** (analysis pass 2026-03-18)
2. ~~Fix multi-select (broken, high impact)~~ — **CONFIRMED WORKING** (Ctrl+Click, Shift+Click, marquee)
3. ~~Fix zoom controls (broken, high impact)~~ — **CONFIRMED WORKING** (wheel, Ctrl+/-, Ctrl+0)
4. ~~Icon-based toolbar~~ — **CONFIRMED DONE** (SVG icons for all tools in DesignerToolbar.tsx)
5. ~~Rubber-band selection~~ — **CONFIRMED WORKING**
6. ~~Rotation support~~ — **DONE** (2026-03-18): `handleMouseMove` and `handleMouseUp` now have `rotate` case. `rotationPreview` state drives live `SelectionOverlay` rotation visualization during drag. `RotateNodesCommand` committed on mouseUp.
7. ~~Smart alignment snap~~ — **DONE** (2026-03-18): `handleMouseUp` drag case now computes alignment snap corrections and applies them to the final delta before calling `MoveNodesCommand`.
8. ~~Freehand draw tool~~ — **DONE** (2026-03-18): `freehand` tool added to DrawingTool type, DesignerToolbar, DesignerCanvas. Mouse hold + drag captures points via `freehandPointsRef`, RDP path simplification on mouseUp creates `path` primitive. Keyboard shortcut B. `FreehandPreviewOverlay` shows live path during drag.
9. ~~Image import~~ — **CONFIRMED DONE** (image tool in toolbar + `imageInputRef` file picker in canvas)
10. iographic import editing — PARTIALLY DONE (embedded_svg bounding box fixed; full decomposition deferred)
11. ~~Compact asset palette with thumbnails~~ — **DONE** (2026-03-18): SVG thumbnails for shapes via `SvgThumbnail`, spec-accurate `DisplayElementPreview` for display elements.
12. ~~Navigation collapse~~ — **CONFIRMED DONE** (AppShell has 3-state sidebar: expanded/collapsed/hidden)
13. ~~Report objects functioning~~ — **DONE** (2026-03-18): Report Elements section added to report mode palette (Text Block, Section Break, Page Break, Header, Footer with SVG previews). `io:report-element-drop` handler creates TextBlock and Annotation nodes. Canvas renders section_break (accent line), page_break (red dashed + label), header/footer (blue bars). Annotation bounding box uses config.width/height. Text Block rendered with background box.

## 7. Spec Pass 2 — Session 2026-03-18 (continued)

### Completed this session

- **ShapeSidecar type fix**: `baseSize` made optional, `width?/height?` added to geometry. Canvas uses `geo?.baseSize?.[0] ?? geo?.width ?? 64` pattern.
- **DesignerRightPanel — new panels**: Added `ImageNodePanel`, `EmbeddedSvgPanel`, `GroupPanel`, `AnnotationPanel`, `StencilPanel`. All node types now have dedicated panels (no more default fallthrough).
- **DesignerRightPanel — panel enhancements**: MultiSelectionPanel has alignment/distribution buttons; PrimitivePanel has position X/Y/rotation/fill opacity/stroke dash; TextBlockPanel has font family, max width, background section.
- **DesignerRightPanel — text zone overrides**: SymbolInstancePanel now shows editable text zone override fields from the sidecar.
- **DesignerRightPanel — display elements list**: SymbolInstancePanel shows child display elements list.
- **Layer Panel**: Added `LayersPanel` component (always visible at bottom of right panel per spec §15). Full CRUD: toggle visibility, toggle lock, inline rename, add layer, delete layer, duplicate layer, right-click context menu.
- **Keyboard shortcuts**: Added `Ctrl+Shift+0` (zoom to selection), `Ctrl+'` (toggle grid), `Ctrl+Shift+'` (toggle snap), `Enter` (finish pipe/pen path), `Spacebar` hold (temporary pan), `Shift+P` (pipe tool).
- **Tool modes**: Added `rect`/`ellipse`/`line` to dashboard and report modes per spec §11.2-11.3.
- **Connection points overlay**: `ConnectionPointsOverlay` renders teal dots for all SymbolInstance connection points when pipe tool is active (spec §11.1). Snaps pipe waypoints to nearest connection point within 12px screen threshold.
- **Pipe shortcut**: Updated TOOLS array to show `Shift+P` as the pipe shortcut (spec §12).
- **AddLayerCommand / RemoveLayerCommand**: Imported and used in LayersPanel.

## 8. Spec Pass 3 — Session 2026-03-18 (continued)

### Completed this session

- **AnalogBar panel enhancements**: Added Show Setpoint, Show Zone Labels checkboxes; Thresholds section (HH/H/L/LL numeric inputs) — uses `cfg.thresholds?.hh` etc.
- **DigitalStatus state labels table**: Full editable key-value table per spec §5.3. Each row: [Value] input → [Label] input → [Normal State checkbox] → [×] remove. [+ Add State] button.
- **Context menu — canvas items**: Added "Zoom to Fit" and "Toggle Grid" to context menu (always present, near bottom). Wired `fitToCanvas()` and `setGrid(!gridVisible)`.
- **Context menu — Save as Stencil**: "Save as Stencil…" item (enabled when elements selected) triggers `SaveAsStencilDialog`.
- **SaveAsStencilDialog**: New component in `components/`. Dialog: name, category (flat list + "New Category…"), optional tags. Calls `graphicsApi.createStencil()`. Per spec §"Save as Stencil".
- **graphicsApi.createStencil**: New API method `POST /api/v1/design-objects` with `type='stencil'`, `svg_data`, `metadata.category/tags/nodes`.
- **graphicsApi.listStencils**: New API method `GET /api/v1/design-objects?type=stencil`.
- **StencilsSection**: Updated to fetch from `graphicsApi.listStencils()` instead of returning empty placeholder array.
- **Rulers & guides**: `RulersOverlay` component added to canvas. Thin top + left rulers with tick marks at configurable step. Drag from ruler → creates guide line. Guide lines rendered as colored (teal) divs over canvas with drag-to-move / drag-off-to-delete behavior. Guide snap in `snap()` function — guide lines take priority over grid snap within 6 canvas units.
- **Snap to guides**: `snap(v, axis?)` updated to check `guidesVisible && guides` first (6-unit threshold). Axis-aware: pass `'v'` for x-coords, `'h'` for y-coords.
- **PromoteToShapeWizard**: 8-step wizard component in `components/`. Steps: Name & Category, Boundary & Sizing, Connection Points (click-to-place on SVG preview), Stateful Elements, Text Zones, Value Display Anchors, Orientation & Mirror, Preview & Save. Saves via `graphicsApi.createStencil()` with shape metadata in payload.
- **Context menu — Promote to Shape**: "Promote to Shape…" item (enabled when elements selected) triggers PromoteToShapeWizard.
- **Double-click into group scope**: `handleDoubleClick` detects group nodes and calls `setActiveGroup(hitId)`. Visual indicator banner shows "Editing group — press Esc to exit". Escape first exits group scope. `uiStore.activeGroupId` and `setActiveGroup` added to store.
- **react-resizable**: Installed missing `react-resizable` package (peer dep of `react-grid-layout`) to fix Vite build error in `WorkspaceGrid.tsx`.

## 9. Spec Pass 4 — Session 2026-03-18 (continued)

### Completed this session

- **Group scope hit-testing**: `hitTest()` now respects `activeGroupId` — when inside a group, tests only against that group's children. Marquee selection also scoped to active group.
- **Concurrent editing / pessimistic lock**: `graphicsApi.acquireLock()` + `releaseLock()` added. `DesignerPage` acquires lock after loading a graphic, releases on unmount. If lock is held by another user, a purple read-only banner shows "Locked by [Name] since [time]" with a "Fork (Save As)" button. Save is blocked when not holding the lock. Lock is released + re-acquired after each save.
- **Point Browser section**: Added `PointBrowserSection` to `DesignerLeftPalette` (graphic mode, collapsible). Fetches from `pointsApi.list()` with debounced search. Each point row is draggable with `application/io-point` data transfer payload.
- **Quick Bind drag-and-drop**: `DesignerCanvas` now handles `onDragOver` / `onDrop` events. Dropping a point from Point Browser onto a `symbol_instance` auto-creates a `DisplayElement` (text_readout) positioned below the symbol, bound to the dropped point. Fully typed, zero TypeScript errors.
- **Unresolved Tag Indicator**: `PointResolutionIndicator` component added to `DesignerRightPanel`. Shown next to both `stateBinding` (SymbolInstance) and `binding` (DisplayElement) point ID fields. Debounced `pointsApi.list()` check → green ✓ (found) or yellow ⚠ not found indicator.
- **Phone Preview Mode**: `phonePreviewActive`/`setPhonePreview` wired into `DesignerToolbar` (dashboard mode only — phone icon button). Canvas renders a teal 375px frame overlay with dimming outside the frame when active.
- **Shape SVG Export**: `graphicsApi.exportShapeSvg()` + `graphicsApi.reimportShapeSvg()` added. `ShapeTile` in palette has right-click context menu with "Export SVG" (triggers download) and "Replace SVG…" (file picker → PUT, warns on viewBox change). Library shapes show only "Export SVG".
- **ShapeIndexItem.source**: Added optional `source?: 'library' | 'user'` field to distinguish built-in vs custom shapes.
- **Validate Bindings — real data**: `handleValidateBindings()` in `DesignerPage` walks the scene graph, collects all `pointId` values, batch-checks them via `pointsApi.list()`, and passes real resolved/unresolved counts to `ValidateBindingsDialog`. Dialog is now populated with actual data instead of hardcoded zeros.

## 10. Spec Pass 5 — Session 2026-03-18 (continued)

### Completed this session

- **Graphic Versioning**: `graphicsApi.getVersions()`, `getVersionContent()`, `publishGraphic()`, `restoreVersion()` added. `VersionHistoryDialog` upgraded from stub to real API calls. Preview loads version content into scene; Restore creates new draft server-side then reloads. Publish button added to `DesignerToolbar` (only shown when `canPublish` permission present). `isPublishing` state in `DesignerPage`.
- **Pipe insulation + dash pattern**: `Pipe` type gets `insulated?: boolean` + `dashPattern?: string` fields. `PipePanel` adds "Line Style" dropdown (solid/dashed/dotted/dash-dot) and "Insulated" checkbox. Canvas renders `strokeDasharray` for dash patterns; insulated pipes render two parallel offset lines (ISA P&ID convention).
- **Console historical playback wired to panes**: `GraphicPane`, `TrendPane`, `PointTablePane` all check `usePlaybackStore().mode`. In historical mode: WebSocket suspended, values fetched via `useHistoricalValues`. TrendPane fetches full time-range series via `pointsApi.getHistory()`. Process module also wired.
