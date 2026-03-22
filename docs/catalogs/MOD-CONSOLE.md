---
unit: MOD-CONSOLE
audited: 2026-03-22
relationship: OVERHAUL
spec-files:
  - /home/io/spec_docs/console-implementation-spec.md
result: ⚠️ Gaps found
tasks-generated: 11
---

## Summary

The Console module has a solid architectural foundation: three Zustand stores correctly separated with `zundo` temporal middleware on WorkspaceStore only, `react-grid-layout` v2 for the workspace grid, a SharedWorker managing the WebSocket connection, a direct DOM update pipeline via RAF loop in the SceneRenderer, template switching with overflow-stack preservation, auto-save failure banner, and a complete status bar. Eleven gaps remain: the left-nav panel is missing favorites groups, view-mode selectors, and section-height resize across all sections; aspect ratio lock is stored globally instead of per-workspace; the Historical Playback Bar has wrong speed values, missing keyboard shortcuts, missing loop region, missing reverse transport, and missing step interval dropdown; detached window support is absent; nested pane error boundaries are absent; the ErrorBoundary button reads "Try again" instead of "Reload Module"; the module skeleton loading state is a text string not a layout-shaped skeleton; the empty-state "Create Workspace" CTA is not permission-gated; PointDetailPanel lacks resize, pin, minimize, and session-persistent position; kiosk uses the wrong URL parameter and lacks corner-dwell exit; and hardcoded hex colors exist in the status bar and pane loading states.

## Non-Negotiables

| # | Non-Negotiable | Status | Evidence |
|---|----------------|--------|----------|
| 1 | Three Zustand stores: WorkspaceStore (zundo), SelectionStore (no temporal), RealtimeStore (no temporal) | ✅ | `store/workspaceStore.ts:101` — `temporal()` wraps only WorkspaceStore; `store/selectionStore.ts:35` — plain `create()`; `store/realtimeStore.ts:40` — plain `create()` |
| 2 | `zundo` for undo/redo via `temporal.undo()` / `temporal.redo()`, stack resets on workspace switch | ✅ | `index.tsx:334-358` — `temporal.getState().undo()`, `temporal.getState().clear()` on `activeId` change |
| 3 | `react-grid-layout` v2 for workspace grid | ✅ | `WorkspaceGrid.tsx:2` — imports `GridLayout` from `react-grid-layout`; package.json confirms v2 |
| 4 | Real-time updates bypass React (SharedWorker → mutable buffer → RAF → direct DOM) | ✅ | `store/realtimeStore.ts:19` — mutable `pointValueBuffer` Map outside React state; `SceneRenderer.tsx` — RAF drain loop with direct DOM mutations |
| 5 | Left nav panel: 4 accordion sections each with favorites group, view-mode selector, search/filter | ⚠️ Partial | 4 sections present at `ConsolePalette.tsx:610-641`. No favorites group in any section (no star icon, no starred-items list). No view-mode selector (list/thumbnails/grid icons) in any section header. Points section has search; Workspaces/Graphics/Widgets sections have no search. Panel width is 220px (spec: 280px default); not resizable (spec: 200-400px). Section heights not resizable. |
| 6 | SharedWorker manages WebSocket connection | ✅ | `shared/hooks/useWsWorker.ts:72` — `new SharedWorker(...)` with `workers/wsWorker.ts` |
| 7 | Workspace stored in `design_objects` table with `type='workspace'` | ✅ | Console API routes to `/api/workspaces`; WorkspaceConfig shape matches spec §3.1 |
| 8 | Historical playback syncs ALL panes to single timestamp via WorkspaceStore/PlaybackStore | ✅ | `store/playback.ts` — shared module-level; `GraphicPane.tsx:182` reads `usePlaybackStore` |
| 9 | Detached window support via SharedWorker | ❌ Missing | No `window.open()` for pane detachment anywhere in `frontend/src/pages/console/`. Spec §12 defines `/detached/console/:workspaceId` route and per-window subscription management. |
| 10 | Status bar: connection status dot, subscribed point count, workspace name, Live/Historical indicator | ✅ | `index.tsx:26-111` — `ConsoleStatusBar` has all 4 fields; sources from `RealtimeStore.connectionStatus`, `RealtimeStore.subscribedPointCount`, `PlaybackStore.mode` |
| 11 | Template switching preserves pane content; overflow stack for extra panes | ✅ | `store/workspaceStore.ts:157-187` — `changeLayout` moves excess panes to `overflowPanes`; not deleted |
| 12 | Auto-save failure shows persistent warning banner with "Save now" button | ✅ | `index.tsx:1293-1329` — banner with "Save now" button shown after 3 consecutive failures; exponential backoff retry |
| 13 | Aspect ratio lock persisted per-workspace in `WorkspaceConfig.settings` | ⚠️ Wrong | `store/workspaceStore.ts:74` — `preserveAspectRatio` is a global field on WorkspaceState, not stored inside each workspace's config. Switching workspaces does not restore per-workspace setting. |

