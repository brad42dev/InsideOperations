# Inside/Operations - Process Module

## Overview

Full-screen viewing mode optimized for large single graphics ("super graphics"). Process is not a separate feature set from Console -- it is a viewing mode optimized for navigating one massive composite graphic that represents an entire plant or major process area.

**What Process IS**: A full-screen, single-graphic viewer with zoom/pan, minimap, and level-of-detail optimization. Element behavior (click for detail popups, hover for values, alarm states on elements) is identical to Console (doc 07). Rendering uses the Graphics System (doc 19).

**What Process is NOT**: A separate feature set. Console (doc 07) defines element interaction behavior. Graphics System (doc 19) defines rendering. This document covers viewport management and the super graphic concept.

## Core Concept: Super Graphics

A "super graphic" is a single large graphic composed of multiple unit graphics stitched together in the Designer (doc 09, Graphic mode). The entire plant as one navigable view.

- **User-creatable**: Users can create multiple process views per site (not limited to one). Created in the Designer's Graphic mode.
- **Composition**: Individual unit graphics (boiler area, tank farm, utilities, etc.) are manually arranged in the Designer to form a plant-wide view.
- **Scale**: Support for 10,000+ elements per view.

### Future Aspiration: Auto-Assembly

Automatically compose a plant-wide view from individual unit graphics by inferring how they connect. Prerequisites:

- Connection point metadata on graphics (defined in Designer)
- Shared point inference logic (points that appear on multiple unit graphics imply a connection)
- Designer pipe/connection element metadata

Manual composition for v1. Auto-assembly is a future enhancement once connection metadata is rich enough.

## Viewport Management

### Zoom and Pan
- Smooth zoom via mouse wheel and pinch-to-zoom on touch devices
- Pan with mouse drag or keyboard arrows
- Zoom-to-fit button (show entire graphic scaled to window)
- Bookmark specific view positions and zoom levels for quick navigation (saved per user)

### Minimap
- Shows full graphic outline as a thumbnail in a corner overlay
- Viewport rectangle indicates current visible area
- Click/drag on minimap to navigate directly
- Collapsible (user can hide if screen space is needed)

### Level of Detail (LOD)
- **Zoomed out**: Simplified elements -- hide text labels, reduce shape detail, show only major equipment outlines and status colors
- **Zoomed in**: Full detail -- text labels, value displays, connection lines, animation
- LOD thresholds configurable per graphic (Designer property)
- Smooth transitions between LOD levels (no jarring pop-in)

## Viewport Optimization

- Only subscribe to points in current viewport
- Unsubscribe when points leave viewport
- Adjust subscription density based on zoom level (zoomed-out LOD may not need all point values)
- Optimize for memory and network usage
- WebSocket updates include quality codes (good/bad/uncertain) per OPC UA standard
- UOM conversion performed client-side; frontend caches UOM catalog on init and converts raw values for display
- Points with a `custom_expression_id` (custom conversion applied via Expression Builder, see 23_EXPRESSION_BUILDER.md) have their display values automatically converted client-side before rendering. The raw value is received via WebSocket; the compiled expression is applied locally.

## Historical Playback

Process views support the same **Live ↔ Historical** mode toggle as Console (doc 07). Historical mode replays point data across the full-screen process graphic.

**Toggle behavior:** A `LIVE | HISTORICAL` toggle in the view toolbar. Historical mode pauses WebSocket updates and shows the shared **Historical Playback Bar** (doc 32) at the bottom of the viewport. Full playback controls: scrub, play/reverse, ×1–×32 speed, step intervals, loop regions, alarm markers, keyboard shortcuts.

**Viewport optimization in Historical mode:** Only points visible in the current viewport have their history fetched. Panning to a new area triggers a background history fetch for newly visible points over the current playback time range (debounced 500ms, same as live subscription management). This keeps memory and network usage proportional to what's on screen, even for 10,000+ point super graphics.

**Data fetching and rendering:** Same pipeline as Console — `POST /api/points/history-batch` (doc 21), client-side cache, binary search for last-known-value, same SVG DOM update path. See doc 32 for the complete Playback Bar specification.

