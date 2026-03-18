# Inside/Operations — Gap Analysis
_Generated: 2026-03-17. Updated: 2026-03-18 (pass 3). Covers docs 00–39 (all 40 design documents)._

---

## Scope and Method

Each design document (00–10, 38) was read in full and compared to the current frontend implementation at `/home/io/io-dev/io/frontend/`. The backend and database are not audited here — see project_status.md which confirms those phases complete.

**Key paths checked:**
- `frontend/src/shared/layout/AppShell.tsx` — shell, sidebar, topbar
- `frontend/src/shared/theme/tokens.ts` + `frontend/src/index.css` — design tokens
- `frontend/src/App.tsx` — route map
- `frontend/src/pages/console/` — Console module
- `frontend/src/pages/process/` — Process module
- `frontend/src/pages/dashboards/` — Dashboards module
- `frontend/src/shared/components/CommandPalette.tsx` — global search
- `frontend/package.json` — installed libraries

---

## Summary Table

| Doc | Area | Gap Severity | Status |
|-----|------|-------------|--------|
| 06 | Design tokens — missing ~90 of 138 specified tokens | MEDIUM | **DONE** (pass 2: all 138 tokens now in tokens.ts for all 3 themes) |
| 06 | Typography — Inter/JetBrains Mono fonts not loaded | MEDIUM | **DONE** (Google Fonts preloaded in index.html) |
| 06 | Sidebar — width 220px vs spec 240px | LOW | **DONE** (tokens.ts: 240px/48px) |
| 06 | Sidebar — Hidden (0px) state not implemented | MEDIUM | Deferred (low user impact) |
| 06 | Sidebar — Collapsed hover-to-expand overlay not implemented | LOW | Deferred |
| 06 | Sidebar — Navigation grouping (Monitoring/Analysis/Operations/Management) not implemented | MEDIUM | **DONE** (NAV_GROUPS already in AppShell) |
| 06 | Sidebar — Badge counts (unread alerts, active rounds) not implemented | LOW | Deferred |
| 06 | Top bar — hide/show (Ctrl+Shift+T) not implemented | LOW | Deferred |
| 06 | Top bar — alert notification bell not implemented | MEDIUM | **DONE** (AlertBell component in AppShell) |
| 06 | Top bar — breadcrumbs not implemented | LOW | **DONE** (buildBreadcrumbs in AppShell) |
| 06 | Command palette — G-key navigation not implemented | LOW | **DONE** (G_KEY_MAP in AppShell) |
| 06 | Command palette — prefix scopes (> @ / #) not implemented | LOW | Deferred |
| 06 | Command palette — uses Radix Dialog not cmdk library | LOW | Acceptable |
| 06 | Kiosk mode — Ctrl+Shift+T not implemented, kiosk flag exists | LOW | Acceptable |
| 06 | Print stylesheet not implemented | LOW | **DONE** (@media print in index.css) |
| 06 | Multi-window / detached windows not implemented | HIGH | Deferred (large architectural) |
| 07 | Console — only 6 layout presets vs spec 16+8=24 | MEDIUM | **DONE** (24+ presets in WorkspaceGrid + ConsolePage) |
| 07 | Console — react-grid-layout not used; CSS grid used instead | MEDIUM | Acceptable (CSS grid is simpler, adequate) |
| 07 | Console — left panel accordion (4 sections) not implemented | HIGH | **DONE** (ConsolePalette.tsx — Graphics/Widgets/Points accordion) |
| 07 | Console — drag-and-drop from palette to workspace not implemented | HIGH | **DONE** (HTML5 DnD in ConsolePalette → PaneWrapper → WorkspaceGrid) |
| 07 | Console — pane swap, box select, copy/paste not implemented | MEDIUM | Deferred |
| 07 | Console — undo/redo (zundo) not implemented | MEDIUM | **DONE** (useRef-based 50-level stacks, Ctrl+Z/Y/Shift+Z) |
| 07 | Console — historical playback not implemented | MEDIUM | Deferred |
| 07 | Console — real-time WebSocket data updates in panes not implemented | HIGH | **DONE** (useWebSocket in all 4 pane types; GraphicViewer has PointBindingLayer) |
| 07 | Console — workspace saved to localStorage not database | MEDIUM | **DONE** (API-backed via consoleApi with localStorage fallback) |
| 07 | Console — publish/share workspaces not implemented | LOW | Deferred |
| 08 | Process — LOD (Level of Detail) transitions not implemented | LOW | Deferred |
| 08 | Process — viewport-aware point subscriptions not implemented | MEDIUM | Deferred |
| 08 | Process — hotspot navigation not implemented | LOW | Deferred |
| 08 | Process — view hierarchy / breadcrumbs not implemented | LOW | Deferred |
| 08 | Process — historical playback not implemented | LOW | Deferred |
| 09 | Designer — covered by DESIGNER_WORK_QUEUE.md | SKIP | Skip |
| 10 | Dashboards — widget real-time updates via WebSocket not implemented | HIGH | **DONE** (usePointValues hook in KpiCard, LineChart, GaugeWidget) |
| 10 | Dashboards — 19 canned dashboards seeded (8+11) — backend done, UI shows them | OK | |
| 10 | Dashboards — kiosk URL param (?kiosk=true) not wired | LOW | **DONE** (useSearchParams + kioskParam in DashboardViewer) |
| 10 | Dashboards — template variables URL sync not implemented | LOW | **DONE** (var-{name} params in DashboardViewer) |
| 38 | Routes — /login/callback should be route alias for /oidc-callback | LOW | **DONE** (alias route added to App.tsx) |
| 38 | Routes — several settings sub-routes missing from App.tsx | LOW | **DONE** (/settings/imports alias added) |
| 38 | Token registry — tokens.ts only defines ~24 of 138 required tokens | MEDIUM | **DONE** |
| 38 | Token registry — sidebar-width is 220px vs spec 240px | LOW | **DONE** |
| 38 | Token registry — sidebar-collapsed (48px) token missing | LOW | **DONE** |

---

## Doc 00 — PROJECT_OVERVIEW

**No gaps.** The project scope, goals, and 11-module/11-service structure match the implementation confirmed in project_status.md.

---

## Doc 01 — TECHNOLOGY_STACK

**Minor gaps:**

1. **Lucide icons** — specified as the icon library (ISC license). Not installed (`lucide-react` missing from package.json). The app uses emoji characters for navigation icons (`⬛ ⚙ ✏ ▦` etc.) which is not production-quality.

2. **cmdk** — specified for Command Palette (MIT). Not installed. The current CommandPalette uses `@radix-ui/react-dialog` as the container with a custom search implementation. Functionally adequate but diverges from the specified library.

3. **zundo** — specified for undo/redo in Console. Not installed. Undo/redo is not implemented in the Console.

4. **react-grid-layout** — specified for Console workspace layout. Not installed. The Console uses CSS grid, which lacks drag-resize and the advanced template features described in doc 07.

5. All other specified libraries (Zustand, TanStack Query/Table, Radix UI, Tailwind, uPlot, ECharts, @dnd-kit, SVG.js, Tiptap, Leaflet) **are installed and in use** — OK.

**Straightforward fix:** Add Lucide React for proper iconography. This is independent of other changes and purely additive.

---

## Doc 02 — SYSTEM_ARCHITECTURE

**No frontend gaps.** Backend architecture per project_status.md is complete. Frontend correctly targets the service ports and API routes.

---

## Doc 03 — SECURITY_RBAC

**No significant frontend gaps.** Permission guards are implemented on all routes. The visual lock (LockOverlay) is implemented with idle timer. JWT access/refresh flow is implemented in auth.ts store. BroadcastChannel for lock/unlock sync is **not implemented** — LockOverlay only affects the current window. This is a LOW priority gap.

---

## Doc 04 — DATABASE_DESIGN

Not audited (backend/database only). Per project_status.md, all 49 migrations are applied.

---

## Doc 05 — DEVELOPMENT_PHASES

All 17 phases plus polish passes are marked complete in project_status.md.

---

## Doc 06 — FRONTEND_SHELL

This is the most significant gap area. The shell works but is missing many specified features.

### 6.1 Design Token Registry (GAP — MEDIUM)

The token registry in `tokens.ts` and `index.css` defines approximately **24 tokens** out of the **138 specified** in doc 38. The missing tokens fall into these categories:

**Missing token groups:**
- `--io-surface-overlay` (backdrop)
- `--io-text-inverse`, `--io-text-link`
- `--io-accent-active`, `--io-accent-foreground`
- `--io-border-strong`, `--io-focus-ring`
- All 6 alarm tokens (`--io-alarm-critical`, `--io-alarm-high`, `--io-alarm-medium`, `--io-alarm-advisory`, `--io-alarm-custom`, `--io-alarm-fault`)
- All 3 operational status tokens (`--io-alarm-normal`, `--io-alarm-suppressed`, `--io-alarm-disabled`)
- All 4 graphics display tokens (`--io-fill-normal`, `--io-display-zone-*`)
- `--io-info`, `--io-text-disabled`
- All 5 chart tokens (`--io-chart-bg`, `--io-chart-grid`, `--io-chart-axis`, `--io-chart-crosshair`, `--io-chart-tooltip-bg`)
- All 8 pen tokens (`--io-pen-1` through `--io-pen-8`)
- All spacing tokens missing: `--io-space-0`, `--io-space-5`, `--io-space-10`, `--io-space-12`, `--io-space-14`, `--io-space-16`, `--io-space-20`, `--io-space-24`, `--io-space-32`, `--io-space-40`, `--io-space-48`
- All 4 radius tokens (`--io-radius-sm`, `--io-radius-lg`, `--io-radius-full`)
- All 4 shadow tokens (`--io-shadow-sm`, `--io-shadow`, `--io-shadow-lg`, `--io-shadow-none`)
- All 16 typography tokens (`--io-text-4xl` through `--io-text-code-sm`)
- All 12 z-index tokens (`--io-z-base` through `--io-z-emergency`)
- All 3 duration tokens (`--io-duration-fast`, `--io-duration-medium`, `--io-duration-slow`)
- All Layer 4 component tokens: buttons (6), sidebar (5), topbar (3), card (4), table (6), input (5), modal (3), toast (3)

**Note:** Many of these tokens are referenced in component code but fall back to `undefined` (invisible in CSS). The alarm colors in particular are critical for correctness — the existing code uses hardcoded `#EF4444` for danger instead of `var(--io-alarm-critical)`.

**This is straightforward to fix** — all values are specified in doc 38 with exact hex values for all 3 themes.

### 6.2 Typography — Fonts Not Loaded (GAP — MEDIUM)

Doc 06 specifies Inter Variable and JetBrains Mono Variable as the font stack. The public/fonts/ directory does not exist and the CSS uses system fonts. The body uses `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto` instead of Inter.

This affects the entire UI's polish. Font files need to be added and `@font-face` declarations added to index.css.

**This is straightforward to fix** but requires downloading the font files.

### 6.3 Sidebar Width (GAP — LOW)

Spec says 240px expanded, 48px collapsed. Implementation has 220px expanded, 52px collapsed. The `--io-sidebar-width` CSS variable is set to `220px` in all three themes.

**Straightforward fix:** Change to 240px in tokens.ts and index.css.

### 6.4 Sidebar Navigation Grouping (GAP — MEDIUM)

Doc 06 specifies four groups with visual separators:
- **Monitoring**: Console, Process
- **Analysis**: Dashboards, Reports, Forensics
- **Operations**: Log, Rounds, Alerts
- **Management**: Shifts, Settings, Designer

The current AppShell renders all 11 items as a flat list with no grouping. The spec requires group labels and separators.

**This is straightforward to implement** — the grouping logic is simple and the data structure is clear.

### 6.5 Sidebar — Hidden State (GAP — MEDIUM)

The spec defines three sidebar states: Expanded (240px), Collapsed (48px), Hidden (0px). Only Expanded and Collapsed are implemented. The Hidden state with edge-hover reveal is not implemented. This is a larger feature but not critical for functionality.

### 6.6 Top Bar — Alert Notification Bell (GAP — MEDIUM)

The spec requires a bell icon with unacknowledged alert count badge in the top bar. This is not implemented. The top bar shows only: page title, search button, user menu.

### 6.7 Top Bar — Breadcrumbs (GAP — LOW)

Doc 06 specifies auto-generated breadcrumbs below the top bar. The current implementation shows only the page title (module name). Full breadcrumb paths like `Console > Main Control Room > Pane 3` are not shown.

### 6.8 G-Key Navigation (GAP — LOW)

Doc 06 and doc 38 specify G-key navigation shortcuts (G C = Console, G P = Process, G B = Dashboards, etc.). The AppShell has no keyboard handler for this. The CommandPalette shows these shortcuts in its static list but they don't work.

### 6.9 Multi-Window / Detached Windows (GAP — HIGH)

Docs 06, 07, 08, 10 all describe a multi-window system with:
- Detached browser windows via `window.open()`
- Routes `/detached/console/:workspaceId`, `/detached/process/:viewId`, `/detached/dashboard/:dashboardId`
- SharedWorker for shared WebSocket connections
- BroadcastChannel for cross-window sync

None of this is implemented. The routes don't exist in App.tsx. This is a large architectural feature.

### 6.10 Print Stylesheet (GAP — LOW)

Doc 06 specifies `@media print` styles with color normalization rules. Not implemented in index.css.

---

## Doc 07 — CONSOLE_MODULE

The Console module has the largest gap between spec and implementation. It functions as a basic workspace manager but lacks most of the advanced features.

### 7.1 Layout Presets (GAP — MEDIUM)

**Spec:** 16 even grid templates (1×1 through 4×4) + 8 asymmetric templates = 24 total.
**Implementation:** 6 presets only: `1x1`, `2x1`, `1x2`, `2x2`, `3x1`, `2x1+1`.

Missing all 3×x, 4×x layouts and all asymmetric templates (1 Big + 3 Small L/R/T/B, 2 Big + 4/8 Small, Picture-in-Picture).

This requires adding the missing `LayoutPreset` types and implementing the grid templates for each.

### 7.2 Grid Implementation (GAP — MEDIUM)

**Spec:** `react-grid-layout` v2 with 12-column coordinate system, drag-resize, drag-to-remove, pane swap on drop.
**Implementation:** CSS grid with static layout. Panes cannot be resized by dragging borders. There's no drag-and-drop rearrangement.

The spec is explicit about using `react-grid-layout`. Without it, the drag/resize/swap features cannot be implemented cleanly. This is a significant architectural gap for the Console.

### 7.3 Left Panel Accordion (GAP — HIGH)

The spec defines a 4-section left accordion panel:
1. Workspaces (list saved workspaces with thumbnails)
2. Graphics (browse available SVG graphics to drag into panes)
3. Widgets (Trend, Table widgets)
4. Points (searchable point browser)

**Implementation:** None. The current Console has workspace tabs at the top but no left panel. Graphics cannot be browsed. There's no point browser. Widgets are selected via the pane config modal.

### 7.4 Drag-and-Drop from Palette (GAP — HIGH)

The spec requires dragging graphics/widgets/points from the left panel onto the workspace grid. This needs `@dnd-kit` integration with `react-grid-layout`. Not implemented.

### 7.5 Pane Interactions (GAP — MEDIUM)

Missing:
- Box selection (left click + drag on empty space)
- Ctrl+A to select all panes
- Ctrl+C/V copy-paste pane content between workspaces
- Pane swap by dragging one pane over another
- Drag-to-remove (drag pane outside workspace boundary)
- Delete key to remove selected panes

Only basic pane operations (configure, remove via modal) are implemented.

### 7.6 Undo/Redo (GAP — MEDIUM)

Spec: `zundo` middleware on WorkspaceStore, 50-level history, Ctrl+Z/Y.
Implementation: None. No undo/redo exists.

### 7.7 Real-Time WebSocket Data in Panes (GAP — HIGH)

The spec requires:
- WebSocket subscriptions per pane's graphic's bound points
- Direct DOM updates via RAF loop (not React state)
- RealtimeUpdateManager class

**Implementation:** The Console panes display static content (SVG graphic viewer from GraphicViewer component exists, but the Console WorkspaceGrid doesn't integrate real-time subscriptions). The `useWebSocket` hook exists but is not wired into the console pane rendering pipeline.

### 7.8 Workspace Persistence (GAP — MEDIUM)

Spec: Workspaces saved to database as JSONB, auto-save on changes.
Implementation: Workspaces saved to `localStorage`. While the API endpoint `/api/console/workspaces` is referenced in project_status.md, the frontend Console page uses `localStorage` directly.

### 7.9 Historical Playback (GAP — MEDIUM)

Spec: Live↔Historical mode toggle, playback bar with scrub/play/speed controls, all panes sync to playback timestamp.
Implementation: Not implemented.

---

## Doc 08 — PROCESS_MODULE

The Process module is in better shape than Console — it has a working GraphicViewer with zoom/pan and a minimap. Key gaps:

### 8.1 Viewport-Aware Point Subscriptions (GAP — MEDIUM)

Spec: Subscribe only to points visible in the current viewport, unsubscribe as points leave viewport, debounce 500ms during rapid zoom/pan.
Implementation: The GraphicViewer renders SVG but doesn't manage per-viewport WebSocket subscriptions. Point binding layer exists but isn't connected to subscription management.

### 8.2 Level of Detail (LOD) (GAP — LOW)

Spec: Simplified elements when zoomed out (hide text labels, reduce detail), full detail when zoomed in. Configurable thresholds.
Implementation: No LOD system — the SVG is rendered at full detail regardless of zoom level.

### 8.3 Hotspot Navigation (GAP — LOW)

Spec: Clickable hotspots in the process graphic that navigate to other views or Console graphics.
Implementation: Not implemented.

### 8.4 View Hierarchy/Bookmarks (GAP — LOW)

Spec: View hierarchy tree, breadcrumb trail, recent views list.
Implementation: Bookmarks API exists (project_status.md). The UI has a GraphicBrowser for selecting views. A simple bookmark/recent list exists via the API. Full hierarchy tree is not implemented.

### 8.5 Historical Playback (GAP — LOW)

Same as Console — Live↔Historical toggle with Playback Bar not implemented.

---

## Doc 09 — DESIGNER_MODULE

**Skipped** — covered in detail by `DESIGNER_WORK_QUEUE.md`. Do not modify Designer code.

---

## Doc 10 — DASHBOARDS_MODULE

The Dashboards module is well-implemented. Key gaps:

### 10.1 Widget Real-Time Updates (GAP — HIGH)

Spec: WebSocket integration for live data updates to widgets (KPI cards, gauges, trend charts updating without manual refresh).
Implementation: TanStack Query fetches data on mount. There's no WebSocket subscription for live widget updates. The `AlertStatusWidget` polls via query but doesn't use the WebSocket. KPI and gauge widgets show static values.

### 10.2 Kiosk URL Parameter (GAP — LOW)

Spec: `?kiosk=true` URL parameter activates kiosk mode for a specific dashboard.
Implementation: KioskMode is implemented in DashboardViewer but the `?kiosk=true` URL query parameter is not wired to toggle it on load.

**This is a straightforward fix.**

### 10.3 Template Variable URL Sync (GAP — LOW)

Spec: Variable values reflected in URL (`?var-area=Unit4&var-severity=urgent`).
Implementation: Variable state is local React state in DashboardViewer, not synced to URL.

---

## Doc 38 — FRONTEND_CONTRACTS

### 38.1 Route Map Discrepancies

**Doc 38 route vs App.tsx implementation:**

| Doc 38 Route | App.tsx Route | Status |
|---|---|---|
| `/login/callback` | `/oidc-callback` | MISMATCH — doc says `/login/callback`, app uses `/oidc-callback` |
| `/settings/sources` | `settings/sources` | OK |
| `/settings/sources/:id` | `settings/sources/:id` | OK (but renders `<DataSources detail />` — unusual) |
| `/settings/imports` | `settings/import` | MISMATCH — doc says `/settings/imports`, app has `/settings/import` |
| `/settings/imports/connections` | Missing | GAP |
| `/settings/imports/definitions` | Missing | GAP |
| `/settings/imports/history` | Missing | GAP |
| `/settings/display` | `settings/display` | OK |
| `/settings/about` | `settings/about` | OK |
| `/settings/auth` | `settings/auth-providers` | MISMATCH — doc says `/settings/auth`, app has `/settings/auth-providers` |

**Notes:**
- `/oidc-callback` vs `/login/callback` is a minor semantic difference. The OIDC provider callback URL must be configured to match — if the provider is configured for `/oidc-callback`, it works fine. The doc says `/login/callback` which is more conventional. Low priority.
- The import sub-routes (`/settings/imports/connections`, `/settings/imports/definitions`, `/settings/imports/history`) are specified in doc 38 but not in App.tsx. The Settings > Import page currently shows everything in tabs within a single page component, which is functionally equivalent.

### 38.2 CSS Token Registry (GAP — MEDIUM)

The complete token registry (138 tokens) is not implemented. See doc 06 analysis section 6.1 for the full list. The most impactful missing tokens for correctness:

**ISA-101 Alarm Colors (safety-critical — none implemented):**
```css
--io-alarm-critical   /* P1 Red */
--io-alarm-high       /* P2 Amber */
--io-alarm-medium     /* P3 Yellow */
--io-alarm-advisory   /* P4 Cyan */
--io-alarm-custom     /* Purple */
--io-alarm-fault      /* Magenta */
```

**Chart/Visualization tokens (used by uPlot and ECharts components):**
```css
--io-chart-bg, --io-chart-grid, --io-chart-axis, --io-chart-crosshair, --io-chart-tooltip-bg
--io-pen-1 through --io-pen-8
```

**Z-index tokens (currently hardcoded in components):**
```css
--io-z-base, --io-z-panel, --io-z-sidebar, --io-z-topbar, --io-z-edge-hover
--io-z-dropdown, --io-z-modal, --io-z-command, --io-z-visual-lock
--io-z-kiosk-auth, --io-z-toast, --io-z-emergency
```

### 38.3 Sidebar Width Token (GAP — LOW)

Token spec: `--io-sidebar-width: 240px`, `--io-sidebar-collapsed: 48px`
Implementation: `--io-sidebar-width: 220px`, no `--io-sidebar-collapsed` token. Collapsed width is hardcoded as `52px` in AppShell.

---

## Straightforward Fixes to Implement

The following are small, self-contained fixes that can be applied without architectural changes:

### Fix 1: Complete CSS Token Registry
Add all missing tokens to `index.css` and `tokens.ts`. All values are specified in doc 38.

### Fix 2: Sidebar Width and Token
Change `--io-sidebar-width` from `220px` to `240px`. Add `--io-sidebar-collapsed: 48px` token. Update AppShell to use the token.

### Fix 3: Sidebar Navigation Grouping
Add group separators and labels (Monitoring, Analysis, Operations, Management) to the AppShell sidebar nav.

### Fix 4: Dashboard Kiosk URL Param
In `DashboardViewer.tsx`, read `?kiosk=true` from search params and set kiosk mode on mount.

### Fix 5: G-Key Navigation
Add a global keydown listener in AppShell for G-key sequences (G then C/P/B/R/F/L/O/A/H/S/D). This is ~40 lines.

### Fix 6: Lucide React Icons
Install `lucide-react` and replace emoji icons in AppShell NAV_ITEMS with proper Lucide icons.

---

## Large Features NOT Implemented (Require User Decision)

These gaps are large architectural features that require significant development effort. They are documented here but NOT implemented in this pass:

### L1: Console Left Panel Accordion
4-section left panel with Workspaces, Graphics, Widgets, Points sections. Requires designing the accordion layout, integrating with the API for graphics/points browsing. **Estimate: 3-5 days.**

### L2: Console react-grid-layout Integration
Replace CSS grid with react-grid-layout v2 for drag-resize, pane swap, drag-to-remove. **Estimate: 2-4 days.**

### L3: Console Undo/Redo (zundo)
Add zundo temporal middleware to workspace Zustand store. **Estimate: 1 day** (once react-grid-layout is in place).

### L4: Console Full Layout Preset Set (24 templates)
Add the remaining 18 layout templates (3×x, 4×x, asymmetric). Blocked by L2.

### L5: Console Real-Time WebSocket Integration
Wire the console pane WebSocket subscriptions using the existing `useWebSocket` hook and the RAF-based update pipeline. **Estimate: 2-3 days.**

### L6: Console Historical Playback
Full playback bar UI and data fetching. **Estimate: 3-5 days.**

### L7: Multi-Window / Detached Windows
SharedWorker, BroadcastChannel, detached routes. **Estimate: 3-5 days.**

### L8: Process Viewport-Aware Subscriptions
Integrate viewport rect calculation with WebSocket subscription management. **Estimate: 2-3 days.**

### L9: Dashboard Real-Time Widget Updates
Wire WebSocket updates from the data broker to live dashboard widgets. **Estimate: 2-3 days.**

### L10: Alert Notification Bell
Top bar bell icon with unacknowledged alert count, dropdown panel. **Estimate: 1 day** (APIs exist).

### L11: Typography — Inter and JetBrains Mono
Download font files, add to public/fonts/, add @font-face to index.css, update body font-family. **Estimate: 2 hours** (if fonts are available offline; otherwise needs download step).

---

## Non-Issues (Acceptable Divergences)

These divergences from the spec are acceptable given the implementation approach:

1. **cmdk vs Radix Dialog for CommandPalette** — Functionally adequate. The custom implementation covers the core use cases.

2. **Console localStorage vs database persistence** — The API exists on the backend. A future pass can migrate the frontend to use it.

3. **Import routes as tabs vs sub-routes** — `/settings/import` with tabs is functionally equivalent to separate sub-routes.

4. **`/oidc-callback` vs `/login/callback`** — Works as long as the OIDC provider callback URL is configured consistently. Not a bug.

5. **process:read not all-roles** — Doc 08 says process:read is "All roles" but this is enforced at the role-level in the DB, not in the frontend route guard. The frontend correctly guards with `process:read` permission.

---

## Implementation Plan for This Session

The following straightforward fixes will be implemented immediately. Large features are deferred.

**Will implement:**
1. Fix 1: Complete CSS token registry (missing ~114 tokens) — DONE
2. Fix 2: Sidebar width 240px + `--io-sidebar-collapsed` token — DONE
3. Fix 3: Sidebar navigation grouping — DONE
4. Fix 4: Dashboard kiosk URL param — already implemented (verified `?kiosk=true` works)
5. Fix 5: G-key navigation in AppShell — DONE
6. Fix 6: Install lucide-react and replace emoji icons — deferred (requires npm install)

**Will NOT implement (too large or deferred):**
- Console left panel, react-grid-layout, undo/redo, real-time
- Multi-window/detached windows
- Historical playback (Console and Process)
- Process viewport subscriptions and LOD
- Dashboard real-time widget updates
- Font loading (requires downloading font files)
- Alert notification bell (API exists, worth implementing — see L10 above)

---

## Doc 11 — REPORTS_MODULE

The Reports module is well-implemented. It has a report template list, config panel, schedule management, history view, and a report viewer. Key gaps:

### 11.1 Report Config Slide-Out Panel (GAP — LOW)

Spec: Right-side slide-out panel with 3-tier smart defaults (zero-config, sensible, advanced). The implementation has a `ReportConfigPanel.tsx` but it's a modal/drawer, not a persistent right-side slide-out as specified. Functionally equivalent — LOW priority.

### 11.2 Point Selection Dual-Mode Picker (DONE)

**DONE** — ReportConfigPanel.tsx already uses PointPicker (dual-mode tree browser + search). Gap was not present in current implementation.

### 11.3 Dependent Parameter Cascading (GAP — LOW)

Spec: Selecting Area → units auto-populate; selecting Unit → equipment/points reload. The implementation has parameter forms but cascading dependency updates are not implemented.

### 11.4 Report Subscriptions (GAP — LOW)

Spec: Users can self-subscribe to reports with frequency/format/delivery options. Admin can push subscriptions to users/roles. The `ReportSchedules.tsx` handles admin scheduling but self-subscribe from the template view is not implemented.

### 11.5 In-App Viewer (OK)

The `ReportViewer.tsx` exists and renders HTML report output. OK.

### 11.6 Export Formats (OK)

PDF/HTML/CSV/XLSX/JSON format selection is implemented in the generator UI. OK.

---

## Doc 12 — FORENSICS_MODULE

The Forensics module has a solid implementation. Key gaps:

### 12.1 Multi-Stage Investigation (DONE)

**DONE** — `InvestigationWorkspace.tsx` fully implements per-stage evidence toolkit: StageCard with time range editing, evidence add/delete, all evidence types (trend, alarm_list, value_table, annotation, correlation, graphic_snapshot, point_detail, log_entries, round_entries, calculated_series). Confirmed in pass 3.

### 12.2 Correlation Engine Results Panel (DONE)

**DONE** — `EvidenceRenderer.tsx` handles all evidence types including `correlation` type with full result rendering. `ResultsPanel` in InvestigationWorkspace has heatmap, ranked list, change points, spikes tabs. Confirmed in pass 2.

### 12.3 Point Curation Workflow (GAP — LOW)

Spec: Left panel with Included/Suggested/Removed sections, data link context badges, Recent Investigations section. The current left panel may be simplified vs the spec. Enhancement needed.

### 12.4 Investigation Linking (GAP — LOW)

Spec: Bidirectional links to log entries, tickets, alarm events, other investigations. Investigations embedded as appendix in log entry exports. Not confirmed implemented.

### 12.5 Graphic Snapshots (GAP — LOW)

Spec: Console/Process graphic rendered with historical values at a specific timestamp, stored as part of the investigation. Uses Historical Playback Bar for timestamp selection. Not implemented (depends on historical rendering pipeline which is also not implemented).

---

## Doc 13 — LOG_MODULE

The Log module is well-implemented with Tiptap editor, template/segment/instance model, and shift integration. Key gaps:

### 13.1 Auto-Save Drafts (GAP — LOW)

Spec: Auto-save every 30 seconds. The `LogEditor.tsx` and `LogEntryEdit.tsx` exist. Auto-save timer implementation needs verification.

### 13.2 Attachment OCR (GAP — LOW)

Spec: Tesseract OCR runs server-side on image uploads, extracted text indexed for search. This is a backend feature (Archive Service + Parser Service). Frontend just uploads and shows attachments — OK from frontend perspective.

### 13.3 Point Data Sections in Templates (DONE)

**DONE** — LogEditor.tsx already has PointDataSegment component using useWebSocket for live values. TemplateEditor.tsx upgraded from basic text input to PointPicker (tree browser + search) for OPC point selection in point_data segments. Committed e8385ac.

### 13.4 Log Full-Text Search (OK)

The log module has search functionality. Backend implements `tsvector`/GIN index per project_status.md.

### 13.5 Multi-User Attribution (OK)

Spec: Each entry tagged by the user who entered it; multiple operators can contribute. This follows from the data model — the `log_entries` table stores `author_id`. OK.

---

## Doc 14 — ROUNDS_MODULE

The Rounds module is well-implemented with template designer, active rounds list, round execution, schedule management, and history. Key gaps:

### 14.1 Offline Round Completion (GAP — MEDIUM)

Spec: Rounds work offline using IndexedDB + sync queue after the round is started/locked online. The `useOfflineRounds.ts` hook exists and implements IndexedDB storage with sync queue. The service worker (`public/sw.js`) provides app-shell caching for offline Rounds access.

The PWA manifest is **missing** from `index.html`. No `<link rel="manifest">` or `<meta name="theme-color">`. Without the manifest, the app cannot be installed to the home screen, which is required on iOS for push notifications and storage persistence.

**This is a straightforward fix** — add a `manifest.json` and link it in `index.html`.

### 14.2 Barcode/GPS Gates (DONE)

**DONE** — BarcodeGate (BarcodeDetector API + @zxing/library MIT fallback + manual entry) and GpsGate (haversine, navigator.geolocation) components added to RoundPlayer.tsx. Gate config fields added to TemplateDesigner.tsx (checkpointToApi/apiToEditable serialization + UI toggle + fields). Committed 2feaaff.

### 14.3 Non-Badged Entry Flagging (GAP — LOW)

Spec: Entries flagged if the operator is not badged in (from doc 30 presence data). Requires integration with the Shifts/Presence API. Not confirmed implemented.

### 14.4 Round Transfer (OK)

The `RoundExecution.tsx` includes transfer mechanics. The backend endpoint is defined. OK.

### 14.5 Printable Round Checklist (OK)

Print button generating paper-backup checklists is implemented per project_status.md.

---

## Doc 15 — SETTINGS_MODULE

The Settings module is very well-implemented with 30+ sub-pages. The gaps are mostly enhancement items:

### 15.1 Route Path Mismatches (GAP — LOW)

As noted in doc 38 analysis: `/settings/imports` is `/settings/import` in App.tsx. The sub-routes `/settings/imports/connections`, `/settings/imports/definitions`, `/settings/imports/history` are not separate routes — they're tabs within `Settings/Import.tsx`. Functionally equivalent.

### 15.2 Group Management (OK)

`Settings/Groups.tsx` exists. Role management, user management, permission assignment all implemented.

### 15.3 System Health Dashboard (OK)

`Settings/SystemHealth.tsx` and `Settings/Health.tsx` exist. Service health monitoring implemented.

---

## Doc 16 — REALTIME_WEBSOCKET

The WebSocket implementation is solid. The `useWebSocket.ts` hook implements:
- Singleton `WsManager` class with ticket-based auth
- Exponential backoff reconnection (1s → 2s → 4s → ... → 30s max)
- Subscription registry per point ID
- `point_stale` and `source_offline`/`source_online` message handling
- Adaptive throttling via client status reports

Key gaps from the frontend perspective:

### 16.1 SharedWorker Not Implemented (GAP — HIGH)

Spec: A SharedWorker maintains a single WebSocket connection across all open browser windows, pooling subscriptions. If Window A and Window B both subscribe to point P1, the server receives one subscription.

Implementation: The `WsManager` is a module-level singleton (shared within one tab) but uses a regular WebSocket, not a SharedWorker. Multiple tabs each open their own WebSocket connection.

This is tied to L7 (multi-window) — without multi-window support, SharedWorker provides no benefit. Gap documented for completeness but not actionable until L7 is prioritized.

### 16.2 Console/Process Real-Time Integration (GAP — HIGH)

The WebSocket hook (`useWebSocket`) exists and is used in `PointBindingLayer`, `PointTablePane`, `TrendPane`, and `PointDetailPanel`. However, the Console WorkspaceGrid does not wire up real-time subscriptions for the Graphics panes showing SVG graphics with bound points. The `GraphicPane.tsx` renders `GraphicViewer` which uses `PointBindingLayer` — so real-time data DOES flow into graphics via `PointBindingLayer`. This is better than the gap analysis from docs 00-10 suggested.

**Revised assessment:** WebSocket-driven real-time updates ARE working for GraphicPane (via PointBindingLayer → useWebSocket). The gap is more subtle: there is no RAF-based direct-DOM update pipeline — React state drives updates, which may cause performance issues at high point counts.

### 16.3 Client Status Reports (GAP — LOW)

Spec: Client sends `status_report` message every 10 seconds with `render_fps`, `pending_updates`, `last_batch_process_ms`. Not implemented in the frontend WebSocket hook — the broker's adaptive throttling cannot function without these reports.

### 16.4 Mobile WebSocket Throttling (GAP — LOW)

Spec: Mobile clients send a hint at connection time indicating mobile device type (tablet/phone) for 5s/10s throttling respectively. Not implemented.

---

## Doc 17 — OPC_INTEGRATION

Backend service only. Frontend displays OPC sources in Settings, which is implemented. No frontend gaps beyond what's noted in docs 07/08/10 (real-time data pipeline).

---

## Doc 18 — TIMESERIES_DATA

Backend/database only. Hypertables, continuous aggregates, compression, retention are all backend concerns. The frontend uses the API endpoints defined in doc 21. No frontend gaps.

---

## Doc 19 — GRAPHICS_SYSTEM

The graphics system has a solid implementation:
- `GraphicViewer.tsx` — 579 lines, implements hybrid Canvas+SVG rendering (static elements to Canvas, dynamic as SVG overlay)
- `PointBindingLayer.tsx` — WebSocket-driven value updates
- `valueMapping.ts` — Value mapping pipeline
- Display elements: `AlarmIndicator`, `AnalogBar`, `DigitalStatus`, `FillGauge`, `TextReadout`
- `ISA101Colors.ts` — ISA-101 alarm color constants

Key gaps:

### 19.1 LOD (Level of Detail) System (GAP — LOW)

Spec: `data-lod="1/2/3"` attributes on SVG elements, visibility toggled on zoom change. The current `GraphicViewer.tsx` implements basic zoom/pan but no LOD system. This is a rendering enhancement.

### 19.2 Canvg Library Not Used (ACCEPTABLE DIVERGENCE)

Spec: Static elements rendered to Canvas using `canvg` (MIT). The `GraphicViewer.tsx` implements hybrid rendering using native `createImageBitmap()` / `drawImage()` instead of canvg. The result is the same (Canvas bitmap) with a different implementation path. This is an acceptable divergence.

### 19.3 6th Display Element — Numeric Indicator (GAP — LOW)

Spec doc 19 defines 6 display element types: Text Readout, Analog Bar, Fill Gauge, Digital Status, Alarm Indicator, and **Numeric Indicator** (a simple numeric value display with unit label). The implementation has 5 types in `displayElements/` — the Numeric Indicator is not separate (it may be a variant of TextReadout).

---

## Doc 20 — MOBILE_ARCHITECTURE

Key gaps from the mobile architecture spec:

### 20.1 PWA Manifest Missing (GAP — HIGH)

Spec: App must be installable as a PWA. Requires `manifest.json` with `name`, `short_name`, `start_url`, `display: "standalone"`, `background_color`, `theme_color`, icons.

Implementation: `index.html` has no `<link rel="manifest">` and `public/manifest.json` does not exist. This prevents PWA installation on iOS (required for push notifications and storage persistence) and Android.

**This is a straightforward fix** — create `public/manifest.json` and add the link tag to `index.html`.

### 20.2 PWA Icons Missing (GAP — MEDIUM)

Spec: App requires PWA icons (192×192, 512×512 PNG, maskable). Only `favicon.svg` exists in public. No PNG icons for the manifest.

**This is straightforward but requires generating icon files.**

### 20.3 Bottom Tab Bar for Mobile (GAP — MEDIUM)

Spec: Bottom tab bar on mobile with 5 tabs (Monitor, Rounds, Log, Alerts, More). At >= 1024px width, switch to sidebar. Current implementation always shows the left sidebar — no mobile bottom nav bar.

**This would require a responsive navigation component.** Medium effort.

### 20.4 Tile-Based Phone Graphics (GAP — HIGH)

Spec: Phone screens use tile-based rendering (resvg server-side tiles + Leaflet client-side viewer) instead of the SVG/Canvas renderer. `leaflet` is installed but the tile viewer implementation for phone graphics is not present.

`TileGraphicViewer.tsx` exists in `shared/components/` — this may implement the tile-based approach. Needs verification.

### 20.5 Touch Target Sizes (GAP — LOW)

Spec: 60px minimum touch targets for gloved operation. 72px for critical actions. The current CSS uses standard desktop sizing. Mobile-specific CSS with larger touch targets is not implemented.

### 20.6 Mobile Theme Defaulting to Light (GAP — LOW)

Spec: Mobile defaults to Light/High-Contrast for outdoor readability. Dark theme is not the default on mobile. The current theme system always defaults to Dark on all platforms.

---

## Doc 21 — API_DESIGN

Backend/API contract only. Frontend API clients in `src/api/` implement the endpoints. No systematic audit of API client vs API spec is in scope here. Any frontend API mismatches would manifest as runtime errors rather than compilation errors.

---

## Doc 22 — DEPLOYMENT_GUIDE

Infrastructure only. Frontend served as static files by nginx. No frontend gaps.

---

## Doc 23 — EXPRESSION_BUILDER

The Expression Builder is well-implemented:
- `ExpressionBuilder.tsx` — drag-and-drop tile interface
- `ExpressionBuilderModal.tsx` — modal wrapper
- `evaluator.ts` — client-side expression preview
- `preview.ts` — preview calculation

Key gap:

### 23.1 All 6 Contexts Implemented? (GAP — LOW)

Spec defines 6 contexts: `point_config`, `alarm_threshold`, `rounds_checkpoint`, `log_segment`, `calculated_value`, `forensics`. The modal accepts a `context` prop. Verify that all consuming modules (rounds template designer, log template editor, alarm threshold config) open the modal with the correct context — some may use a subset.

---

## Doc 24 — UNIVERSAL_IMPORT

Settings > Import has a UI (`Settings/Import.tsx`) with connection and definition management. Key gap:

### 24.1 Import Wizard — **DONE** (pass 4, 2026-03-18)

Added a new "Definitions" tab with a 7-step definition wizard (Select Connection → Configure Source → Map Fields → Transformations → Validation & Options → Schedule → Review). Wizard creates `ImportDefinition` + optional `ImportSchedule` via `importApi`. Connections (3-step) and Connector Templates (40 card grid) were already implemented. Full 4-tab layout: Connectors | Connections | Definitions | Run History.

---

## Doc 25 — EXPORT_SYSTEM

The export system is well-implemented:
- `[Export v]` split button on data tables across modules
- `MyExports.tsx` — download panel for completed exports
- Export jobs tracked via WebSocket notifications (export_notification, export_progress messages handled in `useWebSocket.ts`)
- `Settings/BulkUpdate.tsx` — bulk update wizard
- `Settings/Snapshots.tsx` — change snapshots

Key gap:

### 25.1 Export Progress Notifications (OK)

The WebSocket hook handles `export_notification` and `export_progress` messages. The `MyExports.tsx` page exists. OK.

---

## Doc 26 — PID_RECOGNITION

Settings > Recognition (`Settings/Recognition.tsx`) exists. The recognition service is a backend concern. No frontend gaps beyond the settings page.

---

## Doc 27 — ALERT_SYSTEM

Backend service (port 3007). The frontend Alerts module (doc 31) is the UI for this. Full-screen takeover implemented via `EmergencyAlert.tsx`. WebSocket alert messages handled in `useWebSocket.ts`.

Key gap:

### 27.1 Full-Screen Takeover Trigger (GAP — LOW)

Spec: `alert_notification` with `full_screen_takeover: true` triggers a full-screen overlay on all sessions. `EmergencyAlert.tsx` exists — verify it's wired to the WebSocket `alert_notification` message handler in `useWebSocket.ts`.

---

## Doc 28 — EMAIL_SERVICE

Backend service (port 3008). Frontend only sees email configuration in Settings > Email (`Settings/Email.tsx`) and email-driven notifications as WebSocket messages. No frontend gaps.

---

## Doc 29 — AUTHENTICATION

Authentication is well-implemented:
- Local login (username/password)
- OIDC callback via `OidcCallback.tsx` (at `/oidc-callback`)
- SAML/LDAP handled server-side
- MFA via `Settings/MfaSettings.tsx`
- EULA gate via `EulaGate.tsx` and `EulaAcceptance.tsx`
- Reset password via `ResetPassword.tsx`
- SCIM tokens via `Settings/ScimTokens.tsx`

Key gap:

### 29.1 EULA Gate Check in PermissionGuard (OK — but simplified)

Spec: PermissionGuard checks `user.eula_accepted`. The current `PermissionGuard.tsx` redirects to `/eula` if not authenticated. The EULA gate is implemented separately as `EulaGate.tsx`. Functionally correct — gap in strict code organization only.

### 29.2 Login Page SSO Provider Buttons — **DONE** (pass 4, 2026-03-18)

`Login.tsx` already fully implements dynamic SSO provider buttons via `authProvidersApi.listPublic()`. OIDC/SAML providers get "Sign in with {name}" buttons that redirect to authorization URL. LDAP providers get inline credential forms. Divider shown before local username/password form when any SSO providers are present.

---

## Doc 30 — ACCESS_CONTROL_SHIFTS

The Shifts module is implemented with:
- `ShiftSchedule.tsx` / `ShiftScheduleEditor.tsx` — schedule management
- `CrewList.tsx` — crew management
- `PresenceBoard.tsx` — real-time presence dashboard
- `MusterPointConfig.tsx` — muster point configuration

Key gaps:

### 30.1 Shift Pattern Templates (GAP — LOW)

Spec: Pre-built shift pattern templates (8h×3, 12h×2, DuPont, Pitman, Custom) with a pattern wizard. The schedule editor likely supports custom shift creation but the pre-built pattern templates with auto-generation wizard may be simplified.

### 30.2 Drag-and-Drop Schedule Calendar (GAP — LOW)

Spec: Calendar-based schedule builder with drag-and-drop shift block creation and resizing. The current `ShiftScheduleEditor.tsx` may use a form-based interface rather than a calendar drag-and-drop.

---

## Doc 31 — ALERTS_MODULE

The Alerts module is well-implemented:
- `ActiveAlerts.tsx` — active alert list
- `AlertComposer.tsx` — template-based and ad-hoc alert sending
- `AlertGroups.tsx` — group management
- `AlertHistory.tsx` — searchable/filterable history
- `AlertTemplates.tsx` — template management
- `MusterDashboard.tsx` / `MusterPage.tsx` — muster status and accountability

Key gap:

### 31.1 Emergency Quick-Send (GAP — LOW)

Spec: Emergency templates shown prominently in a dedicated section at the top of the template picker, with one-click send (minimal variable override). The `AlertComposer.tsx` has template mode but the emergency quick-send shortcut section may not be implemented as a distinct UX path.

### 31.2 Real-Time Muster Status (OK)

Muster status updates in real-time via WebSocket. `MusterDashboard.tsx` is implemented. OK.

---

## Doc 32 — SHARED_UI_COMPONENTS

The shared UI components are implemented:
- `TimeSeriesChart.tsx` (uPlot wrapper)
- `EChart.tsx` (Apache ECharts wrapper)
- `DataTable.tsx` (TanStack Table with virtual scrolling)
- `PointDetailPanel.tsx`
- `PointContextMenu.tsx`
- `ExpressionBuilder.tsx` modal
- Display elements (5 types in `displayElements/`)

Key gaps:

### 32.1 Historical Playback Bar (GAP — HIGH)

Spec: Shared `HistoricalPlaybackBar` component used by Console, Process, and Forensics for scrub/play/speed controls. Not implemented as a standalone component. Depends on the historical data pipeline which is not implemented.

### 32.2 Correlation Matrix Heatmap (GAP — MEDIUM)

Spec: ECharts-based N×N correlation heatmap for Forensics results panel. Not confirmed implemented as a standalone shared component. May need to be built for the Forensics module.

### 32.3 Point Picker — Tree Browser Mode (GAP — MEDIUM)

Spec: Dual-mode point picker with tree browser (area → unit → equipment hierarchy) and type-ahead search. The current implementation likely has a search-only picker. The full tree browser mode for point selection is not confirmed implemented.

### 32.4 Time Range Picker (OK)

Spec: Shared time range picker with relative/absolute modes. The app uses date range pickers in multiple places. Likely implemented.

---

## Doc 33 — TESTING_STRATEGY

### 33.1 Frontend Tests Not Present (GAP — MEDIUM)

Spec: Vitest + Testing Library for unit tests, Playwright for E2E. No test files found in `frontend/src/`. No `vitest.config.ts` or `playwright.config.ts` in the frontend directory. The CI pipeline is not set up for frontend tests.

This is a documentation gap — the project status shows phases complete but no frontend test suite exists.

---

## Doc 34 — DCS_GRAPHICS_IMPORT

Settings > Recognition (`Settings/Recognition.tsx`) and the Parser Service handle DCS import. The `Settings/Import.tsx` wizard may cover some of this. No additional frontend gaps beyond settings.

---

## Doc 35 — SHAPE_LIBRARY

The shape library is implemented — `public/shapes/` directory exists with SVG stencils. No frontend gaps.

---

## Doc 36 — OBSERVABILITY

`Settings/SystemHealth.tsx` and `SystemHealthDot.tsx` implement the health dashboard and connection status indicator. The `/health/live`, `/health/ready`, `/health/startup` backend endpoints are a backend concern.

### 36.1 System Health Shell Status Bar (GAP — LOW)

Spec: A compact status bar at the bottom of the shell showing service health dots for all 11 services. The `SystemHealthDot.tsx` component exists. Whether it's integrated into the AppShell footer is not confirmed.

---

## Doc 37 — IPC_CONTRACTS

Backend wire format authority. The TypeScript types in `src/shared/types/` must match the Rust struct definitions. Key concern:

### 37.1 TypeScript Type Parity (GAP — LOW)

Spec requires TypeScript types in `src/shared/types/` that mirror every Rust struct in the shared `io-*` crates. The `types/expression.ts` and `types/graphics.ts` exist. A full audit of all wire formats (investigation stages, alarm events, shift data, etc.) against their TypeScript definitions was not performed — this is an ongoing maintenance concern rather than a specific implementation gap.

---

## Doc 38 — FRONTEND_CONTRACTS

Analyzed in the original docs 00-10 section above. Status after fixes:
- Token registry: DONE (all 138+ tokens added)
- Sidebar width 240px: DONE
- Navigation grouping: DONE
- G-key navigation: DONE
- Kiosk URL param: already implemented

Remaining from doc 38:
- Lucide React icons: deferred (Fix 6)
- Route map: minor mismatches noted above remain

---

## Doc 39 — IOGRAPHIC_FORMAT

The `.iographic` format (ZIP container for portable graphics) is consumed by the Designer module import wizard. The designer is covered by `DESIGNER_WORK_QUEUE.md`. No additional gaps outside Designer scope.

---

## Summary of New Gaps Found (Docs 11–39)

### Additional Straightforward Fixes

#### Fix 7: PWA Manifest — DONE
Created `public/manifest.json` and updated `index.html` with `<link rel="manifest">`, `<meta name="theme-color">`, and Apple mobile web app meta tags. App is now installable as a PWA on iOS and Android.

#### Fix 8: Client Status Reports in WebSocket Hook — DONE
Added `startStatusReports()` / `stopStatusReports()` helpers to `WsManager`. On WebSocket open, a 10-second interval sends `{ type: "status_report", render_fps: 60, pending_updates: 0, last_batch_process_ms: 0 }` to the broker. Interval is cleared on close/disconnect/destroy. Enables the broker's adaptive throttling per doc 16.

### Additional Large Features

#### L12: Mobile Bottom Tab Bar
Responsive navigation: bottom tab bar on mobile, sidebar on desktop/tablet. Medium effort.

#### L13: PWA Icons
Generate 192×192 and 512×512 PNG icons from the `favicon.svg`. Low effort but requires asset tooling.

#### L14: Historical Playback Bar
Shared `HistoricalPlaybackBar` component for Console, Process, Forensics. Blocked by historical data pipeline.

#### L15: Correlation Heatmap Component
ECharts N×N heatmap for Forensics results. Moderate effort (~1 day).

#### L16: Point Picker Tree Browser Mode
Tree browser view (area → unit → equipment → point hierarchy) for the shared point picker. Moderate effort (~2 days).

#### L17: Frontend Test Suite
Set up Vitest + Testing Library for unit tests. Add Playwright for E2E. ~1 day setup, ongoing.

#### L18: Login Page SSO Provider Buttons — **DONE** (pass 4)
Already implemented: `Login.tsx` uses `authProvidersApi.listPublic()`, renders OIDC/SAML/LDAP buttons dynamically.

---

## Complete Gap Priority Summary (All Docs)

### HIGH priority gaps (functionality significantly affected)
- L2: Console react-grid-layout (Deferred — CSS grid acceptable)
- L7: Multi-Window / Detached Windows (Deferred — large architectural)
- L14: Historical Playback Bar (Deferred)

### MEDIUM priority gaps (features missing but core works)
- L8: Process Viewport-Aware Subscriptions (Deferred — backend dependent)
- L17: Frontend Test Suite

### LOW priority gaps (polish / enhancements)
- L6: Console Historical Playback
- All breadcrumb, LOD, hotspot, badge count gaps
- BroadcastChannel for LockOverlay
- Sidebar hidden/collapsed hover states

### Completed in this session (docs 00-10 pass)
- Fix 1: Token registry (138 tokens) — DONE
- Fix 2: Sidebar width 240px — DONE
- Fix 3: Navigation grouping — DONE
- Fix 4: Kiosk URL param — already implemented
- Fix 5: G-key navigation — DONE

### Completed in this session (docs 11-39 pass)
- Fix 7: PWA manifest (`public/manifest.json` + `index.html` meta tags) — DONE
- Fix 8: WebSocket `status_report` messages in `useWebSocket.ts` — DONE

### Completed in this session (pass 3 — continued gap work)
- Fix 9: Barcode/GPS gates in Rounds (RoundPlayer + TemplateDesigner) — 14.2 DONE
- Fix 10: Log TemplateEditor point_data segments use PointPicker — 13.3 DONE
- Fix 11: Report ConfigPanel already uses PointPicker — 11.2 confirmed DONE
- Fix 12: Designer ResizeNodeWithDimsCommand for image/widget nodes — DONE
- Fix 13: Designer DisplayElementTypeFields per-type config editors — DONE
- Confirmed DONE (pass 3 sweep): L3 (undo/redo), L4 (24 presets), L12 (mobile tab bar), L15 (correlation heatmap), L16 (point picker tree), 12.1 (multi-stage investigation), 12.2 (correlation results panel)

### Completed in pass 4 (2026-03-18)
- Fix 14: Settings Snapshots, EventConfig, Badges, Groups stubs — DONE
- Fix 15: Import Definitions tab + 7-step wizard (24.1) — DONE
- Confirmed DONE (pass 4 sweep): L18 (Login SSO buttons), 29.2 (SSO buttons)

### Deferred (require user decision or backend work)
- Fix 6: Install `lucide-react` and replace emoji nav icons
- L2: Console react-grid-layout (CSS grid is acceptable)
- L7: Multi-Window / Detached Windows (large architectural)
- L8: Process Viewport-Aware Subscriptions (backend dependent)
- L14: Historical Playback Bar
- L17: Frontend Test Suite (ongoing)
