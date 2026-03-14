# Inside/Operations - Mobile Architecture

## Overview

PWA-first mobile strategy for field operations, supervisory monitoring, and alert management. React Native fallback is unnecessary — research confirms PWA handles all required capabilities including camera, GPS, offline storage, and push notifications (iOS 16.4+).

**Primary device:** 10" tablet (ruggedized, e.g., Zebra ET85). Gloved operation in field conditions.
**Secondary device:** Phone (limited modules — Rounds, Log, Alerts only with full functionality).
**Connectivity-resilient:** Rounds works offline after the round is started/locked online. Log is online-only. Graphics viewable offline with cached last-known values. All other modules require connectivity.

## Platform Support

### Chrome Android
- Full support for all PWA capabilities
- BarcodeDetector API available natively
- Background Sync API supported (sync queue drains automatically)
- Push notifications fully supported
- SharedWorker supported

### Safari iOS
- Full support for all core capabilities (camera, GPS, offline, push)
- Push notifications require Home Screen installation (iOS 16.4+)
- **BarcodeDetector API not supported** — use zxing-js/library (Apache 2.0) as fallback
- **Background Sync API not supported** — sync triggers on foreground resume via Page Visibility API + online event listener
- SharedWorker supported (iOS Safari 2024+)
- Home Screen installation required to:
  - Enable push notifications
  - Eliminate 7-day script-writable storage eviction
  - Provide standalone app mode (no Safari chrome)
- IndexedDB: ~500MB limit, generous for hundreds of photos offline
- Cache API: ~50MB limit — pre-cache budget must stay under this

### Zebra DataWedge (Android Industrial Tablets)
- Barcode data injected as keyboard input — no library needed
- Configure DataWedge profile per I/O PWA
- Works seamlessly with any web input field

## Module Availability on Mobile

| Module | Phone | Tablet | Functionality |
|--------|-------|--------|---------------|
| Rounds | Full | Full | Pick/start/complete rounds. PRIMARY mobile use case. |
| Log | Entry only | Entry + view | Fill out shift log templates, view previous entries |
| Alerts | Full | Full | Send from templates, view active/history, muster status |
| Shifts | View | View + basic mgmt | Who's on shift, roster info |
| Console | Tile view + Status view | View (4 panes) | Phone: tile-based pre-rendered graphics with value overlays + simplified status view. Tablet: live SVG/Canvas as current. |
| Process | Tile view + Status view | View | Phone: tile-based pre-rendered graphics with value overlays + simplified status view. Tablet: single graphic with pinch-zoom/pan. |
| Dashboards | Phone layout | View | Phone: auto-generated or manually configured single-column layout. Tablet: full desktop layout. |
| Reports | Trigger only | Trigger + view | Kick off generation, view PDF/HTML |
| Designer | — | — | Not on mobile |
| Forensics | — | — | Not on mobile |
| Settings | — | — | Not on mobile |

Modules not available on a given device form factor are never loaded — code splitting ensures Designer, Forensics, and Settings bundles are excluded from the mobile build entirely.

## Navigation

Bottom tab bar with 5 tabs. Hamburger menu avoided — bottom tabs are faster with gloved hands and one-handed operation.

```
Bottom Tab Bar:
  [Monitor]  [Rounds]  [Log]  [Alerts]  [More]
     │          │        │       │         │
     │          │        │       │         └── Shifts, Reports, Dashboards (tablet), Settings link
     │          │        │       └── Send from template, Active alerts, History, Muster status
     │          │        └── New entry, Previous logs
     │          └── My rounds, Start round, History
     └── Console (pane view), Process (graphic view)
```

**Monitor tab** combines Console, Process, and Dashboards — the user picks which view within the tab. On phone, Monitor tab shows tile-based graphics (Console/Process) and phone-optimized dashboards.

**More tab** opens a list of secondary modules. This hybrid approach (tab bar + overflow) is the standard pattern for >5 top-level destinations.

**Tablet landscape exception:** At >= 1024px width, switch from bottom tab bar to a collapsible sidebar (same as desktop but narrower). Bottom tab bar is primarily for portrait and phone use.

## Touch Interaction

### Targets
- **60px minimum** touch targets for all interactive elements (gloved operation)
- **72px** for critical/emergency actions
- **Expand hit zones 20px** beyond visual boundary — a 30px valve icon has a 60px+ tappable area
- **16px minimum spacing** between adjacent targets

