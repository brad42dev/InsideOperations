---
unit: MOD-CONSOLE
audited: 2026-03-22
relationship: OVERHAUL
spec-files:
  - /home/io/spec_docs/console-implementation-spec.md
result: ⚠️ Gaps found
tasks-generated: 9
---

## Summary

The Console module has a solid architectural foundation: the three Zustand stores are correctly separated, `zundo` temporal middleware is used for undo/redo, `react-grid-layout` v2 drives the workspace grid, the SharedWorker manages the WebSocket connection, and the status bar is present with correct data sources. However, several significant gaps exist: the Export button only offers CSV while the spec requires 6 formats, the Historical Playback Bar uses wrong speed values and lacks alarm markers and keyboard shortcuts, kiosk mode chrome-hiding is incomplete for Console-specific bars, there are no nested error boundaries around individual panes, and the left nav panel is missing per-section favorites, view-mode selectors, and section-height resize. Additionally, auto-save fires immediately on every change rather than being debounced 2 seconds.

## Non-Negotiables

| # | Non-Negotiable | Status | Evidence |
|---|----------------|--------|----------|
| 1 | Three Zustand stores: WorkspaceStore (zundo), SelectionStore (no temporal), RealtimeStore (no temporal) | ✅ | `store/workspaceStore.ts:101` — `temporal()` wraps WorkspaceStore; `store/selectionStore.ts:35` — plain `create()`; `store/realtimeStore.ts:40` — plain `create()` |
| 2 | `zundo` for undo/redo via `temporal.undo()` / `temporal.redo()`, stack resets on workspace switch | ✅ | `store/workspaceStore.ts:11,101,223`; `index.tsx:312-336` — undo/redo wired, `temporal.getState().clear()` on `activeId` change |
| 3 | `react-grid-layout` v2 for workspace grid | ✅ | `WorkspaceGrid.tsx:2` imports `GridLayout` from `react-grid-layout`; `package.json:48` — `react-grid-layout@^2.2.2` |
| 4 | Real-time updates bypass React (SharedWorker → mutable buffer → RAF → direct DOM via O(1) pointToElements map) | ⚠️ Partial | Desktop live path: `SceneRenderer` receives `liveSubscribe=true` at `GraphicPane.tsx:539` and handles direct DOM updates. However `GraphicPane` uses `useWebSocketRaf` hook for the phone path and tooltip refs, which does pass through React state (`wsValues` map). The spec's explicit `RealtimeUpdateManager` class + `pointValueBuffer` global + RAF drain loop architecture is not evident as a distinct class; it is partially implemented within `SceneRenderer`. Evidence of direct DOM mutation pathway exists but the full pipeline shape is distributed. |
| 5 | Left nav panel: 4 accordion sections (Workspaces, Graphics, Widgets, Points), each with favorites/view-mode-selector/search | ⚠️ Partial | All 4 sections present at `ConsolePalette.tsx:610-641`. Missing: per-section favorites/star group; view-mode selector (list/thumbnails/grid) icons at section header; section-height resize drag handle. Points section has search; other sections do not. |
| 6 | SharedWorker manages WebSocket | ✅ | `workers/wsWorker.ts:52` — `sharedSelf.onconnect` handler; `GraphicPane.tsx:8` imports `wsManager` |
| 7 | Workspace stored in `design_objects` table with `type='workspace'` | ✅ | API routed to `/api/workspaces`; `WorkspaceConfig` shape matches spec §3.1; stored as `scene_data` JSONB |
| 8 | Historical playback syncs ALL panes to single timestamp | ✅ | `HistoricalPlaybackBar` is module-level at `index.tsx:1306`; `GraphicPane.tsx:182-183` reads module-wide `usePlaybackStore` |
| 9 | Detached window support via SharedWorker | ❌ Missing | No `window.open()` for pane detach found anywhere in `frontend/src/pages/console/` |
| 10 | Status bar (connection dot, point count, workspace name, Live/Historical indicator) | ✅ | `index.tsx:24-109` — `ConsoleStatusBar` has all 4 fields sourced from `RealtimeStore` and `PlaybackStore` |
| 11 | Template switching preserves pane content; overflow stack for extra panes | ⚠️ Partial | `store/workspaceStore.ts:157-165` — `changeLayout` preserves first N panes correctly. Extra panes beyond new slot count are dropped silently — no overflow stack as spec §4.6 specifies |
| 12 | Auto-save failure shows persistent warning banner with "Save now" button | ✅ | `index.tsx:1185-1220` — `showSaveBanner` renders after 3 failures; "Save now" button present |
| 13 | Aspect ratio lock persisted per-workspace in `WorkspaceConfig.settings` | ⚠️ Wrong | `preserveAspectRatio` is a global Zustand field at `store/workspaceStore.ts:74`, not per-workspace. Spec §4.5 requires it in `WorkspaceSettings.preserveAspectRatio` within each workspace's `scene_data`. |