---

## Data Export

- Export button in view toolbar: `[Export v]` split button with quick-format dropdown
- Export scope: current viewport (visible bound points) or entire view (all bound points)
- Three content modes: graphics only (PDF/HTML), graphics + data (PDF/HTML), data only (all formats)
- Graphics export renders SVG at current zoom/viewport state with frozen point values
- Data export columns: tagname, value, quality, timestamp, engineering_units, description
- Supported formats: CSV, XLSX, PDF, JSON, Parquet, HTML
- Requires `process:export` permission
- See 25_EXPORT_SYSTEM.md for full export dialog and graphics export specifications

## Point Context Menu on Graphics

Right-clicking any point-bound element on the process graphic opens the shared **Point Context Menu** (see `32_SHARED_UI_COMPONENTS.md`). Same behavior as Console (doc 07) — Point Detail, Trend Point, Investigate Point, Report on Point, plus Investigate Alarm on alarm elements. All permission-gated. Point Detail opens as a draggable floating window, up to 3 concurrent panels. `Ctrl+I` shortcut. See doc 32 for the full context menu and Point Detail panel specification.

## Navigation

- Hotspot links to other views (click a unit area to jump to its Console graphic)
- Breadcrumb trail
- View hierarchy tree
- Recent views list
- Favorite views

## User Stories

1. **As an engineer, I want to zoom into a specific unit to see detailed point values, so I can investigate an issue.**

2. **As an operator, I want to navigate between process areas using hotspots, so I can quickly check related equipment.**

3. **As a supervisor, I want to see an overview of the entire refinery on one screen, so I can assess overall status.**

## Technical Requirements

### Graphics Rendering
- Uses the hybrid SVG/Canvas rendering from doc 19 (Graphics System)
- Transform matrix for zoom/pan
- RequestAnimationFrame for smooth updates
- CSS will-change for performance

### Subscription Management
- Calculate visible points based on viewport
- Subscribe/unsubscribe dynamically
- Batch subscription requests
- Debounce during rapid zoom/pan

### Performance Targets
- Initial render < 1.5 seconds
- Zoom/pan smooth (60 FPS)
- Subscription update < 500ms
- Support 10,000+ point bindings

## API Endpoints

- `GET /api/graphics/:id` - Get graphic metadata and SVG
- `GET /api/graphics/:id/points` - Get point bindings for graphic
- `GET /api/graphics/hierarchy` - Get view hierarchy for navigation

## Success Criteria

- Large process views render smoothly
- Zoom/pan is responsive (60 FPS)
- Only visible points subscribed
- Hotspot navigation works correctly
- Handles 10,000+ elements per view
- Minimap accurately reflects viewport position
- LOD transitions are smooth and configurable
- Historical Playback: Live/Historical toggle, viewport-aware history fetching
- Historical Playback: Scrub, play, reverse, step, speed control (×1–×32), loop functional

## Detached Window Support

Process views can be opened in detached browser windows via the multi-window system. A detached Process window:

