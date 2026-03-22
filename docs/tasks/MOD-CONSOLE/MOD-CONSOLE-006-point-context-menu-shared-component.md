---
id: MOD-CONSOLE-006
title: Replace local point context menu in GraphicPane with shared PointContextMenu component
unit: MOD-CONSOLE
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

Right-clicking any point-bound SVG element in a Console graphic pane must open the shared `PointContextMenu` component — not the local `ContextMenu` with hand-rolled items. The shared component enforces correct item ordering, permission gating (items hidden not grayed), conditional "Investigate Alarm" (only when isAlarm/isAlarmElement is true), and the full canonical item set including "Copy Tag Name."

## Spec Excerpt (verbatim)

> Right-clicking (desktop) or long-pressing **500ms** (mobile) on any point-bound element opens the unified **`PointContextMenu`** shared component. Individual modules must NOT implement their own version.
> The component signature is `PointContextMenu({ pointId, tagName, isAlarm, isAlarmElement })`. Callers must pass all four props.
> — SPEC_MANIFEST.md, CX-POINT-CONTEXT non-negotiables #1 and #2

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/panes/GraphicPane.tsx` — lines 614-664: custom `ContextMenu` with hard-coded items. The `pointCtxMenu` state (line 234) only stores `{ x, y, pointId }` — missing tagName, isAlarm, isAlarmElement.
- `frontend/src/shared/components/PointContextMenu.tsx` — the shared component that should be used instead. It uses Radix UI DropdownMenu and has the canonical item set.
- `frontend/src/shared/components/PointContextMenu.tsx` — review: "Investigate Alarm" is gated on `isAlarm` prop (line 146). "Investigate Point" and other items are NOT permission-gated yet (check line 158+).

## Verification Checklist

- [ ] GraphicPane.tsx does NOT import `ContextMenu` for point right-click. The hand-rolled point context menu block (lines 614-664) is removed.
- [ ] GraphicPane.tsx imports and uses `PointContextMenu` for point right-click.
- [ ] `pointCtxMenu` state stores `{ x, y, pointId, tagName, isAlarm, isAlarmElement }`.
- [ ] `tagName` is populated (resolved from point metadata, not just the pointId).
- [ ] `isAlarm` / `isAlarmElement` is passed to `PointContextMenu`.
- [ ] "Investigate Alarm" only appears when `isAlarm || isAlarmElement` is true.
- [ ] "Investigate Point" and "Report on Point" are hidden when user lacks `forensics:read` / `reports:read`.

## Assessment

- **Status**: ❌ Wrong
- GraphicPane.tsx:614-664 uses local `ContextMenu` with 6 hard-coded items. pointCtxMenu state (line 234) only stores `{ x, y, pointId }`. The shared PointContextMenu.tsx exists and has most of the correct behavior but is not imported by GraphicPane. "Investigate Alarm" is unconditional in the local menu.

## Fix Instructions

**Step 1: Extend pointCtxMenu state in GraphicPane.tsx** (around line 234):
```typescript
const [pointCtxMenu, setPointCtxMenu] = useState<{
  x: number; y: number; pointId: string; tagName: string; isAlarm: boolean; isAlarmElement: boolean
} | null>(null)
```

**Step 2: Populate tagName and alarm state.** In `handleSvgContextMenu` (line 344), after finding `pointId`, look up the tag name and alarm state from the tooltipValuesRef or a point metadata cache:
```typescript
const pv = tooltipValuesRef.current.get(pointId)
const tagName = pv?.tagName ?? pointId  // fallback to pointId if not cached
const isAlarm = pv?.quality === 'alarm' || false
setPointCtxMenu({ x: e.clientX, y: e.clientY, pointId, tagName, isAlarm, isAlarmElement: false })
```

If the point metadata is not in the tooltip ref, defer tag resolution — the PointContextMenu receives `tagName` and can display the pointId as a fallback.

**Step 3: Replace the context menu render block** (lines 614-664 in GraphicPane.tsx). Remove the entire `{pointCtxMenu && (<ContextMenu ... />)}` block. Replace with the shared component rendered as a portal:
```tsx
{pointCtxMenu && (
  <PointContextMenu
    pointId={pointCtxMenu.pointId}
    tagName={pointCtxMenu.tagName}
    isAlarm={pointCtxMenu.isAlarm}
    isAlarmElement={pointCtxMenu.isAlarmElement}
    onViewDetail={(pid) => { openPointDetail(pid, pointCtxMenu.x, pointCtxMenu.y); setPointCtxMenu(null) }}
    onAddToTrend={(pid) => { /* open trend pane */ setPointCtxMenu(null) }}
  >
    {/* invisible portal anchor — PointContextMenu renders at fixed position */}
    <span style={{ position: 'fixed', top: pointCtxMenu.y, left: pointCtxMenu.x, width: 0, height: 0 }} />
  </PointContextMenu>
)}
```

**Step 4: Fix permission gating in PointContextMenu.tsx.** The "Investigate Point" and "Report on Point" items currently lack permission gates. Add `usePermission` checks:
```typescript
const canForensics = usePermission('forensics:read')
const canReports = usePermission('reports:read')
// Then wrap items: {canForensics && <DropdownMenu.Item>Investigate Point</DropdownMenu.Item>}
```

Do NOT:
- Keep the local ContextMenu import for point right-click (it can stay for non-point pane context menus).
- Implement a new custom menu instead of the shared component — the shared component is the spec requirement.
- Permission-gate "Point Detail", "Trend This Point", or "Copy Tag Name" — these are always visible.
