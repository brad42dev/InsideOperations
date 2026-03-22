---
unit: MOD-PROCESS
audited: 2026-03-21
relationship: OVERHAUL
spec-files:
  - /home/io/spec_docs/process-implementation-spec.md
  - /home/io/io-dev/io/design-docs/08_PROCESS_MODULE.md
result: ⚠️ Gaps found
tasks-generated: 8
---

## Summary

The Process module has a solid core: the shared SceneRenderer is used correctly, LOD CSS is applied to the container div (not the SVG root), viewport-based subscriptions with variable pre-fetch buffer are implemented, the minimap renders and is interactive, and RBAC route guards + error boundaries are in place. However, eight gaps were found — the most critical being that initial graphic load sets `zoom: 1` instead of computing zoom-to-fit, the point right-click context menu is a custom local implementation rather than the shared `PointContextMenu` component (wrong items, wrong signature), kiosk mode (`?kiosk=true`) is not wired up in the Process route, and the spatial binding index pre-computation specified in §5.6 is absent (subscription scan walks the full scene graph on every debounced viewport change).

## Non-Negotiables

| # | Non-Negotiable | Status | Evidence |
|---|---------------|--------|----------|
| 1 | Viewport-based subscriptions with adaptive spatial index (flat array default, rbush >2,000 elements) | ⚠️ Wrong | `index.tsx:141-185` — walks full scene graph on every viewport change. No pre-built binding index. No rbush upgrade path. |
| 2 | 4-tier LOD system — CSS-driven on `io-canvas-container` div, `data-lod` per element | ✅ | `lod.css` — correct 4-tier CSS. `SceneRenderer.tsx:874` — `lod-${lodLevel}` class on container div. Elements carry `data-lod` attributes. |
| 3 | Minimap — persistent corner overlay with live viewport rectangle, click/drag navigation | ✅ | `ProcessMinimap.tsx` — canvas rendered on load, viewport rect updated on every pan/zoom change. Click and drag wired. Toggle (M key) works. |
| 4 | 5%-800% zoom range | ⚠️ Wrong | `index.tsx:436` — `Math.max(0.05, Math.min(10, ...))` clamps to 5%-1000%. Upper bound should be 8.0 (800%), not 10. |
| 5 | Viewport bookmarks — saved server-side in user preferences, per user per graphic | ⚠️ Wrong | `index.tsx:308-347` — bookmarks are saved via `bookmarksApi` (server-side generic bookmarks table). However, the spec requires storage in `user_preferences` JSONB at key `process_bookmarks.{graphicId}`. Bookmark name field is abused to encode JSON payload. Also, shared/admin bookmarks not supported. |
| 6 | Left sidebar: Views, Bookmarks, Navigation, Recent (4 sections) | ⚠️ Partial | `ProcessSidebar.tsx:383-388` — Navigation section is a stub: "Navigation hierarchy coming soon". All other sections present. |
| 7 | Shared rendering pipeline with SceneRenderer | ✅ | `index.tsx:906-914` — uses `SceneRenderer` component directly. No duplicate renderer. |
| 8 | Historical playback is viewport-aware (only fetches visible points) | ✅ | `index.tsx:750-755` — `useHistoricalValues(isHistorical ? visiblePointIds : [], ...)` — passes viewport-restricted point IDs to historical hook. |
| 9 | Initial load: zoom-to-fit | ❌ Missing | `index.tsx:420-424` — when graphic loads, `zoom: 1` is set. `zoomFit()` exists but is never called automatically on load. |
| 10 | Variable pre-fetch buffer (10%/8%/5% by zoom level) | ✅ | `index.tsx:133-139` — `getBufferFraction()` implements the 3-tier buffer exactly per spec §5.3. |
| 11 | Scope warning toast — "Unsubscribing N points" when navigating away | ❌ Missing | No toast shown on view navigation. `handleSelectView` (index.tsx:395-403) just changes state silently. |

## False-DONE Patterns