### Drag and Gesture Thresholds
- **15-20px drag threshold** before treating a touch as a drag (not 10px — glove accommodation)
- **300ms debounce** on single-tap actions (gloved touches often register as double-tap)
- **500ms** long-press threshold for context menus

### Gesture Mapping

| Gesture | Action | Notes |
|---------|--------|-------|
| Tap | Select / open detail popup | Equipment faceplate: current values, status, alarm state, trend preview |
| Long-press | Point Context Menu | Same shared menu as desktop right-click: Point Detail, Trend Point, Investigate Point, Report on Point. See doc 32. |
| Pinch | Zoom graphic | Map-style zoom centered between fingers, momentum-based |
| Pan (one finger in empty space) | Scroll/pan viewport | Must be snappy — no lag |
| Pan (two fingers) | Pan viewport | Alternative pan method |
| Double-tap | Zoom to fit / toggle detail level | On equipment: quick-navigate to detail view |
| Edge swipe (left) | Navigate back | Standard back gesture |

### Accidental Touch Prevention
- 8-12px dead zones at screen edges
- No floating action buttons near screen edges
- Lock orientation in graphics view (switching while viewing a process graphic is disorienting)
- Confirm before any consequential action (alarm acknowledgment, round submission)
- Avoid swipe-to-delete or swipe-to-action on lists (too easy to trigger accidentally with gloves)

## Graphics on Mobile

### Rendering Thresholds

Canvas auto-switch thresholds are lower on mobile than desktop (3,000 elements):

| Device | Auto-Switch Threshold | Rationale |
|--------|----------------------|-----------|
| Tablet | 1,500 dynamic elements | iOS Safari SVG degrades above ~1,000 elements; buffer for animation |
| Phone | 800 dynamic elements | Lower GPU/memory headroom |

The hybrid renderer (static elements on Canvas bitmap via canvg, dynamic elements as SVG overlay) applies on mobile exactly as on desktop — just with a lower threshold.

### Pinch-Zoom

Use `react-zoom-pan-pinch` (MIT, ~15 KB) — wraps the shared container div holding both Canvas and SVG layers. CSS transforms on the container keep both layers in perfect sync without re-rendering.

```
Container (CSS transform: matrix())
  ├── Canvas (static bitmap layer)
  └── SVG (dynamic overlay layer)
```

Configure:
- `minScale`: 0.5x (zoomed out to half)
- `maxScale`: 5x (zoomed in 5x for detail inspection)
- Velocity/momentum animation enabled for natural feel

### Level of Detail (LOD)

3-level LOD system — elements show/hide based on zoom level:

| Level | Zoom | What's Visible |
|-------|------|----------------|
| Overview | < 0.5x | Equipment shapes, major pipes, color-coded status only. No labels, no minor instruments. |
| Area | 0.5x - 1.5x | Equipment labels, key process values, alarm indicators. Minor tags hidden. |
| Detail | > 1.5x | All elements, all labels, all data values. Equivalent to desktop view. |

Implementation: Each SVG element carries a `data-lod` attribute (1, 2, or 3). On zoom change, toggle visibility. For Canvas rendering, maintain separate draw lists per LOD level.

### Console on Tablet

4 panes with orientation-aware layout:

- **Portrait (768 x 1024):** 1x4 vertical stack — each pane ~768px wide x ~230px tall. Tight but usable for monitoring.
- **Landscape (1024 x 768):** 2x2 grid — each pane ~500px wide x ~350px tall. Better aspect ratio for typical process graphics.

Tap any pane to expand it full-screen for detailed viewing. Double-tap to return to multi-pane view.

### Minimap

Graphics viewed on mobile include a minimap/overview indicator — small thumbnail in the corner showing the full graphic with a highlighted viewport rectangle. Essential for spatial context when zoomed in.

## Phone Graphics (Tile-Based Rendering)

Phone screens cannot run the desktop hybrid SVG/Canvas renderer for dense process graphics. Instead, phones use a tile-based approach with live value overlays — the same interaction model as Google Maps.

### Tile Pyramid Generation

Server-side tile generation using `resvg` (MPL-2.0, Rust-native SVG renderer). When a Console or Process graphic is saved or published in the Designer, a background job pre-renders the graphic into a tile pyramid at multiple zoom levels.