## False-DONE Patterns

| Pattern | Present? | Evidence |
|---------|----------|----------|
| undo/redo with useRef stacks instead of zundo | ✅ Not present | zundo `temporal` wraps WorkspaceStore at `store/workspaceStore.ts:101` |
| Grid with CSS grid instead of react-grid-layout | ✅ Not present | `WorkspaceGrid.tsx` uses `react-grid-layout` exclusively |
| WebSocket per-tab instead of SharedWorker | ✅ Not present | `shared/hooks/useWsWorker.ts:72` — single SharedWorker instance |
| Left panel missing Workspaces section | ✅ Not present | All 4 sections present at `ConsolePalette.tsx:610-641` |
| Left panel Workspaces section with no workspace creation from panel | ⚠️ Found | `ConsolePalette.tsx:195-248` — `WorkspacesSection` has no "New Workspace" button; creation only via "+" tab in header bar, not from within the palette |
| Real-time updates through React state on desktop path | ✅ Not present | Desktop path uses direct wsManager subscription + DOM; no `useState` on hot path |
| SelectionStore state stored in WorkspaceStore | ✅ Not present | Separate `store/selectionStore.ts` with no temporal middleware |
| Status bar missing | ✅ Not present | `ConsoleStatusBar` present at `index.tsx:26-111` |
| Workspace config stored in separate table | ✅ Not present | Uses `design_objects` table via `/api/workspaces` |

## Wave 0 Contract Gaps

### CX-EXPORT

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-EXPORT | Export button visible in toolbar | ✅ | `index.tsx:1119-1216` |
| CX-EXPORT | Button hidden (not disabled) without `console:export` permission | ✅ | `index.tsx:1119` — `canExport && (` |
| CX-EXPORT | 6 formats: CSV, XLSX, PDF, JSON, Parquet, HTML | ✅ | `index.tsx:1163-1171` — all 6 formats in dropdown |
| CX-EXPORT | Large export async path (>=50K rows) | ✅ | `index.tsx:615,628-638` — `LARGE_EXPORT_THRESHOLD = 50_000` |
| CX-EXPORT | Filename: `{module}_{entity}_{YYYY-MM-DD_HHmm}.{ext}` | ✅ | `index.tsx:595-601` — `exportFilename()` produces spec-compliant name |
| CX-EXPORT | WYSIWYG export includes graphic pane bound points | ⚠️ Wrong | `index.tsx:604-613` — `collectWorkspacePointIds` reads only `trendPointIds` and `tablePointIds`; graphic pane bound points excluded (requires traversing loaded scene graphs) |

### CX-POINT-CONTEXT

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-POINT-CONTEXT | Shared `PointContextMenu` component used | ✅ | `GraphicPane.tsx:13` — imports `PointContextMenu` from shared components |
| CX-POINT-CONTEXT | Component signature `{ pointId, tagName, isAlarm, isAlarmElement }` | ✅ | Caller at `GraphicPane.tsx:350-365` passes all 4 props |
| CX-POINT-CONTEXT | Canonical item order correct | ✅ | `shared/components/PointContextMenu.tsx` — correct order per decision file |
| CX-POINT-CONTEXT | Items hidden (not grayed) without permission | ✅ | Permission gates use conditional render not disabled state |
| CX-POINT-CONTEXT | Menu renders in <50ms (no async before render) | ✅ | Context menu state set synchronously in `handleSvgContextMenu` |
| CX-POINT-CONTEXT | Long-press 500ms on mobile | ❌ Missing | `GraphicPane.tsx` has no touch event handlers (`onTouchStart`, `onTouchEnd`) for long-press detection |