| Pattern | Present? | Evidence |
|---------|----------|----------|
| Viewport subscriptions computed as "all points in graphic" (no spatial index) | ⚠️ Found | `index.tsx:141-185` — `getVisiblePointIds()` walks the full scene graph tree on every debounced change. No pre-built spatial index. |
| Spatial index always using R-tree regardless of element count | ✅ Not present | No rbush import found. Flat walk used. (But the spec-required pre-built flat array binding index is also absent.) |
| LOD on SVG root instead of container div | ✅ Not present | `SceneRenderer.tsx:874` — class applied to the `<div>` container, not `<svg>`. |
| Minimap missing or static (no live viewport rect) | ✅ Not present | `ProcessMinimap.tsx:104-152` — viewport rect re-drawn on every pan/zoom via useEffect deps. |
| Zoom range copied from Console (25%-400%) | ✅ Not present | Lower bound is 5% (`0.05`). Upper bound is 1000% (`10`) which is wrong but not the Console value. |
| Bookmarks stored in localStorage | ✅ Not present | Bookmarks saved via `bookmarksApi` (server-side). |
| Bookmark saves graphic ID + zoom but not pan position | ✅ Not present | `addViewportBookmarkMutation` (index.tsx:336-347) includes panX, panY, zoom. |
| Left sidebar structured like Console palette | ✅ Not present | Sidebar has 4 Process-specific accordion sections. |
| Initial load at 100% zoom | ❌ Found | `index.tsx:423` — `zoom: 1` set on graphic load, not zoom-to-fit. |
| Fixed 10% pre-fetch buffer | ✅ Not present | Variable buffer implemented. |
| LOD 0 hides ALL elements | ✅ Not present | LOD 0 still shows `data-lod="0"` elements (equipment, pipes, annotations, large text). |
| Minimap static (no live viewport rect update) | ✅ Not present | `ProcessMinimap.tsx:152` — `vpX, vpY, vpW, vpH` are in the useEffect dependency array. |

## Wave 0 Contract Gaps

### CX-EXPORT

| Check | Status | Evidence |
|-------|--------|----------|
| Export button in toolbar | ❌ Missing | `index.tsx:1036-1138` — toolbar has zoom, live/historical, bookmark, fullscreen. No Export button. |
| 6 formats (CSV, XLSX, PDF, JSON, Parquet, HTML) | ❌ Missing | No export functionality at all in Process module. |
| WYSIWYG export (current view filters) | ❌ Missing | N/A — no export exists. |
| Export hidden (not disabled) when user lacks `process:export` | ❌ Missing | No button to hide. |

### CX-POINT-CONTEXT

| Check | Status | Evidence |
|-------|--------|----------|
| Uses shared `PointContextMenu` component | ❌ Wrong | `index.tsx:981-1023` — custom inline `ContextMenu` component with local items. `PointContextMenu` component exists at `shared/components/PointContextMenu.tsx` but is NOT used in Process. |
| Component signature: `PointContextMenu({ pointId, tagName, isAlarm, isAlarmElement })` | ❌ Wrong | Existing `PointContextMenu` has signature `{ pointId, children, onViewDetail, onAddToTrend }` — wrong. And Process doesn't use it anyway. |
| Canonical items in order: Point Detail, Trend This Point, separator, Investigate Point, Report on Point, separator (if alarm), Investigate Alarm, separator, Copy Tag Name | ⚠️ Wrong | `index.tsx:987-1022` — has Point Detail, Copy Tag (correct name differs: "Copy Tag"), Trend Point, Investigate Point, Report on Point. Missing: "Trend This Point" label (labeled "Trend Point"), separator structure absent, "Investigate Alarm" missing entirely. |
| "Investigate Alarm" only when `isAlarm || isAlarmElement` | ❌ Missing | No alarm-aware item. |
| Items hidden (not grayed) when user lacks permission | ❌ Missing | No permission checks on Investigate Point or Report on Point items. |
| Menu appears in <50ms | ✅ | Custom `ContextMenu` renders synchronously on right-click. |
| Long-press 500ms on mobile | ❌ Missing | No long-press handler on the canvas. |

### CX-POINT-DETAIL

| Check | Status | Evidence |
|-------|--------|----------|
| Floating window: draggable, resizable, pinnable, minimizable | ⚠️ Partial | `PointDetailPanel` imported and used at `index.tsx:1027-1034`. Need to verify PointDetailPanel itself has all these capabilities. |
| Up to 3 concurrent instances | ✅ | `index.tsx:641-649` — `MAX_DETAIL_PANELS = 3`, oldest removed when 4th opened. |
| Session-persisted position and size | Cannot verify | PointDetailPanel implementation not audited here. |

### CX-PLAYBACK

| Check | Status | Evidence |
|-------|--------|----------|
| Uses shared `HistoricalPlaybackBar` component | ✅ | `index.tsx:1141` — `{isHistorical && <HistoricalPlaybackBar />}` |
| Speed selector (×0.25 through ×32) | Cannot verify here | Depends on HistoricalPlaybackBar internals. |
| Alarm markers on scrub bar | Cannot verify here | Depends on HistoricalPlaybackBar internals. |
| Space/arrow keyboard shortcuts | Cannot verify here | Depends on HistoricalPlaybackBar internals. |

