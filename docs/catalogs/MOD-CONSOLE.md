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

The Console module has a solid architectural foundation: three Zustand stores correctly separated, `zundo` temporal middleware for undo/redo, `react-grid-layout` v2 for the workspace grid, SharedWorker managing the WebSocket connection, direct DOM update pipeline via RAF loop in `SceneRenderer`, and status bar with correct data sources. Since the prior audit, four gaps were resolved: export now supports all 6 formats with spec-compliant filename and async large-export path; auto-save is correctly debounced at 2 seconds; template switching preserves an overflow stack so panes are not discarded; and the PointContextMenu now uses correct canonical item order with no spurious "View History" item. Remaining gaps are concentrated in left-nav panel completeness (no favorites groups or view-mode selectors), aspect ratio lock stored globally instead of per-workspace, Historical Playback Bar speed values wrong and missing alarm markers and keyboard shortcuts, no nested per-pane error boundaries, kiosk mode not hiding Console-specific chrome, and several minor polish gaps.

## Non-Negotiables

| # | Non-Negotiable | Status | Evidence |
|---|----------------|--------|----------|
| 1 | Three Zustand stores: WorkspaceStore (zundo), SelectionStore (no temporal), RealtimeStore (no temporal) | ✅ | `store/workspaceStore.ts:101` — `temporal()` wraps WorkspaceStore; `store/selectionStore.ts:35` — plain `create()`; `store/realtimeStore.ts:40` — plain `create()` |
| 2 | `zundo` for undo/redo via `temporal.undo()` / `temporal.redo()`, stack resets on workspace switch | ✅ | `store/workspaceStore.ts:11,101`; `index.tsx:335-358` — undo/redo wired, `temporal.getState().clear()` on `activeId` change |
| 3 | `react-grid-layout` v2 for workspace grid | ✅ | `WorkspaceGrid.tsx:2` imports `GridLayout` from `react-grid-layout`; `package.json:50` — `react-grid-layout@^2.2.2` |
| 4 | Real-time updates bypass React (SharedWorker → mutable buffer → RAF → direct DOM) | ✅ | `SceneRenderer.tsx:116,174-196` — mutable `pendingDomRef`, RAF loop, direct DOM mutations via `applyPointValue`; `GraphicPane.tsx:534-539` passes `liveSubscribe={!isHistorical}` |
| 5 | Left nav panel: 4 accordion sections (Workspaces, Graphics, Widgets, Points), each with favorites/view-mode-selector/search | ⚠️ Partial | All 4 sections present at `ConsolePalette.tsx:610-641`. Missing per all sections: favorites/star group; view-mode selector (list/thumbnails/grid) icons; section-height resize drag handle. Points section has search; others do not have search within section. |
| 6 | SharedWorker manages WebSocket | ✅ | `workers/wsWorker.ts:34` — SharedWorkerGlobalScope; `shared/hooks/useWsWorker.ts:72` — `new SharedWorker(...)` |
| 7 | Workspace stored in `design_objects` table with `type='workspace'` | ✅ | API routed to `/api/workspaces`; spec §3.1 `WorkspaceConfig` shape matched |
| 8 | Historical playback syncs ALL panes to single timestamp | ✅ | `HistoricalPlaybackBar` is module-level at `index.tsx`; `GraphicPane.tsx:182-183` reads module-wide `usePlaybackStore` |
| 9 | Detached window support via SharedWorker | ❌ Missing | No `window.open()` for pane detach found anywhere in `frontend/src/pages/console/`. Spec §12 defines `/detached/console/:workspaceId` route and per-window subscription management. |
| 10 | Status bar (connection dot, point count, workspace name, Live/Historical indicator) | ✅ | `index.tsx:26-111` — `ConsoleStatusBar` has all 4 fields sourced from `RealtimeStore` and `PlaybackStore` |
| 11 | Template switching preserves pane content; overflow stack for extra panes | ✅ | `store/workspaceStore.ts:157-187` — `changeLayout` uses `overflowPanes` correctly; extra panes moved to overflow, not discarded |
| 12 | Auto-save failure shows persistent warning banner with "Save now" button | ✅ | `index.tsx:265-280` — exponential backoff, after 3 failures `showSaveBanner = true`; `index.tsx:1294-1329` — persistent banner with "Save now" button |
| 13 | Aspect ratio lock persisted per-workspace in `WorkspaceConfig.settings` | ⚠️ Wrong | `preserveAspectRatio` is a global Zustand field at `store/workspaceStore.ts:74`, not per-workspace. Spec §4.5 requires it in `WorkspaceSettings.preserveAspectRatio` within each workspace's `scene_data`. Switching workspaces does not restore the per-workspace setting. |

## False-DONE Patterns

