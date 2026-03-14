# Inside/Operations — Console Module

## Overview

Multi-pane real-time graphics display for monitoring industrial processes, analogous to a physical control room with multiple screens. Operators build workspaces by arranging SVG process graphics into configurable grid layouts with live data overlays. The Console is the primary operational view for day-to-day plant monitoring.

---

## Module Layout

### Application Shell Integration

The Console module uses the application-wide top navigation bar (hideable via icon click) and adds a module-specific left navigation panel. The main workspace area fills the remaining space.

```
┌─────────────────────────────────────────────────────────┐
│  Top Navigation (hideable)                              │
├────────────┬────────────────────────────────────────────┤
│            │                                            │
│   Left     │         Workspace (Grid Area)              │
│   Nav      │                                            │
│   Panel    │    ┌──────────┬──────────┐                 │
│            │    │  Pane 1  │  Pane 2  │                 │
│ ┌────────┐ │    │          │          │                 │
│ │Workspcs│ │    ├──────────┼──────────┤                 │
│ ├────────┤ │    │  Pane 3  │  Pane 4  │                 │
│ │Graphics│ │    │          │          │                 │
│ ├────────┤ │    └──────────┴──────────┘                 │
│ │Widgets │ │                                            │
│ ├────────┤ │                                            │
│ │Points  │ │                                            │
│ └────────┘ │                                            │
├────────────┴────────────────────────────────────────────┤
│  Workspace Toolbar (layout selector, undo/redo, save)   │
└─────────────────────────────────────────────────────────┘
```

### Left Navigation Panel

The left panel contains four accordion sections. All four fit comfortably on a 1440p or 2160p 16:9 display with all sections expanded.

**Panel behavior:**
- Each accordion section is independently expandable/collapsible
- Section heights are resizable — drag the bottom edge of any section to make it taller or shorter
- The panel itself can be collapsed entirely to maximize workspace area

**Common features across all four sections:**
- **Favorites group**: Each section has a collapsible "Favorites" group pinned at the top. Users star items to add them to favorites. Favorites appear in all view modes.
- **View mode selector**: Three small icons at the top-right of each section switch between view modes:
  - **List**: Names only, compact vertical list, maximum density
  - **Thumbnails + Name**: Preview thumbnail with up to 2 lines of name text (truncated with full name on hover)
  - **Grid/Palette**: Thumbnail grid arranged in a tiled pattern for visual browsing
- **Search/filter**: Each section has a filter input that narrows the displayed items

#### 1. Workspaces Section

Lists the user's saved workspaces plus published/shared workspaces they have access to. Items show workspace name and layout thumbnail (miniature grid preview). Click to load. Right-click for rename, delete, duplicate, share options.

#### 2. Graphics Section

Available console graphics (SVG process graphics created in the Designer module). Items are draggable onto the workspace. Organized by folders/categories if the graphic library uses them.

#### 3. Widgets Section

Non-graphic items that can be placed into panes:
- **Trend**: Live trend chart (time-series line/area chart for one or more points)
- **Table**: Tabular display of point values with configurable columns