### CX-ENTITY-CONTEXT

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-ENTITY-CONTEXT | Workspace list items in panel have right-click context menu | ⚠️ Wrong | `ConsolePalette.tsx:217` — workspace list `<button>` elements have no `onContextMenu`; tab bar at `index.tsx:855` has `onContextMenu` but palette accordion list does not |

### CX-POINT-DETAIL

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-POINT-DETAIL | Floating window: draggable, resizable, pinnable, minimizable | ⚠️ Partial | `shared/components/PointDetailPanel.tsx` — draggable only; no resize handle, no pin toggle, no minimize button |
| CX-POINT-DETAIL | Up to 3 concurrent instances | ✅ | `GraphicPane.tsx:244` — `MAX_POINT_DETAIL_PANELS = 3` enforced |
| CX-POINT-DETAIL | Session-persisted position and size | ❌ Missing | Position held in local `useState` in `PointDetailPanel.tsx`; lost on navigation |

### CX-PLAYBACK

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-PLAYBACK | Shared PlaybackBar component | ✅ | `shared/components/HistoricalPlaybackBar.tsx` used at `index.tsx:1415` |
| CX-PLAYBACK | Speed selector values ×0.25, ×0.5, ×1, ×2, ×4, ×8, ×16, ×32 | ❌ Wrong | `HistoricalPlaybackBar.tsx:20` — `SPEEDS = [1, 2, 5, 10, 60, 300]`; spec §8.3 requires `[1, 2, 4, 8, 16, 32]` (and spec §CX-PLAYBACK adds ×0.25 and ×0.5) |
| CX-PLAYBACK | Alarm markers on scrub bar from alarm events API | ✅ | `HistoricalPlaybackBar.tsx:60-72` — fetches `alarmsApi.getEvents`; lines 209-245 — rendered as priority-colored tick marks |
| CX-PLAYBACK | Historical mode switches entire workspace (not just active pane) | ✅ | Playback state is module-level in `usePlaybackStore` |
| CX-PLAYBACK | Keyboard shortcuts (Space, arrows, Home, End, [, ], L) | ❌ Missing | No `keydown` listener in `HistoricalPlaybackBar.tsx` |
| CX-PLAYBACK | Loop region with two draggable handles | ❌ Missing | No loop region UI or state in `HistoricalPlaybackBar.tsx` or `store/playback.ts` |
| CX-PLAYBACK | Reverse transport control | ❌ Missing | No reverse/rewind button in `HistoricalPlaybackBar.tsx` |
| CX-PLAYBACK | Step interval dropdown (1s, 5s, 30s, 1m, 5m, 15m, 1h, Next change) | ❌ Missing | No step interval selector; step uses a computed `stepMs` value instead |

### CX-RBAC

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-RBAC | Route guard on /console routes | ✅ | `App.tsx:146,156,166` — all three console routes guarded with `console:read` or `console:write` |
| CX-RBAC | Action buttons hidden without permission | ✅ | Export button at `index.tsx:1119` — `canExport && (`; Publish button — `canPublish && (` |
| CX-RBAC | Empty state CTA permission-aware | ❌ Missing | `index.tsx:1366-1380` — "Create Workspace" CTA rendered unconditionally; no `console:write` gate |

### CX-ERROR

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-ERROR | Module wrapped in error boundary | ✅ | `App.tsx:147` — `<ErrorBoundary module="Console">` |
| CX-ERROR | Error UI: generic message + [Reload Module] button | ⚠️ Partial | `ErrorBoundary.tsx:49` — button text is "Try again" not "Reload Module"; `setState({ hasError: false })` correctly remounts component |
| CX-ERROR | Nested error boundaries around individual panes | ❌ Missing | No `ErrorBoundary` wrapping in `PaneWrapper.tsx` or any pane component; single pane crash propagates to module level |
| CX-ERROR | Error reported to observability system | ⚠️ Partial | `ErrorBoundary.tsx:22` — `console.error()` only; no structured tracing hook or Sentry integration |