- Renders the full process graphic with real-time data bindings
- Uses the `/detached/process/:viewId` route
- Displays a minimal shell: thin title bar with view name and connection status, basic controls (zoom, pan, fullscreen)
- Each detached Process window manages its own viewport independently (zoom level, pan position)
- Each detached Process window registers its own point subscriptions with the SharedWorker — subscriptions are determined by which points are visible in the current viewport
- Multiple Process views can be open simultaneously across different monitors
- Viewport-based subscription optimization (see [Viewport Optimization](#viewport-optimization) above) applies independently per detached window

See `06_FRONTEND_SHELL.md` (Multi-Window Architecture) for full specification.

## Graphics Printing

Process views support the same two print paths as Console (doc 07):

**Browser print (Ctrl+P):** Prints the current viewport of the process graphic. Print color normalization (doc 06) applies automatically — white background, dark text, semantic colors preserved. Live data frozen on `beforeprint`.

**Print button (server-side PDF):** Same print dialog as Console — page size (Letter through A1), wall-mount or reference format, DPI, watermark toggle. Since Process is a single full-screen graphic rather than a multi-pane grid, the entire view is rendered as one graphic on the page.

Large-format wall-mount prints (A1/A3) of process overviews are a primary use case — these are posted in control rooms, operator shelters, and field locations for reference.

See doc 25 (Export System) for page size and watermark specifications. See doc 06 (Frontend Shell) for print color normalization rules.

---

## Emergency Alert Overlay

Emergency alert overlay is handled at the shell level (see `06_FRONTEND_SHELL.md`). All modules inherit this behavior automatically.

## Permissions

| Permission | Description | Default Roles |
|---|---|---|
| `process:read` | View process views and navigate between them | All roles |
| `process:write` | Create/edit process views | Operator, Analyst, Supervisor, Content Manager, Admin |
| `process:publish` | Publish process views for other users | Supervisor, Content Manager, Admin |
| `process:delete` | Delete process views | Supervisor, Admin |
| `process:export` | Export point data from process views | Operator, Analyst, Supervisor, Content Manager, Admin |
| `process:admin` | Process module administration | Admin |

*Role-permission assignments are managed centrally in doc 03. Defaults shown for reference.*

## Change Log

- **v1.5**: Converted permissions table from 3-role column format (User/Power User/Admin) to 2-column format with named Default Roles matching the 8 predefined roles (doc 03).
- **v1.4**: Added Historical Playback section. Live↔Historical mode toggle with shared Playback Bar (doc 32). Viewport-aware history fetching — only visible points fetched, panning triggers background fetch for newly visible points. Same rendering pipeline as live mode. See docs 07, 21, 32.
- **v1.3**: Renamed "Point Detail on Graphics" to "Point Context Menu on Graphics." Right-click on point-bound elements now opens the shared Point Context Menu (doc 32) with Point Detail, Trend Point, Investigate Point, Report on Point, and Investigate Alarm. Replaces Point Detail-only context menu.
- **v1.2**: Added Point Detail on Graphics section. Right-click → "Point Detail" on point-bound elements opens floating panel (doc 32). Up to 3 concurrent panels. Ctrl+I shortcut.
- **v1.1**: Added Graphics Printing section. Same two print paths as Console (doc 07): browser print with color normalization (doc 06) and Print button with server-side PDF (page sizes through A1, wall-mount/reference formats). Large-format wall-mount prints are a primary use case for process overviews. See docs 06, 07, 25.
- **v1.0**: Specified Process as full-screen optimized Console pane for super graphics. Added viewport management (zoom/pan, minimap, LOD, bookmarks). Clarified user-creatable process views. Auto-assembly noted as future aspiration. Clarified relationship to Console (doc 07) and Graphics System (doc 19).
- **v0.9**: Removed duplicate Emergency Alert Overlay spec; now handled at shell level (doc 06).
- **v0.8**: Added Permissions section with 6 Process module permissions and role assignments (from 03_SECURITY_RBAC.md). Reordered changelog entries chronologically.
- **v0.7**: Added Emergency Alert Overlay section — EMERGENCY alerts render full-screen overlay on Process views (main + detached), CRITICAL/WARNING as persistent banners. See 27_ALERT_SYSTEM.md.
- **v0.6**: Fixed escaped backslash in document title heading.
- **v0.5**: Added Detached Window Support section — Process views in multi-window layouts with independent viewport management.
- **v0.4**: Added Data Export section. Process views gain per-viewport and per-view export with 6 formats. Graphics export (PDF/HTML) renders SVG at current zoom state with frozen point values. Requires `process:export` permission. See 25_EXPORT_SYSTEM.md.
- **v0.3**: Added note on client-side custom expression evaluation for points with `custom_expression_id` (23_EXPRESSION_BUILDER.md).
- **v0.2**: Added quality codes in WebSocket updates and client-side UOM conversion (frontend caches UOM catalog on init) to viewport optimization.