These are dragged onto the workspace the same way as graphics. See [Points, Trends, and Tables](#points-trends-and-tables).

#### 4. Points Section

Searchable point browser. Users search by tagname, description, or metadata. Results list individual data points that can be:
- Multi-selected (Ctrl+click or Shift+click)
- Dragged onto an existing trend or table pane to add those points
- Dragged onto empty workspace space to create a new trend pane
- Dragged onto an empty pane to convert it to a trend with those points assigned

---

## Workspace Management

- Create, edit, delete, and duplicate workspaces
- Save workspace configuration (layout + pane assignments + settings)
- **Publish** workspaces — make available to all users with Console access
- **Share** workspaces — grant access to specific users or roles
- **Save As** — users without save permission on a shared/published workspace can still make layout changes and save to a new personal workspace
- Auto-save on changes (debounced 2 seconds) for workspaces the user owns
- Load saved workspaces from the Workspaces section in the left panel

---

## Grid Layout System

The workspace uses `react-grid-layout` v2 with a 12-column coordinate system. All layouts are expressed as item positions within this grid.

### Predefined Grid Templates

#### Even Grid Templates

Evenly-spaced layouts from 1×1 to 4×4 (width × height):

| Template | Panes | Description |
|----------|-------|-------------|
| 1×1 | 1 | Single full-size graphic |
| 1×2 | 2 | 1 column, 2 rows |
| 1×3 | 3 | 1 column, 3 rows |
| 1×4 | 4 | 1 column, 4 rows |
| 2×1 | 2 | 2 columns, 1 row |
| 2×2 | 4 | 2 columns, 2 rows |
| 2×3 | 6 | 2 columns, 3 rows |
| 2×4 | 8 | 2 columns, 4 rows |
| 3×1 | 3 | 3 columns, 1 row |
| 3×2 | 6 | 3 columns, 2 rows |
| 3×3 | 9 | 3 columns, 3 rows |
| 3×4 | 12 | 3 columns, 4 rows |
| 4×1 | 4 | 4 columns, 1 row |
| 4×2 | 8 | 4 columns, 2 rows |
| 4×3 | 12 | 4 columns, 3 rows |
| 4×4 | 16 | 4 columns, 4 rows |

#### Asymmetric Templates

| Template | Panes | Description |
|----------|-------|-------------|
| 1 Big + 3 Small (L) | 4 | Large pane left, 3 stacked right |
| 1 Big + 3 Small (R) | 4 | Large pane right, 3 stacked left |
| 1 Big + 3 Small (T) | 4 | Large pane top, 3 side-by-side bottom |
| 1 Big + 3 Small (B) | 4 | Large pane bottom, 3 side-by-side top |
| 2 Big + 4 Small (T) | 6 | 2 large top, 4 small bottom |
| 2 Big + 4 Small (B) | 6 | 2 large bottom, 4 small top |
| 2 Big + 8 Small | 10 | 2 large center, 4 small across top, 4 small across bottom |
| Picture-in-Picture | 5 | 1 large background, 4 small corners |

### Layout Template Selector

The selector is a toolbar component displaying visual icons for each template. Each icon is a miniature picture of the grid pattern it represents (e.g., the 2×2 icon shows 4 equal boxes, the 1 Big + 3 Small icon shows the asymmetric arrangement). Click an icon to apply that template.

### Aspect Ratio and Letterboxing

**Default behavior (maintain aspect ratio):**
- Graphics render with SVG `preserveAspectRatio="xMidYMid meet"` — the graphic scales uniformly to fit the pane while preserving its native aspect ratio
- Unused space appears as background-colored bars (letterboxing on top/bottom or pillarboxing on left/right), matching the workspace background color
- The standard graphics aspect ratio is defined globally in the Designer module so all console graphics align cleanly in grid layouts

**Toggle: Ignore Aspect Ratio:**
- When toggled on, graphics render with `preserveAspectRatio="none"` — stretched to fill the pane completely
- This is a per-workspace setting (applies to all panes in the workspace)

### Applying Templates to Populated Grids

When switching to a new layout template while graphics are already displayed:

**Row-major ordering** — panes are numbered left-to-right, then top-to-bottom. In a 3×3 grid:

```
1:1  1:2  1:3
2:1  2:2  2:3
3:1  3:2  3:3
```

Position 1:1 is slot 1, 1:2 is slot 2, 1:3 is slot 3, 2:1 is slot 4, etc.

**Upsizing** (e.g., 2×2 → 3×3): The 4 existing graphics fill the first 4 slots (1:1, 1:2, 1:3, 2:1) of the new layout. Remaining 5 slots are empty.

**Downsizing** (e.g., 3×3 → 2×2): The first 4 graphics in row-major order (positions 1:1, 1:2, 1:3, 2:1 from the old layout) fill all 4 slots of the new layout. The remaining 5 graphics are removed from view. The user can undo this operation to restore the previous layout.

**Asymmetric templates**: The large pane(s) are always the first slot(s) in row-major order. For "1 Big + 3 Small (L)", the big pane is slot 1, the three small panes are slots 2-4.

### Clear Grid

A "Clear" action removes all graphics from all panes but retains the current grid template. The empty panes remain in place, ready for new graphics to be dragged in.

---

## Pane Interactions

### Pane Visual Feedback

Panes are visually minimal — no built-in headers or title bars. Pane chrome:
- **Hover**: Thin highlight border appears around the pane
- **Selected**: Persistent highlight border (distinct color or weight from hover)
- **Multi-selected**: All selected panes show the selection border simultaneously
- **Drop target**: Visual indicator when dragging an item over a valid drop target

If users want per-graphic headers, they create them in the Designer module as part of the SVG graphic itself (the Designer will support a header object with always-visible or hover-only options).

### Drag and Drop from Palette

- **Drag a graphic** from the Graphics section onto an **empty part** of the workspace → creates a new pane containing that graphic
- **Drag a graphic** onto an **existing pane** → replaces that pane's content with the new graphic
- **Drag a trend or table widget** from the Widgets section → behaves identically (creates a new pane or replaces an existing pane's content)

### Double-Click Quick Place

Double-clicking an item in the left panel (graphic, trend, or table) auto-places it:
1. If any pane is selected → replace the selected pane's content. If multiple panes are selected, replace the first in selection order; subsequent double-clicks replace the next selected pane in sequence.
2. If no pane is selected and an empty pane exists → fill the first empty pane (row-major order)
3. If no empty panes exist → add a new pane to the grid
4. If no panes at all → create a 1×1 layout with the item

### Pane Swapping

Dragging a pane (left click + hold + drag) onto another pane swaps their positions in the grid. The dragged pane moves to the target's grid coordinates and the target moves to where the dragged pane was.

### Removing Panes

- **Drag outside workspace**: Dragging a pane outside the workspace boundary removes it from the grid. The remaining panes reorganize to fill the space.
- **Delete key**: Pressing Delete removes all selected panes from the grid.
- **Right-click → Remove**: Context menu option on any pane.

### Resizing Panes

Every pane border is draggable to resize. Resizing one pane auto-resizes its neighbors to maintain grid coherence. Aspect ratio behavior (maintain or ignore) applies during resize operations the same as it does for the grid layout itself.

### Adding Panes

Besides drag-from-palette, users can:
- **Right-click** on an empty area of the workspace → "Add Pane" creates an empty pane at that location
- **Apply a template** with more panes than currently exist

### Pane Selection

| Action | Behavior |
|--------|----------|
| Left-click a pane | Select that pane (deselect all others) |
| Ctrl + left-click | Toggle that pane's selection (add/remove from multi-select) |
| Left-click + drag on empty space | Box select — all panes within the drawn rectangle become selected |
| Ctrl+A (workspace focused) | Select all panes |
| Click on empty space | Deselect all |
| Escape | Deselect all |

### Copy and Paste

- **Ctrl+C**: Copy selected pane(s) — serializes the graphic assignments (not the grid positions)
- **Ctrl+V**: Paste into the current workspace — pastes graphics starting at the first empty pane, or the first selected pane, or the first pane if none selected/empty. If pasting multiple graphics, they fill panes sequentially in row-major order from the paste start point.
- **Cross-workspace paste**: Copy panes in one workspace, switch to another workspace, paste. Enables quick workspace assembly from existing layouts.

---

## Points, Trends, and Tables

### Point Integration

Points from the Points section in the left panel interact with the workspace:
- **Drop point(s) on a trend pane** → add those points to the trend
- **Drop point(s) on a table pane** → add those points to the table
- **Drop point(s) on empty workspace** → create a new trend pane with those points
- **Drop point(s) on an empty pane** → convert to a trend pane with those points

Multiple points can be multi-selected in the Points section and dragged as a group.

### Trend and Table Panes

Trend and table panes are first-class pane types alongside graphics. They support all the same pane interactions (drag, swap, resize, select, copy/paste, remove).

### Cross-Module Reuse

Trends and Tables share behavior across Console, Process, Dashboards, Reports, Log, and Rounds modules. Their internal specification (configuration, controls, time range selection, data binding, rendering) will be defined in a shared specification to ensure consistency. This document covers only how they integrate into the Console workspace grid — see `32_SHARED_UI_COMPONENTS.md` for full trend and table behavior.

---

## Graphics Display

- SVG rendering with point bindings (see `19_GRAPHICS_SYSTEM.md`)
- Real-time data updates via WebSocket
- Smooth animations for value changes (CSS transitions on bound SVG properties)
- Quality indicators (good/bad/uncertain) per OPC UA standard
- Timestamp display for each point
- Zoom controls for individual graphics within panes
- Point value tooltips on hover
- Full-screen mode for individual panes (expand one pane to fill the workspace, Escape or toggle to return)

### Point Context Menu on Graphics

Right-clicking any point-bound element on a graphic opens the shared **Point Context Menu** (see `32_SHARED_UI_COMPONENTS.md`). Menu items include Point Detail, Trend Point, Investigate Point, and Report on Point — all permission-gated. On alarms, an additional "Investigate Alarm" option appears. The Point Detail panel is a draggable, resizable floating window — not a slide-out — so it does not interfere with multi-pane layouts. Up to 3 Point Detail panels can be open simultaneously. `Ctrl+I` with a point selected opens Point Detail directly. See doc 32 for the full context menu and Point Detail panel specification.

---

## Historical Playback

Console workspaces support a **Live ↔ Historical** mode toggle in the workspace toolbar. Historical mode replays point data from any time in the system's history across all panes simultaneously.

**Toggle behavior:**
- **Live** (default): All panes receive real-time WebSocket updates. Playback Bar is hidden.
- **Historical**: WebSocket updates are paused (subscriptions kept alive but incoming data ignored). All panes — graphics, trends, and tables — render values from the playback timestamp. The shared **Historical Playback Bar** (doc 32) appears at the bottom of the workspace, above the status bar.

**Workspace-level synchronization:** All panes in the workspace render at the same playback timestamp. A 2×3 workspace with 6 process graphics all show the plant state at the same moment. Trend panes display a vertical cursor line at the playback timestamp that scrolls with playback. Table panes show values at the playback timestamp.

**Controls:** Full playback mode — scrub bar with alarm markers, transport controls (play, pause, reverse, step forward/back), speed selector (×1 through ×32), step interval dropdown (Next change, 1s through 1h), loop region handles, keyboard shortcuts. See doc 32 for the complete Playback Bar specification.

**Data fetching:** On entering Historical mode, the client fetches point history for all visible points via `POST /api/points/history-batch` (doc 21). Data is cached client-side and pre-fetched ahead of the playhead. The same SVG rendering pipeline used for live updates drives historical rendering — only the data source changes.

**Returning to Live:** Toggling back to Live mode dismisses the Playback Bar and resumes processing WebSocket updates. No re-subscription needed.

---

## Real-Time Updates

### WebSocket Integration

- Connect to broker: `wss://hostname:3001/ws?ticket=<ticket>` (single-use ticket, 30s TTL, see doc 16)
- Subscribe message: `{"type": "subscribe", "points": ["uuid1", "uuid2"]}`
- Receive updates: `{"type": "update", "point_id": "uuid", "value": 123.45, ...}`
- Handle reconnection with exponential backoff
- Subscribe to points when a graphic is displayed; unsubscribe when removed

### Update Pipeline

Real-time point value updates bypass React's reconciliation entirely. React owns the layout; direct DOM manipulation handles the data display.

**Pipeline:**

```
WebSocket message arrives
        │
        ▼
[Message buffer] ── mutable array, NOT React state
  Accumulates messages between frames
        │
        ▼
[requestAnimationFrame loop] ── runs at display refresh rate (~60fps)
  Drain buffer
  For each point update:
    Look up bound SVG elements via ref registry
    Apply UOM conversion (cached converter functions)
    Apply custom expression if applicable (see 23_EXPRESSION_BUILDER.md)
    Direct DOM update: element.textContent, element.setAttribute
  Clear buffer
```

This architecture scales linearly with point count, not pane count. Performance is the same whether 1,000 points are spread across 16 panes or concentrated in 1 pane.

### Data Specifics

- WebSocket updates include quality codes (good/bad/uncertain) per OPC UA standard
- UOM conversion performed client-side; frontend caches UOM catalog on init and converts raw values for display
- Points reference `points_metadata(id)` UUIDs which include source context from multi-source point model
- Points with a `custom_expression_id` (see `23_EXPRESSION_BUILDER.md`) have display values converted client-side before rendering — transparent to the console display logic

---

## Undo/Redo

- **Ctrl+Z**: Undo last workspace change
- **Ctrl+Y** / **Ctrl+Shift+Z**: Redo
- **History depth**: 50 changes by default, configurable in user settings
- **Tracked operations**: Layout changes (add/remove/resize/reorder panes), template application, pane content assignment, clear grid
- **Not tracked**: Selection state, hover state, real-time data values
- **Drag/resize pausing**: Undo history does not capture intermediate positions during a drag or resize — only the final position after drop/release
- **Implementation**: Zustand store with `zundo` temporal middleware. Snapshot-based (layout state is ~1.6KB for 16 panes; 50 snapshots ≈ 80KB — negligible)

---

## Data Export

- Export button in workspace toolbar: `[Export ▼]` split button with quick-format dropdown
- Export scope: per-pane (single graphic's bound points), per-workspace (all panes combined)
- Three content modes for graphics panes: graphics only (PDF/HTML), graphics + data (PDF/HTML), data only (all formats)
- Graphics export renders SVG with frozen point values at export time
- Data export columns: tagname, value, quality, timestamp, engineering_units, description
- Supported formats: CSV, XLSX, PDF, JSON, Parquet, HTML
- Requires `console:export` permission
- See `25_EXPORT_SYSTEM.md` for full export dialog and graphics export specifications

---

## User Stories

1. **As an operator**, I want to create a workspace with 4 panes showing different process areas, so I can monitor multiple units simultaneously.

2. **As a supervisor**, I want to publish a standard workspace for my team, so all operators use the same layout.

3. **As an engineer**, I want to see live point values updating in real-time, so I can observe process dynamics.

4. **As an operator**, I want to drag a graphic from the palette and drop it into a pane, so I can quickly build a custom monitoring view.

5. **As an operator**, I want to swap two panes by dragging one onto another, so I can rearrange my view without rebuilding it.

6. **As an operator**, I want to switch from a 2×2 layout to a 3×3 layout and have my existing graphics automatically fill the first 4 panes, so I can add more views without losing my current setup.

7. **As an operator**, I want to drop a point from the point search onto my workspace and get a live trend, so I can quickly monitor a value without configuring a full graphic.

8. **As a shift supervisor**, I want to copy panes from one workspace and paste them into another, so I can build composite views from existing pieces.

9. **As an operator on a shared workspace**, I want to rearrange panes for my shift and save it as my own workspace, so I don't modify the team layout.

---

## Technical Implementation

### Recommended Libraries

| Concern | Library | Version | License |
|---------|---------|---------|---------|
| Grid layout + resize + drag | `react-grid-layout` | 2.x | MIT |
| Supplemental DnD (palette, multi-select) | `@dnd-kit` | Latest | MIT |
| State management | `zustand` | 4.x | MIT |
| Undo/redo | `zundo` | 2.x | MIT |
| Selection | Custom (Zustand + pointer events) | — | — |

See `01_TECHNOLOGY_STACK.md` for full library details.

### react-grid-layout v2 Configuration

- 12-column coordinate system
- `noCompactor` — fixed positions, no auto-compaction (predefined layouts use explicit coordinates)
- `aspectRatioConstraint` — built-in constraint enforcer for aspect ratio maintenance
- `droppingItem` — external drag from sidebar palette into the grid
- `onDragStop` — custom swap detection and drag-to-remove logic
- `onLayoutChange` — sync to Zustand store for undo capture and auto-save

### State Architecture

Three Zustand stores with separation of concerns:

**WorkspaceStore** (with `zundo` temporal middleware):
- `layout` — grid positions and sizes (LayoutItem array)
- `panes` — what content each pane displays (graphic ID, trend config, table config)
- Workspace metadata (ID, name, owner, isDirty)
- Actions: save, load, applyTemplate, addPane, removePane, swapPanes, clearGrid

**SelectionStore** (no temporal — selection is ephemeral):
- `selectedPaneIds` — set of selected pane IDs
- `selectionRect` — current drag-select rectangle (if active)
- Actions: select, deselect, toggle, selectAll, clearSelection, startDragSelect

**RealtimeStore** (no temporal — data is ephemeral):
- Point value buffer (mutable ref, not React state)
- Subscription registry (pane → point IDs)
- `RealtimeUpdateManager` class handles RAF loop and direct DOM updates

### Performance Strategy

| Technique | Details |
|-----------|---------|
| Direct DOM updates | Real-time point values bypass React — applied via element refs in RAF loop |
| `React.memo` on GridPane | Panes only re-render for layout or content changes, never for data updates |
| CSS `contain: layout style paint` | Each pane is layout-isolated; changes in one pane don't trigger reflow in others |
| Update coalescing | Multiple updates to the same point within one frame → only the latest is applied |
| Subscription management | Each pane subscribes only to its graphic's bound points; unsubscribe on removal |
| LOD for dense grids | For 4×4 grids with complex SVGs, consider simplified SVG variants for small panes. Profile DOM node count early — if total exceeds ~50,000 nodes, LOD is necessary. |

### Key Custom Code

| Feature | Approach | Est. Complexity |
|---------|----------|-----------------|
| Pane swap on drop | Detect overlap in `onDragStop`, swap coordinates programmatically | ~50 lines |
| Drag to remove | Detect out-of-bounds position in `onDragStop`, remove from layout | ~30 lines |
| Multi-select copy/paste | Serialize/deserialize pane assignments in SelectionStore | ~100 lines |
| Box selection | Pointer event handlers + rectangle intersection with pane positions | ~80 lines |

---

## API Endpoints

- `GET /api/workspaces` — List user's workspaces (owned + shared + published)
- `POST /api/workspaces` — Create workspace
- `GET /api/workspaces/:id` — Get workspace (layout + pane config)
- `PUT /api/workspaces/:id` — Update workspace (auto-save target)
- `DELETE /api/workspaces/:id` — Delete workspace
- `POST /api/workspaces/:id/publish` — Publish workspace to all users
- `POST /api/workspaces/:id/share` — Share with specific users/roles
- `POST /api/workspaces/:id/duplicate` — Duplicate workspace (for Save As)
- `GET /api/console/graphics` — List available graphics for the palette
- `GET /api/console/graphics/:id` — Get graphic SVG and point bindings

---

## Persistence

- Workspaces saved to database as JSONB (layout array + pane configurations + workspace settings)
- Auto-save on changes (debounced 2 seconds) for workspaces the user owns
- Undo/redo state is client-side only (not persisted to server)
- Version history (future enhancement)

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Graphic render time | < 1.5s per graphic |
| Grid resize response | < 100ms |
| Point update latency | < 2s end-to-end (OPC → WebSocket → DOM) |
| Points per workspace | 10,000+ concurrent |
| Point updates per second | 1,000+ across all panes |
| Smooth pane transitions | CSS transforms, no jank during drag/resize |
| Concurrent users | 200+ |

---

## Permissions

| Permission | Description |
|---|---|
| `console:read` | View console workspaces and live graphics |
| `console:write` | Create and edit personal workspaces |
| `console:workspace_write` | Create and edit any workspace |
| `console:workspace_publish` | Publish workspaces for all users |
| `console:workspace_delete` | Delete workspaces |
| `console:export` | Export point data from console workspaces |
| `console:admin` | Console module administration |

---

## Success Criteria

- [ ] Users can create multi-pane workspaces from predefined templates
- [ ] All 16 even grid templates and 8 asymmetric templates available
- [ ] Layout template selector shows visual grid icons
- [ ] Graphics display with real-time updates (< 2s latency)
- [ ] Drag and drop from palette to workspace creates/replaces panes
- [ ] Pane swap on drop works correctly
- [ ] Pane removal via drag-outside, Delete key, and right-click
- [ ] Pane resizing with neighbor auto-adjustment
- [ ] Aspect ratio maintained by default with letterboxing; toggle to stretch
- [ ] Layout switching preserves existing graphics in row-major order
- [ ] Left panel accordion with favorites and 3 view modes
- [ ] Point drag onto trends/tables adds points; onto empty space creates trend
- [ ] Multi-select (click, Ctrl+click, box select, Ctrl+A) works
- [ ] Copy/paste between workspaces functional
- [ ] Undo/redo with 50-level history (configurable)
- [ ] Save As for users without save permission on shared workspaces
- [ ] Workspaces auto-save and load correctly
- [ ] Published workspaces accessible to team
- [ ] System handles 200 concurrent users
- [ ] 16-pane workspace with 1,000+ point updates/second renders smoothly
- [ ] Historical Playback: Live/Historical toggle, all panes sync to playback timestamp
- [ ] Historical Playback: Scrub, play, reverse, step, speed control (×1–×32), loop functional
- [ ] Historical Playback: Alarm markers visible on timeline, clickable to jump

---

## Detached Window Support

Console workspaces can be opened in detached browser windows via the multi-window system. A detached Console window:

- Renders the full workspace grid layout (all panes, all real-time data)
- Uses the `/detached/console/:workspaceId` route
- Displays a minimal shell: thin title bar with workspace name and connection status, basic controls (pane swap, resize, zoom, fullscreen)
- No sidebar navigation, no module switcher — just the workspace content
- Shares the WebSocket connection with all other windows via SharedWorker (see `16_REALTIME_WEBSOCKET.md`)
- Point subscriptions are managed per-window — each detached Console window registers its own subscriptions with the SharedWorker
- Multiple Console workspaces can be open simultaneously in separate detached windows

See `06_FRONTEND_SHELL.md` (Multi-Window Architecture) for full specification including Window Groups, BroadcastChannel sync, and window lifecycle.

---

## Graphics Printing

Console workspaces support two print paths:

**Browser print (Ctrl+P):** Prints the current workspace grid with all panes. The `@media print` stylesheet (doc 06) applies print color normalization (white background, dark text, semantic colors preserved), freezes live data values, and hides UI chrome. Multi-pane layouts print as a grid on the page. Suitable for quick desk reference prints.

**Print button (server-side PDF):** Opens a print dialog with options:

- **Scope**: Selected pane (single graphic) or entire workspace (all panes)
- **Content**: Graphics only, Graphics + data (point value table follows graphic), Data only
- **Page size**: Letter, A4, Ledger, A3, A1 (for wall-mount plotter output)
- **Format**: Wall Mount (graphic fills page, minimal margins, optional title bar) or Reference (border, title block, alarm legend, point value table)
- **Watermark**: "UNCONTROLLED COPY" toggle (default on, configurable in Settings)
- **DPI**: 72, 150, 300 (for graphics rendering to PDF image)

Wall-mount prints at A1/A3 are designed for posting in control rooms and field locations — large-format graphics with current values frozen at print time.

See doc 25 (Export System) for page size and watermark specifications. See doc 06 (Frontend Shell) for print color normalization rules.

---

## Emergency Alert Overlay

Emergency alert overlay is handled at the shell level (see `06_FRONTEND_SHELL.md`). All modules inherit this behavior automatically.

---

## Change Log

- **v1.5**: Fixed stale WebSocket URL from `?token=<jwt>` to `?ticket=<ticket>` (ticket-based auth per doc 16).
- **v1.4**: Replaced "(TBD)" shared trend/table reference with concrete pointer to `32_SHARED_UI_COMPONENTS.md`.
- **v1.3**: Added Historical Playback section. Live↔Historical mode toggle on workspace toolbar. All panes sync to a single playback timestamp. Uses the shared Historical Playback Bar (doc 32) with full controls: scrub, play/reverse, ×1–×32 speed, step intervals, loop regions, alarm markers, keyboard shortcuts. Data fetched via `POST /api/points/history-batch` (doc 21), rendered through the same SVG pipeline as live mode.
- **v1.2**: Renamed "Point Detail on Graphics" to "Point Context Menu on Graphics." Right-click on point-bound elements now opens the shared Point Context Menu (doc 32) with Point Detail, Trend Point, Investigate Point, Report on Point, and Investigate Alarm. Replaces Point Detail-only context menu.
- **v1.1**: Added Point Detail on Graphics section. Right-click → "Point Detail" on any point-bound graphic element opens the floating Point Detail panel (doc 32). Up to 3 concurrent panels. Ctrl+I shortcut. See doc 32.
- **v1.0**: Added Graphics Printing section. Browser print (Ctrl+P) with color normalization from doc 06. Print button with server-side PDF: scope (pane/workspace), content mode (graphics/data/both), page sizes (Letter through A1 for wall-mount plotter), Wall Mount and Reference formats, watermark toggle, DPI options. See docs 06 and 25.
- **v0.9**: Removed duplicate Emergency Alert Overlay spec; now handled at shell level (doc 06).
- **v0.8**: Added Emergency Alert Overlay section — EMERGENCY alerts render full-screen overlay on Console workspaces (main + detached), CRITICAL/WARNING as persistent banners. See 27_ALERT_SYSTEM.md.
- **v0.7**: Fixed permissions table — replaced 4 incorrect permission names with canonical 7-permission set from RBAC doc (03_SECURITY_RBAC.md).
- **v0.6**: Added Detached Window Support section — Console workspaces in multi-window layouts.
- **v0.5**: Major expansion — added full grid layout specification (16 even + 8 asymmetric templates), left navigation panel (4 accordion sections with favorites and 3 view modes), comprehensive pane interactions (drag-and-drop, swap, remove, resize, selection, copy/paste, double-click quick place), aspect ratio and letterboxing behavior, layout switching with row-major ordering, points/trends/tables integration, undo/redo (50-level, configurable), Save As for shared workspaces, technical implementation (react-grid-layout v2, zustand + zundo, direct DOM update pipeline), and performance strategy. See also `01_TECHNOLOGY_STACK.md` v0.5 for new libraries.
- **v0.4**: Added Data Export section. Console workspaces gain per-pane and per-workspace export with 6 formats. Graphics export (PDF/HTML) renders SVG with frozen point values. Requires `console:export` permission. See `25_EXPORT_SYSTEM.md`.
- **v0.3**: Added note on client-side custom expression evaluation for points with `custom_expression_id` (`23_EXPRESSION_BUILDER.md`).
- **v0.2**: Added quality codes in WebSocket updates, client-side UOM conversion (frontend caches UOM catalog on init), and source context for `points_metadata(id)` references from multi-source point model.