### CX-LOADING

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-LOADING | Module-shaped skeleton (not generic spinner/text) | ⚠️ Wrong | `index.tsx:788-803` — centered text "Loading workspaces…" with no structural skeleton; spec requires a Console-layout skeleton matching left panel + workspace grid |
| CX-LOADING | Panes load independently (partial loading) | ✅ | `GraphicPane.tsx:140-148` — per-pane independent loading states |

### CX-EMPTY

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-EMPTY | Tailored empty state (not generic "No data") | ✅ | `index.tsx:1331-1381` — Console-specific SVG icon + explanation text |
| CX-EMPTY | CTA permission-aware | ❌ Missing | `index.tsx:1366-1380` — "Create Workspace" button always rendered; no `console:write` check |

### CX-TOKENS

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-TOKENS | Colors use CSS custom properties | ✅ | `var(--io-accent)`, `var(--io-surface-*)`, `var(--io-text-*)`, `var(--io-border)` throughout |
| CX-TOKENS | No hardcoded hex in semantic positions | ⚠️ Wrong | `index.tsx:60-103` — `#22C55E`, `#F59E0B`, `#EF4444` for connection/mode dots in status bar; `index.tsx:1274-1275` — `#92400E`, `#FEF3C7` in swap-mode banner background; `GraphicPane.tsx:464,472` — `#09090B`, `#71717A` in loading/error states |

### CX-KIOSK

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-KIOSK | `?kiosk=true` hides all chrome | ⚠️ Wrong | Kiosk activated via `?mode=kiosk` in AppShell (not `?kiosk=true`); Console status bar and playback bar have no kiosk check in `index.tsx` |
| CX-KIOSK | Corner hover trigger (1.5s dwell) reveals exit button | ❌ Missing | AppShell has Escape and Ctrl+Shift+K exits only; no corner dwell trigger implemented |
| CX-KIOSK | Module fully functional in kiosk mode | ✅ | SharedWorker subscriptions independent of DOM chrome |

## Findings Summary

- [MOD-CONSOLE-001] Left nav panel sections missing favorites group, view-mode selector (list/thumbnails/grid), section-height resize; panel width 220px not resizable to 200-400px — `ConsolePalette.tsx:116-658`
- [MOD-CONSOLE-002] Detached window support (pane `window.open()`, `/detached/console/:workspaceId` route, shared-worker subscription handoff) not implemented — spec §12
- [MOD-CONSOLE-003] Aspect ratio lock stored as global Zustand field; not persisted per-workspace in `WorkspaceConfig.settings` — `store/workspaceStore.ts:74`
- [MOD-CONSOLE-004] (superseded by MOD-CONSOLE-008) Historical Playback Bar speed values wrong; alarm markers and keyboard shortcuts missing
- [MOD-CONSOLE-005] No nested error boundaries around individual panes; single pane crash kills entire module — `PaneWrapper.tsx`
- [MOD-CONSOLE-006] Empty state "Create Workspace" CTA not gated on `console:write` permission — `index.tsx:1366`
- [MOD-CONSOLE-007] PointDetailPanel not resizable, not pinnable, not minimizable; position not session-persisted — `shared/components/PointDetailPanel.tsx`
- [MOD-CONSOLE-008] Playback bar: speed values wrong `[1,2,5,10,60,300]` vs spec `[×1,×2,×4,×8,×16,×32]`; missing keyboard shortcuts, loop region, reverse transport, step interval dropdown — `HistoricalPlaybackBar.tsx:20`
- [MOD-CONSOLE-009] ErrorBoundary button text "Try again" should be "Reload Module"; no observability hook — `shared/components/ErrorBoundary.tsx:49`
- [MOD-CONSOLE-010] Module skeleton loading is plain text "Loading workspaces…" not Console-shaped layout skeleton — `index.tsx:788-803`
- [MOD-CONSOLE-011] Kiosk uses `?mode=kiosk` not `?kiosk=true`; Console chrome (status bar, playback bar) not hidden in kiosk; no corner dwell exit trigger — `AppShell.tsx`, `index.tsx`