## False-DONE Patterns

| Pattern | Present? | Evidence |
|---------|----------|----------|
| undo/redo with useRef stacks instead of zundo | ✅ Not present | zundo `temporal` at `store/workspaceStore.ts:101` |
| Grid with CSS grid instead of react-grid-layout | ✅ Not present | `WorkspaceGrid.tsx:2` uses `react-grid-layout` |
| WebSocket per-tab instead of SharedWorker | ✅ Not present | `workers/wsWorker.ts` is a SharedWorker |
| Left panel missing Workspaces section | ✅ Not present | All 4 sections at `ConsolePalette.tsx:610-641` |
| Left panel Workspaces with no workspace creation from panel | ⚠️ Found | `WorkspacesSection` at line 195 — no "New Workspace" button within the panel accordion body; creation only via "+" tab at `index.tsx:830` |
| Real-time updates through React state (desktop path) | ✅ Not present | `SceneRenderer` with `liveSubscribe=true` handles subscriptions; `SceneRenderer.tsx` uses direct DOM mutations |
| SelectionStore state stored in WorkspaceStore | ✅ Not present | Separate `store/selectionStore.ts` |
| Status bar missing | ✅ Not present | `ConsoleStatusBar` present and complete |
| Workspace config stored in separate table | ✅ Not present | Uses `design_objects` via `/api/workspaces` |

## Wave 0 Contract Gaps

### CX-EXPORT

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-EXPORT | Export button visible in toolbar | ✅ | `index.tsx:1060-1108` |
| CX-EXPORT | Button hidden (not disabled) without `console:export` permission | ✅ | `index.tsx:1060` — `canExport && (` |
| CX-EXPORT | 6 formats: CSV, XLSX, PDF, JSON, Parquet, HTML | ❌ Missing | `index.tsx:1089-1091` — only CSV offered |
| CX-EXPORT | WYSIWYG export (inherits active filters) | ⚠️ Wrong | `handleExportCsv` only reads `pane.trendPointIds`; misses graphic pane point bindings |
| CX-EXPORT | Large export async path (≥50K rows → 202 + WebSocket) | ❌ Missing | Fully synchronous; no row-count check |
| CX-EXPORT | Filename: `{module}_{entity}_{YYYY-MM-DD_HHmm}.{ext}` | ❌ Missing | Line 592: `${activeWorkspace.name}-export.csv` |

### CX-POINT-CONTEXT

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-POINT-CONTEXT | Shared `PointContextMenu` component used | ✅ | `GraphicPane.tsx:13,626` |
| CX-POINT-CONTEXT | Component signature `{ pointId, tagName, isAlarm, isAlarmElement }` | ✅ | `PointContextMenu.tsx:6-13` |
| CX-POINT-CONTEXT | Canonical item order: Point Detail → Trend → sep → Investigate → Report → sep → Investigate Alarm → sep → Copy Tag Name | ⚠️ Wrong | `PointContextMenu.tsx:109-191` — order: Copy Tag Name → View History (extra item) → View Point Detail → Trend → Investigate Alarm → Investigate Point → Report on Point |
| CX-POINT-CONTEXT | Items hidden (not grayed) without permission | ✅ | `canForensics &&` line 167; `canReports &&` line 180 |
| CX-POINT-CONTEXT | Menu in <50ms (no async before render) | ✅ | No async calls block render |
| CX-POINT-CONTEXT | Long-press 500ms on mobile | ❌ Missing | No touch event handlers in `GraphicPane.tsx` |