- **Tile format**: Standard 256x256 PNG images
- **Zoom levels**: 0 (single overview tile) through 4-5 (full detail), depending on graphic dimensions
- **Storage estimate**: A 4000x3000 graphic at 5 zoom levels produces ~585 tiles, ~17 MB (PNG) or ~8 MB (WebP) per graphic
- **Regeneration trigger**: Tiles regenerated when the graphic's structural elements change (edited in Designer). Value changes do NOT trigger regeneration — dynamic values are always overlaid, never baked into tiles.
- **No real-time rendering**: Tile generation is a background job, not a request-time operation. The cost is paid once per graphic version.

### Tile Viewer

Leaflet (BSD-2-Clause) on the client — a proven, lightweight tile viewer with smooth pinch-zoom, momentum scrolling, and built-in tile loading/caching/viewport management. Leaflet handles thousands of tiles smoothly on low-end phones.

- **Pinch-zoom**: Smooth zoom between pre-rendered zoom levels (no blurry raster between re-renders, unlike a single-image approach)
- **Pan**: One-finger pan with momentum. Standard map interaction.
- **Tap**: Tap equipment for faceplate popup (current value, alarm state, trend sparkline, last update time)
- **UX**: The Google Maps interaction model is universally understood — no learning curve

### Dynamic Value Overlay

Live point values and alarm states rendered as lightweight positioned markers/popups on top of the tile layer. Markers positioned using coordinates from the SVG element bindings (the `bindings` JSONB already stores element positions).

- **Update frequency**: WebSocket with mobile throttling — 5-10 second batches (per the WebSocket throttling spec above)
- **Viewport-limited**: Only markers within the visible viewport are rendered. Off-screen markers are not created in the DOM.
- **Alarm indicators**: Color-coded markers per ISA-18.2 (red=alarm, yellow=warning, green=normal, gray=offline/stale)

### Status View Toggle

A simplified schematic mode — equipment shown as colored dots/icons on a single non-scrolling screen. Purpose: quick alarm-at-a-glance check without loading the full tile graphic.

- **Layout**: Equipment positions derived from SVG bounding box centers. Single screen, no zoom needed.
- **Color coding**: Green=normal, red=alarm, yellow=warning, gray=offline. Both color AND shape/icon for accessibility (consistent with the mobile theme spec).
- **Tap interaction**: Tap any dot/icon for a detail popup with current value, alarm state, trend sparkline, and last update time.
- **Data footprint**: Tiny — just a list of equipment IDs, positions, current values, and alarm states. Works well on poor connections.
- **Use case**: Field operator doing a quick check: "Is anything in alarm on Unit 3?" — answered in under 2 seconds without loading a full graphic.

### Offline Support

Tile pyramids are cacheable in IndexedDB for offline graphic viewing:

- **Adaptive caching**: Cache tile sets for the 10 most recently viewed graphics using LRU eviction. Detect available storage via `navigator.storage.estimate()`, budget 70% of available quota or 10 graphics, whichever limit hits first. At ~8-15 MB per graphic in WebP, this requires IndexedDB storage (not Cache API, which has a 50MB limit on iOS).
- **Value overlays**: Last-known values cached in IndexedDB (`point-cache` store). Stale indicator shown when values are not live.
- **Status View**: Works offline with cached last-known values. Stale timestamp displayed.

### Performance

- Leaflet handles thousands of tiles smoothly on mid-range and low-end phones — this is battle-tested technology (Google Maps, OpenStreetMap, etc.)
- Value overlay limited to visible viewport markers only — typically 20-100 markers even on a graphic with 500+ bound points
- No SVG DOM manipulation on the phone — all rendering complexity is moved to the server-side tile generation step

## Phone Dashboard Layouts

Each dashboard supports a dual-layout configuration: the existing desktop layout and an optional phone-optimized layout. Both layouts reference the same widgets (same data sources, same configurations) — only the arrangement and sizing differ.

### Layout Configuration

- `layout_desktop`: The existing grid layout (unchanged)
- `layout_phone`: Optional phone-optimized layout stored alongside the desktop layout in the dashboard's JSONB config

### Auto-Generated Phone Layout

If no `layout_phone` is configured, the system auto-generates a single-column phone layout using widget priority scores:

