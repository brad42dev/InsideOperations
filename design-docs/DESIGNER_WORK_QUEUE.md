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

### 3.8 iographic Import — Broken

**Problem:** When importing `.iographic` (IO native format) files:
- Graphics come in but are not editable — cannot click on any element
- Should come in as native IO shapes and piping, fully editable in the designer

**Fix:**
- iographic import should parse the file and create proper editable designer objects from the shapes and pipes
- Each element should be individually selectable, movable, and resizable

**Generic SVG import should also work:**
- Imported SVG elements should become selectable stencils/objects
- Should be manipulatable (move, resize, rotate)

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

1. Fix resize handles (broken, high impact)
2. Fix multi-select (broken, high impact)
3. Fix zoom controls (broken, high impact)
4. Icon-based toolbar
5. Rubber-band selection
6. Rotation support + right-click context menu
7. Freehand draw tool
8. Image import
9. iographic import editing
10. Compact asset palette with thumbnails
11. Navigation collapse
12. Report objects functioning