### CX-ENTITY-CONTEXT

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-ENTITY-CONTEXT | Workspace list items in panel have right-click menu | ⚠️ Wrong | `ConsolePalette.tsx:217` — workspace buttons have no `onContextMenu`; tab bar at `index.tsx:796` has `onContextMenu` but panel list does not |

### CX-POINT-DETAIL

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-POINT-DETAIL | Floating window: draggable, resizable, pinnable, minimizable | ⚠️ Partial | `PointDetailPanel.tsx:138-156` — draggable only; no resizable handle, no pin, no minimize |
| CX-POINT-DETAIL | Up to 3 concurrent instances | ✅ | `GraphicPane.tsx:244-253` — `MAX_POINT_DETAIL_PANELS = 3` |
| CX-POINT-DETAIL | Session-persisted position and size | ❌ Missing | Position is local `useState`; lost on navigation |

### CX-PLAYBACK

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-PLAYBACK | Shared PlaybackBar component | ✅ | `HistoricalPlaybackBar.tsx` shared; used at `index.tsx:1306` |
| CX-PLAYBACK | Speed selector: ×0.25, ×0.5, ×1, ×2, ×4, ×8, ×16, ×32 | ❌ Wrong | `HistoricalPlaybackBar.tsx:18` — SPEEDS = [1,2,5,10,60,300]; spec requires [0.25,0.5,1,2,4,8,16,32] |
| CX-PLAYBACK | Alarm markers on scrub bar from `GET /api/v1/alarms/events` | ❌ Missing | No alarm event fetch in `HistoricalPlaybackBar.tsx` |
| CX-PLAYBACK | Historical mode switches entire workspace | ✅ | Playback state is module-level |
| CX-PLAYBACK | Keyboard shortcuts (Space, arrows, Home, End, [, ], L) | ❌ Missing | No `keydown` listener in `HistoricalPlaybackBar.tsx` |

### CX-RBAC

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-RBAC | Route guard on /console | ✅ | `App.tsx:146` — `<PermissionGuard permission="console:read">` |
| CX-RBAC | Action buttons hidden without permission | ✅ | Export, Publish buttons hidden via permission check |
| CX-RBAC | Empty state CTA permission-aware | ❌ Missing | `index.tsx:1257-1271` — "Create Workspace" CTA unconditional; no `console:write` gate |

### CX-ERROR

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-ERROR | Module wrapped in error boundary | ✅ | `App.tsx:147` — `<ErrorBoundary module="Console">` |
| CX-ERROR | Error UI: generic message + [Reload Module] button | ⚠️ Partial | `ErrorBoundary.tsx:41-50` — button text is "Try again" not "Reload Module"; remounts component correctly |
| CX-ERROR | Nested error boundaries around individual panes | ❌ Missing | No `ErrorBoundary` in any `console/` file; pane crash propagates to module boundary |
| CX-ERROR | Error reported to observability | ⚠️ Partial | `ErrorBoundary.tsx:22` — `console.error()` only; no structured tracing hook |

### CX-LOADING

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-LOADING | Module-shaped skeleton (not generic spinner) | ⚠️ Wrong | `index.tsx:729-744` — centered text "Loading workspaces…"; not a Console-layout skeleton |
| CX-LOADING | Skeleton appears immediately | ⚠️ Wrong | No skeleton; blank area until React evaluates `isLoading` |
| CX-LOADING | Partial loading (panes load independently) | ✅ | `GraphicPane.tsx:462-468` — per-pane independent loading |