| Priority | Widget Types | Phone Behavior |
|----------|-------------|----------------|
| 1 (always show) | KPI cards, gauges, alarm lists | Full-width, stacked vertically |
| 2 (show if space) | Sparklines, pie/donut, simple bar charts, single-axis trends | Full-width, included in auto-layout |
| 3 (landscape only) | Multi-axis trends, scatter plots, tables | Shown only in landscape orientation |
| 4 (exclude on phone) | Heatmaps, correlation matrices, complex multi-widget layouts | Not included in auto-generated phone layout |

Auto-generation sorts widgets by priority (descending), then by desktop grid position (top-to-bottom, left-to-right) for tie-breaking. Top N widgets are included (configurable, default 8).

### Manual Phone Layout

Dashboard authors can configure a custom phone layout using the Designer's phone preview mode (doc 09). This provides full control over the phone experience:

- Single-column canvas at phone width (~375px)
- Drag and resize widgets for phone presentation
- Explicit vertical ordering — author controls what's on top
- Widgets can be full-width or half-width (two KPI cards side-by-side)
- Phone layout is optional — dashboards work on phone with auto-generated layouts even without manual configuration

### Layout Selection

- **JS breakpoint**: `window.innerWidth < 768px` selects the phone layout at dashboard load time
- If `layout_phone` exists, serve it. If not, auto-generate from `layout_desktop`.
- **CSS Container Queries**: Handle per-widget responsive adaptation within whichever layout is active. Each widget adapts to its own container size, not the viewport — the same widget component renders appropriately whether it's in a full-width phone slot or a half-width desktop grid cell.

### Widget Adaptations on Phone

| Widget Type | Phone Adaptation |
|-------------|-----------------|
| **KPI cards** | Full width, stacked vertically — ideal phone widget. Can show 2 side-by-side at half-width. |
| **Gauges** | Rendered at 50-60% of desktop size, still readable. Hide minor tick marks. |
| **Trends (single-axis)** | Full-width, ~180px tall. Hide legend for single series. Landscape: ~300px tall. |
| **Trends (multi-axis)** | Landscape-only. Limit to 3-4 series. Legend below chart, not beside. |
| **Tables** | Reduce to 3-4 key columns, horizontal scroll for full data. Scrollable vertically within widget. |
| **Bar charts** | Horizontal bars preferred (full-width bars). Vertical bars narrow but usable. |
| **Pie/donut** | ~150px diameter. Limit to 6 slices. Legend below. |
| **Sparklines** | Full-width mini trend. No axis labels needed. |

General phone adaptations:
- No brush selection on phone (existing spec in Phone Simplifications below)
- Simplified tooltips (fewer data points shown)
- `tooltip.triggerOn: 'click'` for touch (existing ECharts spec)
- Larger touch targets for tooltip interaction

## Charting on Mobile

### uPlot (Time-Series)
- Requires explicit touch plugin (`zoom-touch`) — not built in
- Configure wider cursor hover radius for finger (vs mouse precision)
- Larger tooltip text for outdoor readability
- Handle `devicePixelRatio` for crisp rendering on high-DPI screens
- Responsive resize via `ResizeObserver` calling `uplot.setSize()`

### Apache ECharts (Non-Time-Series)
- Native mobile touch support — pinch-zoom and drag-pan work out of the box
- Use **SVG renderer** on mobile (`renderer: 'svg'`) — lower memory than Canvas
- Configure `tooltip.triggerOn: 'click'` (not `'mousemove'`) for touch
- Increase `dataZoom` handle size for touch targets
- `grid.containLabel: true` to prevent label clipping on small screens

### Phone Simplifications
- No brush selection on phone
- Simplified tooltips (fewer data points shown)
- ECharts lazy-loaded only when entering a chart-containing view (~300 KB gzipped)

## Offline Architecture

### Connectivity Model

I/O mobile is **connectivity-resilient**, not offline-first. Modern industrial sites have ubiquitous WiFi/WWAN coverage. Brief signal loss in areas with heavy metal structures or large vessel/pipe racks is the primary concern, not extended offline operation.

| Module | Connectivity Requirement | Rationale |
|--------|------------------------|-----------|
| **Rounds** | Online to start (locks the round), connectivity-resilient during | Round locking requires server coordination. Once locked, data entry caches locally and syncs on reconnect. |
| **Log** | Online only | Logs are shared resources. Offline editing would create reconciliation headaches. Users make notes elsewhere and update the log when back online. |
| **Alerts** | Online only | Viewing and acknowledging alerts requires server state. |
| **Console/Process** | Viewable offline with cached graphics and last-known values | Stale indicator shown. No live updates without connectivity. |
| **Dashboards** | Online only | Real-time data requires connectivity. |
| **All others** | Online only | — |