| Pattern | Present? | Evidence |
|---------|----------|----------|
| undo/redo with useRef stacks instead of zundo | ✅ Not present | zundo `temporal` at `store/workspaceStore.ts:101` |
| Grid with CSS grid instead of react-grid-layout | ✅ Not present | `WorkspaceGrid.tsx:2` uses `react-grid-layout` |
| WebSocket per-tab instead of SharedWorker | ✅ Not present | `workers/wsWorker.ts` is a SharedWorker |
| Left panel missing Workspaces section | ✅ Not present | All 4 sections at `ConsolePalette.tsx:610-641` |
| Left panel Workspaces with no workspace creation from panel | ⚠️ Found | `WorkspacesSection` at `ConsolePalette.tsx:195` — no "New Workspace" button within the panel accordion body; creation only via "+" tab in header bar |
| Real-time updates through React state (desktop path) | ✅ Not present | `SceneRenderer` with `liveSubscribe=true` handles subscriptions via direct DOM |
| SelectionStore state stored in WorkspaceStore | ✅ Not present | Separate `store/selectionStore.ts` |
| Status bar missing | ✅ Not present | `ConsoleStatusBar` present and complete |
| Workspace config stored in separate table | ✅ Not present | Uses `design_objects` via `/api/workspaces` |

## Wave 0 Contract Gaps

### CX-EXPORT

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-EXPORT | Export button visible in toolbar | ✅ | `index.tsx:1119-1216` |
| CX-EXPORT | Button hidden (not disabled) without `console:export` permission | ✅ | `index.tsx:1119` — `canExport && (` |
| CX-EXPORT | 6 formats: CSV, XLSX, PDF, JSON, Parquet, HTML | ✅ | `index.tsx:1163-1171` — all 6 formats in dropdown |
| CX-EXPORT | Large export async path (≥50K rows → async job + WebSocket notification) | ✅ | `index.tsx:615,628-638` — `LARGE_EXPORT_THRESHOLD = 50_000` check, async job path |
| CX-EXPORT | Filename: `{module}_{entity}_{YYYY-MM-DD_HHmm}.{ext}` | ✅ | `index.tsx:595-601` — `exportFilename()` produces spec-compliant name |
| CX-EXPORT | WYSIWYG export collects points from graphic panes | ⚠️ Wrong | `index.tsx:604-613` — `collectWorkspacePointIds` reads `trendPointIds` and `tablePointIds` only; graphic pane bound points not included (they require traversing the loaded scene graph) |

### CX-POINT-CONTEXT

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-POINT-CONTEXT | Shared `PointContextMenu` component used | ✅ | `GraphicPane.tsx:13,626` |
| CX-POINT-CONTEXT | Component signature `{ pointId, tagName, isAlarm, isAlarmElement }` | ✅ | `PointContextMenu.tsx:6-13` |
| CX-POINT-CONTEXT | Canonical item order: Point Detail → Trend → sep → Investigate → Report → sep → Investigate Alarm → sep → Copy Tag Name | ✅ | `PointContextMenu.tsx:142-215` — correct canonical order, no extra items |
| CX-POINT-CONTEXT | Items hidden (not grayed) without permission | ✅ | `canForensics &&` line 166; `canReports &&` line 178 |
| CX-POINT-CONTEXT | Menu in <50ms (no async before render) | ✅ | No async calls block render |
| CX-POINT-CONTEXT | Long-press 500ms on mobile | ❌ Missing | No touch event handlers in `GraphicPane.tsx` |

### CX-ENTITY-CONTEXT

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-ENTITY-CONTEXT | Workspace list items in panel have right-click menu | ⚠️ Wrong | `ConsolePalette.tsx:217` — workspace buttons have no `onContextMenu`; tab bar at `index.tsx:855` has `onContextMenu` but panel accordion list does not |

### CX-POINT-DETAIL

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-POINT-DETAIL | Floating window: draggable, resizable, pinnable, minimizable | ⚠️ Partial | `PointDetailPanel.tsx:69` — draggable only; no resize handle, no pin, no minimize |
| CX-POINT-DETAIL | Up to 3 concurrent instances | ✅ | `GraphicPane.tsx:244-253` — `MAX_POINT_DETAIL_PANELS = 3` |
| CX-POINT-DETAIL | Session-persisted position and size | ❌ Missing | Position is local `useState` in `PointDetailPanel.tsx`; lost on navigation |

### CX-PLAYBACK

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-PLAYBACK | Shared PlaybackBar component | ✅ | `HistoricalPlaybackBar.tsx` shared; used at `index.tsx` |
| CX-PLAYBACK | Speed selector: ×0.25, ×0.5, ×1, ×2, ×4, ×8, ×16, ×32 | ❌ Wrong | `HistoricalPlaybackBar.tsx:20` — `SPEEDS = [1, 2, 5, 10, 60, 300]`; spec §8.3 requires `[0.25, 0.5, 1, 2, 4, 8, 16, 32]` |
| CX-PLAYBACK | Alarm markers on scrub bar from alarm events API | ❌ Missing | No alarm event fetch in `HistoricalPlaybackBar.tsx` |
| CX-PLAYBACK | Historical mode switches entire workspace | ✅ | Playback state is module-level |
| CX-PLAYBACK | Keyboard shortcuts (Space, arrows, Home, End, [, ], L) | ❌ Missing | No `keydown` listener in `HistoricalPlaybackBar.tsx` |