### CX-EMPTY

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-EMPTY | Tailored empty state (not generic "No data") | ✅ | `index.tsx:1222-1272` — Console-specific illustration + explanation |
| CX-EMPTY | CTA permission-aware | ❌ Missing | "Create Workspace" CTA always rendered; no `console:write` check at `index.tsx:1257` |

### CX-TOKENS

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-TOKENS | Colors use CSS custom properties | ✅ | `var(--io-accent)`, `var(--io-surface)`, etc. throughout |
| CX-TOKENS | 3 themes work | ✅ | CSS var references; theme switching works |
| CX-TOKENS | No hardcoded hex in semantic positions | ⚠️ Wrong | `GraphicPane.tsx:464,472` — `#09090B`, `#71717A` in loading/error; `index.tsx:999` — `#EF4444` on delete button |

### CX-KIOSK

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-KIOSK | `?kiosk=true` hides all chrome including Console status bar and playback bar | ⚠️ Partial | `AppShell.tsx` hides sidebar/topbar; `ConsolePage` has no kiosk check — status bar at `index.tsx:1308-1313` and playback bar at `index.tsx:1306` always rendered |
| CX-KIOSK | Corner hover trigger to exit kiosk | ❌ Missing | Not in Console code |
| CX-KIOSK | Module functional in kiosk mode | ✅ | SharedWorker subscriptions are independent of DOM chrome |

## Findings Summary

- [MOD-CONSOLE-001] Export button only offers CSV — missing XLSX, PDF, JSON, Parquet, HTML — `index.tsx:1089-1091`
- [MOD-CONSOLE-002] Auto-save fires synchronously on every layout change instead of being debounced 2 seconds — `index.tsx:431-439`
- [MOD-CONSOLE-003] Left nav panel sections missing favorites group, view-mode selector (list/thumbnails/grid), and section-height resize — `ConsolePalette.tsx:116-658`
- [MOD-CONSOLE-004] Detached window support (window.open + SharedWorker shared) not implemented — spec §6.3 — not found
- [MOD-CONSOLE-005] Template downsizing drops extra panes without maintaining overflow stack — `store/workspaceStore.ts:157-165`
- [MOD-CONSOLE-006] Aspect ratio lock not persisted per-workspace; stored as single global Zustand field — `store/workspaceStore.ts:74`
- [MOD-CONSOLE-007] Historical Playback Bar speed values wrong: has [1,2,5,10,60,300], spec requires [0.25,0.5,1,2,4,8,16,32] — `HistoricalPlaybackBar.tsx:18`
- [MOD-CONSOLE-008] Historical Playback Bar missing alarm markers on scrub bar — no alarm event fetch — `HistoricalPlaybackBar.tsx`
- [MOD-CONSOLE-009] Historical Playback Bar missing keyboard shortcuts (Space, arrows, Home, End, [, ], L) — `HistoricalPlaybackBar.tsx`
- [MOD-CONSOLE-010] PointContextMenu item order wrong and "View History" is extra non-spec item — `PointContextMenu.tsx:109-191`
- [MOD-CONSOLE-011] No nested error boundaries around individual panes — crash in GraphicPane kills whole module — `PaneWrapper.tsx`
- [MOD-CONSOLE-012] Empty state "Create Workspace" CTA not gated on `console:write` permission — `index.tsx:1257`
- [MOD-CONSOLE-013] PointDetailPanel not resizable, not pinnable, not minimizable; position not session-persisted — `PointDetailPanel.tsx`
- [MOD-CONSOLE-014] Console status bar and playback bar not hidden in kiosk mode — `index.tsx:1306-1313`
- [MOD-CONSOLE-015] Loading state is text-only "Loading workspaces…" instead of Console-shaped skeleton — `index.tsx:729-744`
- [MOD-CONSOLE-016] Hardcoded hex colors in Console files: `#09090B`, `#71717A` in `GraphicPane.tsx:464,472`; `#EF4444` in `index.tsx:999`
- [MOD-CONSOLE-017] Long-press (500ms) for point context menu on mobile not implemented — `GraphicPane.tsx`