### Service Worker

Workbox (MIT) for caching strategy:

| Resource | Strategy | Rationale |
|----------|----------|-----------|
| App shell (HTML, JS, CSS) | Stale-While-Revalidate | Serve cached immediately, update in background |
| Static assets (icons, fonts) | Cache-First | Rarely change |
| API responses (read) | Network-First (5s timeout) | Try fresh data, fall back to cache |
| Rounds mutations (write) | Custom sync queue | Must reach server eventually |
| Media uploads | Custom chunked queue | Too large for standard sync |

Pre-cache app shell + critical assets. Stay under **50MB** for iOS Cache API limit. Graphic tile sets stored in IndexedDB (not Cache API) to allow larger storage.

### IndexedDB Storage

```
IndexedDB Database: "io-offline"
├── sync-queue        // Pending round mutations only
├── rounds-data       // In-progress round definitions + checkpoint data
├── media-blobs       // Photos, videos, audio (as Blobs)
├── point-cache       // Last-known point values for offline graphic display
└── tile-cache        // Graphic tile pyramids (LRU, up to 10 graphics)
```

### Sync Queue (Rounds Only)

Round checkpoint writes while offline are queued with idempotency keys:

1. User performs action offline (submit checkpoint, capture photo for a round)
2. Action saved to `sync-queue` with idempotency key (client-generated UUID)
3. Media blobs stored in `media-blobs`, referenced by ID
4. On connectivity restore (Page Visibility API `visibilitychange` + `online` event):
   - Process queue in FIFO order
   - POST to `/api/mobile/rounds/batch` with idempotency key
   - Server checks idempotency key — if already processed, returns success (no duplicate)
   - On success: remove from queue, schedule media upload
   - On server error: increment retry count, exponential backoff (max 30s)
   - On validation error: flag for user review, do not retry
5. Media upload: separate queue after metadata sync succeeds. Chunked upload for files >5MB with resume capability.

### Sync Status UX

Persistent sync status badge visible whenever items are pending:
- **Badge**: Shows count of pending items (e.g., "5 pending")
- **Auto-sync**: Items upload automatically on reconnect — no user action required
- **Countdown**: Badge count decreases as items sync successfully
- **Completion**: Brief "Synced" confirmation toast when queue is empty
- **Failure**: If sync fails, badge turns warning color with "Sync failed — tap for details" message. User can view error details and retry.

No explicit "Sync Now" button — sync is automatic. The badge provides confidence that data is being handled without requiring interaction.

### Conflict Resolution

| Module | Strategy | Rationale |
|--------|----------|-----------|
| Rounds | Accept all | Each checkpoint response is unique to a user/instance. Idempotent by `round_instance_id` + `checkpoint_id`. The round is locked by one user — no concurrent editing. |

Version numbers on synced entities — client sends its version with mutations, server rejects on version mismatch and returns current state for reconciliation.

### Media Storage

Photos compressed before IndexedDB storage via `browser-image-compression` (MIT):
- Resize to max 2048px longest edge
- JPEG quality 0.7
- Output: 200-800 KB per photo (down from 3-5 MB raw)

Video constrained at capture time:
- 720p, 24fps, 2 Mbps target bitrate
- 30-second clip: ~7.5 MB
- Check format support: `video/mp4` on iOS, `video/webm;codecs=vp9` on Android

Audio constrained at capture time:
- Opus in WebM (Android) or AAC in MP4 (iOS)
- Mono, 48 kbps
- 1-minute voice note: ~360 KB

**Storage budget per offline session:** 20 photos (16 MB) + 5 videos (37 MB) + 10 voice notes (3.6 MB) = ~57 MB. Well within 500 MB IndexedDB limit.

### Pre-Cache Budget

**Cache API** (50MB iOS limit) — app shell and critical assets only:
- App shell + code: ~5-15 MB
- Static assets (icons, fonts): ~2-5 MB
- Total: ~7-20 MB, well within limit

**IndexedDB** (500MB iOS limit) — data and tiles:
- Graphic tile pyramids: ~8-15 MB per graphic × up to 10 = 80-150 MB (adaptive based on available storage)
- Point cache (last-known values): ~2 MB
- Media blobs (photos, video, audio): ~57 MB per offline session budget
- In-progress round data: ~50 KB per round
- Total: ~140-210 MB typical, well within limit