### CX-RBAC

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-RBAC | Route guard on /console | ✅ | `App.tsx:146` — `<PermissionGuard permission="console:read">` |
| CX-RBAC | Action buttons hidden without permission | ✅ | Export, Publish buttons hidden via permission checks |
| CX-RBAC | Empty state CTA permission-aware | ❌ Missing | `index.tsx:1366-1380` — "Create Workspace" CTA unconditional; no `console:write` gate |

### CX-ERROR

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-ERROR | Module wrapped in error boundary | ✅ | `App.tsx:147` — `<ErrorBoundary module="Console">` |
| CX-ERROR | Error UI: generic message + [Reload Module] button | ⚠️ Partial | `ErrorBoundary.tsx:41-50` — button text is "Try again" not "Reload Module"; remounts component correctly |
| CX-ERROR | Nested error boundaries around individual panes | ❌ Missing | No `ErrorBoundary` in `PaneWrapper.tsx` or any console pane; single pane crash propagates to module |
| CX-ERROR | Error reported to observability | ⚠️ Partial | `ErrorBoundary.tsx:22` — `console.error()` only; no structured tracing hook |

### CX-LOADING

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-LOADING | Module-shaped skeleton (not generic spinner) | ⚠️ Wrong | `index.tsx:788-803` — centered text "Loading workspaces…"; not a Console-layout skeleton |
| CX-LOADING | Partial loading (panes load independently) | ✅ | `GraphicPane.tsx` — per-pane independent loading states |

### CX-EMPTY

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-EMPTY | Tailored empty state (not generic "No data") | ✅ | `index.tsx:1331-1381` — Console-specific illustration + explanation |
| CX-EMPTY | CTA permission-aware | ❌ Missing | "Create Workspace" CTA always rendered; no `console:write` check at `index.tsx:1366` |

### CX-TOKENS

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-TOKENS | Colors use CSS custom properties | ✅ | `var(--io-accent)`, `var(--io-surface)`, etc. throughout |
| CX-TOKENS | No hardcoded hex in semantic positions | ⚠️ Wrong | `GraphicPane.tsx:464,472` — `#09090B`, `#71717A` in loading/error states; `index.tsx:60-103` — `#22C55E`, `#F59E0B`, `#EF4444` in status bar (alarm semantic colors may be acceptable, but loading/error state colors are not); `index.tsx:1058` — `#EF4444` on delete button; `index.tsx:1274-1275` — `#92400E`, `#FEF3C7` in swap-mode banner |

### CX-KIOSK

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-KIOSK | `?kiosk=true` hides all chrome including Console status bar and playback bar | ⚠️ Partial | `AppShell.tsx` hides sidebar/topbar; `ConsolePage` has no kiosk check — status bar at `index.tsx` and playback bar always rendered regardless of kiosk state |
| CX-KIOSK | Corner hover trigger to exit kiosk | ❌ Missing | Not in Console code |
| CX-KIOSK | Module functional in kiosk mode | ✅ | SharedWorker subscriptions are independent of DOM chrome |

## Findings Summary

- [MOD-CONSOLE-001] Left nav panel sections missing favorites group, view-mode selector (list/thumbnails/grid), and section-height resize — `ConsolePalette.tsx:116-658`
- [MOD-CONSOLE-002] Detached window support (window.open + SharedWorker shared, /detached/console/:workspaceId) not implemented — spec §12
- [MOD-CONSOLE-003] Aspect ratio lock not persisted per-workspace; stored as single global Zustand field — `store/workspaceStore.ts:74`
- [MOD-CONSOLE-004] Historical Playback Bar speed values wrong: has [1,2,5,10,60,300], spec requires [0.25,0.5,1,2,4,8,16,32]; also missing alarm markers on scrub bar and keyboard shortcuts — `HistoricalPlaybackBar.tsx:20`
- [MOD-CONSOLE-005] No nested error boundaries around individual panes — crash in any pane kills whole module — `PaneWrapper.tsx`
- [MOD-CONSOLE-006] Empty state "Create Workspace" CTA not gated on `console:write` permission — `index.tsx:1366`
- [MOD-CONSOLE-007] PointDetailPanel not resizable, not pinnable, not minimizable; position not session-persisted — `PointDetailPanel.tsx`
- [MOD-CONSOLE-010] Loading state is text-only "Loading workspaces…" instead of Console-shaped skeleton — `index.tsx:788-803`
- [MOD-CONSOLE-011] Console status bar and playback bar not hidden in kiosk mode — `index.tsx`