### CX-RBAC

| Check | Status | Evidence |
|-------|--------|----------|
| Route guard on `/process` | ✅ | `App.tsx:175` — `<PermissionGuard permission="process:read">` |
| Action buttons hidden when user lacks permission | ⚠️ Partial | No explicit permission checks on Export (missing), Print (missing). Bookmark/fullscreen have no permission requirement so OK. |

### CX-ERROR

| Check | Status | Evidence |
|-------|--------|----------|
| React error boundary wrapping module | ✅ | `App.tsx:176` — `<ErrorBoundary module="Process">` |
| [Reload Module] button — remounts component | ✅ | `ErrorBoundary.tsx:42-47` — "Try again" button calls `this.setState({ hasError: false })`. |
| Error reported to observability | ⚠️ Partial | `ErrorBoundary.tsx:22` — `console.error(...)` only. No structured log or Sentry hook. |

### CX-LOADING

| Check | Status | Evidence |
|-------|--------|----------|
| Module-shaped skeleton | ❌ Wrong | `index.tsx:899-903` — loading state is a centered text "Loading…" spinner, not a module-shaped skeleton matching the sidebar + viewport layout. |

### CX-EMPTY

| Check | Status | Evidence |
|-------|--------|----------|
| Tailored empty state (no graphic selected) | ✅ | `index.tsx:887-896` — custom icon + "Process Module" heading + "Select a graphic from the sidebar" message. |
| CTA permission-aware | ✅ | No action CTA in this empty state (read-only context). Appropriate. |

### CX-TOKENS

| Check | Status | Evidence |
|-------|--------|----------|
| CSS custom properties used for all colors | ⚠️ Partial | Most colors use tokens. `ProcessMinimap.tsx:116` — `ctx.fillStyle = '#1a1f2e'` hardcoded background. `index.tsx:1099` — `'#78350f22'` hardcoded historical amber tint. `index.tsx:784-787` — connection status uses hardcoded `#22C55E`, `#EAB308`, `#EF4444`. |
| All 3 themes work | Cannot verify from code alone | |
| Alarm/status tokens non-customizable | ✅ | Status dots use ISA colors directly (not theme-variable). |

### CX-KIOSK

| Check | Status | Evidence |
|-------|--------|----------|
| `?kiosk=true` hides chrome | ❌ Missing | `index.tsx` — no `useSearchParams` call. Process module does not read the `?kiosk=true` URL parameter. AppShell kiosk state (`isKiosk`) is driven by `useUiStore`, but nothing in Process sets it from the URL. |
| Escape / corner hover to exit | ❌ Missing | No kiosk exit mechanism in Process. |
| Module continues to function in kiosk mode | N/A | Kiosk not implemented. |

## Findings Summary

- [MOD-PROCESS-001] Initial graphic load sets `zoom: 1` instead of zoom-to-fit — `index.tsx:423`
- [MOD-PROCESS-002] No pre-built spatial binding index; full scene graph walk on every viewport change — `index.tsx:141-185`
- [MOD-PROCESS-003] Zoom upper bound is 1000% (`10`), not 800% (`8.0`) — `index.tsx:436`
- [MOD-PROCESS-004] Point right-click uses custom local ContextMenu, not shared PointContextMenu; missing canonical items, alarm awareness, permission gating, and mobile long-press — `index.tsx:981-1023`
- [MOD-PROCESS-005] Export button missing from toolbar; no export feature in Process module — `index.tsx:1036-1138`
- [MOD-PROCESS-006] Navigation sidebar section is a stub ("coming soon") — `ProcessSidebar.tsx:383-388`
- [MOD-PROCESS-007] Kiosk mode (`?kiosk=true`) not wired up in Process module — no `useSearchParams` in `index.tsx`
- [MOD-PROCESS-008] Module-shaped skeleton loading state missing; shows plain "Loading…" text — `index.tsx:899-903`
- [MOD-PROCESS-009] Hardcoded colors in ProcessMinimap and Process toolbar instead of CSS tokens — `ProcessMinimap.tsx:116`, `index.tsx:1099`
- [MOD-PROCESS-010] "Unsubscribing N points" scope-change toast not implemented — `index.tsx:395-403`
- [MOD-PROCESS-011] Bookmark storage uses generic bookmarks API, not `user_preferences.process_bookmarks.{graphicId}` JSONB structure; shared/admin bookmarks not supported — `index.tsx:308-347`