## WebSocket on Mobile

### Throttling

Mobile clients do not need 1-second update frequency. Battery and bandwidth savings from slower updates:

| Client Type | Update Interval | Content |
|-------------|----------------|---------|
| Desktop | 1 second | All subscribed points, every update |
| Mobile (tablet) | 5 seconds | Changed values only since last push |
| Mobile (phone) | 10 seconds | Changed values only since last push |

Mobile clients identify themselves in WebSocket handshake. Data Broker applies the appropriate throttle.

### Background Behavior

- **Page Visibility API**: When app is backgrounded (`visibilityState === 'hidden'`), stop reconnection attempts. Set `pendingReconnect` flag.
- **Foreground resume**: When `visibilityState === 'visible'` and `pendingReconnect` is set, reconnect immediately with backoff reset.
- iOS kills WebSocket connections within 30-60 seconds of backgrounding. This is expected behavior, not a bug.
- Exponential backoff on reconnection: 1s, 2s, 4s, 8s, ... up to 30s max. Jitter added to prevent thundering herd.

### SharedWorker

SharedWorker with BroadcastChannel fallback — same architecture as desktop (see doc 06). SharedWorker works on iOS Safari as of 2024. Benefit on mobile is smaller (typically one tab) but provides consistency with desktop architecture.

## Media Capture

### Photo
- Use `<input type="file" accept="image/*" capture="environment">` — simplest, most reliable cross-platform
- Opens rear camera (equipment-facing)
- User can also choose from gallery
- Compress via `browser-image-compression` (MIT) before storage/upload

### Video
- MediaRecorder API with format detection:
  - `video/mp4` on iOS Safari
  - `video/webm;codecs=vp9` on Chrome Android
  - Always use `MediaRecorder.isTypeSupported()` — never hardcode MIME types
- Constrain at capture: 720p, 2 Mbps, rear camera

### Audio
- MediaRecorder API with format detection:
  - `audio/webm;codecs=opus` preferred (Chrome)
  - `audio/mp4` fallback (Safari — AAC codec)
- Mono, 48 kbps for voice notes

### Barcode Scanning
- **Chrome Android**: BarcodeDetector API (native, no library)
- **iOS Safari**: zxing-js/library (Apache 2.0) — camera + canvas frame analysis
- **Zebra tablets**: DataWedge injects barcode as keyboard input, no API needed
- Feature-detect BarcodeDetector, fall back to zxing-js automatically

## Performance Budgets

### Bundle Size

| Bundle | Max Size (gzipped) |
|--------|--------------------|
| Core shell (React, Router, auth, nav) | 80 KB |
| Shared components | 60 KB |
| Per-module chunk | 40-80 KB each |
| **Total initial load** | **< 200 KB gzipped** |

ECharts (~300 KB gzipped) is lazy-loaded only when entering a chart-containing view. uPlot (~50 KB gzipped) loaded with Console/Process/Dashboards.

### Load Times

| Condition | Target |
|-----------|--------|
| Cold load on WiFi | < 3 seconds TTI |
| Cold load on 4G | < 5 seconds TTI |
| Cached load (service worker) | < 2 seconds TTI |
| Graphic render (< 1,000 elements) | < 1 second |
| Graphic render (1,000-3,000 elements) | < 2 seconds (Canvas pre-render) |
| Offline form submission | Instant (IndexedDB write ~5ms) |
| Touch response latency | < 100ms |

### Code Splitting

Never load on mobile:
- **Designer module** — complex SVG editor, not usable on touch
- **Forensics module** — multi-source correlation, desktop-only analysis
- **Settings module** — admin functions, desktop only

Each mobile module has a separate lazy-loaded chunk. ECharts loaded only when Dashboard or chart view is active.

### Memory

iOS Safari limit: ~500 MB working set practical safe limit.
- Console 4 panes with Canvas: 4 x (2000 x 1500 x 4 bytes) = ~48 MB. Fine.
- Process single large graphic: 1 x (4000 x 3000 x 4 bytes) = ~48 MB. Fine.
- Dispose Canvas contexts and revoke object URLs when leaving a view.
- Do not pre-render all graphics — render on-demand when user navigates.

## Theme

**Light/High-Contrast as mobile default.** Outdoor sunlight readability requires:
- Light background (#E8E8E8 to #F0F0F0) with high-contrast foreground
- Both color AND shape/icon for status (red + exclamation for alarm, not just red)
- Minimum font weight: medium/semibold (400-600), never thin/light outdoors
- Text contrast ratio: 7:1 or better (WCAG AAA) for outdoor use
- Minimum 16px font size

Dark theme available but not the default on mobile. Auto-detect mobile platform and default to Light or High-Contrast.

## PWA Installation

Prompt users to install to Home Screen. For iOS this is **required** — not optional:
- Enables push notifications (iOS 16.4+)
- Eliminates 7-day storage eviction for script-writable data
- Provides standalone app mode (no Safari browser chrome)
- iOS 26+: Sites added to Home Screen default to opening as a web app

Enterprise deployment: IT can enforce Home Screen installation as part of device provisioning.

Chrome Android: Use `beforeinstallprompt` event to trigger install prompt. iOS: Show manual installation instructions (Add to Home Screen) since no programmatic prompt is available.

## Mobile API Endpoints

Existing API endpoints (doc 21) serve mobile clients — no separate mobile API surface. Mobile-specific additions:

- `POST /api/mobile/{module}/batch` — Batch submission of offline-queued mutations with idempotency keys
- `POST /api/mobile/upload/chunk` — Chunked media upload for large files on flaky connections
- `GET /api/mobile/sync-status` — Check server time, pending sync items, last sync timestamp

## Success Criteria

- PWA installable and functional on 10" Android tablet (Chrome) and iPad (Safari)
- Rounds module fully operational offline — complete a full round without connectivity, sync on return
- Log module entry mode works on tablets and phones (online connectivity required)
- Alerts viewable and acknowledgeable on phone and tablet
- Console 4-pane view usable on 10" tablet in both orientations
- Process graphic pinch-zoom smooth and responsive (60 FPS)
- Sync queue reliably delivers all offline data without duplicates
- Photo capture and compression functional on both platforms
- Barcode scanning works on Zebra DataWedge and via camera (both platforms)
- < 200 KB gzipped initial bundle
- < 3 second time-to-interactive on WiFi
- Touch targets >= 60px, usable with gloves
- Light/High-Contrast theme readable in direct sunlight

### Mobile-Specific Libraries

| Technology | Version | License | Purpose |
|------------|---------|---------|---------|
| **resvg** | 0.44+ | MPL-2.0 | Server-side SVG to PNG tile rendering for phone graphics. Rust-native, no system dependencies. |
| **Leaflet** | 1.9+ | BSD-2-Clause | Tile-based graphic viewer for phone. Smooth pinch-zoom, momentum scrolling, offline tile caching. |

Note: MPL-2.0 is on I/O's approved license list (file-level copyleft only, does not infect surrounding code). See doc 01 for the full technology stack.

## Change Log

- **v0.5**: Fixed contradictory success criteria — Log module success criterion now correctly states "online connectivity required" instead of claiming offline support. Aligns with the connectivity model table in this document (Log = online only, established in v0.3).
- **v0.4**: Updated mobile long-press gesture to open the shared Point Context Menu (doc 32) — same items as desktop right-click (Point Detail, Trend Point, Investigate Point, Report on Point).
- **v0.3**: Reframed offline strategy from "offline-first" to "connectivity-resilient." Rounds: online to start (lock), resilient during execution. Log: online only (shared resource). Alerts: online only. Graphic tile caching moved to IndexedDB with adaptive LRU (up to 10 most recently viewed graphics, budget 70% of available storage). Sync queue scoped to Rounds only (removed Log offline editing). Added sync status UX (persistent badge with pending count, auto-sync on reconnect, failure notification). Simplified conflict resolution (Rounds only — accept all with idempotency). Updated pre-cache budget to separate Cache API (app shell) from IndexedDB (tiles, data, media).
- **v0.2**: Added phone graphics via tile-based rendering (resvg + Leaflet) with Status View toggle. Added phone dashboard layouts (Power BI-style dual layout with auto-generation and Designer phone mode). Updated module availability table: Console and Process now available on phone via tile view, Dashboards available with phone layout. Added resvg (MPL-2.0) and Leaflet (BSD-2-Clause) to mobile dependencies.
- **v0.1**: Major rewrite — PWA confirmed viable, detailed module availability matrix, touch interaction patterns for gloved operation, graphics rendering thresholds for mobile, offline architecture with sync queue and conflict resolution, WebSocket throttling, media capture, performance budgets.
