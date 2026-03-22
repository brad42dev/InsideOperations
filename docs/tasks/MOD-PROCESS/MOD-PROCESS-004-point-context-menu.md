---
id: MOD-PROCESS-004
title: Replace custom point right-click with shared PointContextMenu component
unit: MOD-PROCESS
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

Right-clicking on any point-bound element in the Process graphic should open the shared `PointContextMenu` component (not a locally-constructed `ContextMenu`). The shared component must present all canonical items in the correct order, gate permission-required items as hidden (not grayed), support alarm-specific items, and handle mobile long-press at 500ms.

## Spec Excerpt (verbatim)

> Right-clicking (desktop) or long-pressing **500ms** (mobile) on any point-bound element opens the unified **`PointContextMenu`** shared component. Individual modules must NOT implement their own version.
>
> The component signature is `PointContextMenu({ pointId, tagName, isAlarm, isAlarmElement })`. Callers must pass all four props.
>
> **Canonical items** (in order): Point Detail — always visible. Trend This Point — always visible. [separator] Investigate Point — hidden if user lacks `forensics:read`. Report on Point — hidden if user lacks `reports:read`. [separator — only when `isAlarm || isAlarmElement`] Investigate Alarm — only when `isAlarm || isAlarmElement`. [separator] Copy Tag Name — always visible.
> — context-menu-implementation-spec.md §2 (P1 pattern) + docs/decisions/cx-point-context.md

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/process/index.tsx:981-1023` — custom inline `ContextMenu` with point right-click items
- `frontend/src/pages/process/index.tsx:636-667` — `pointCtxMenu` state, `handleContainerContextMenu`
- `frontend/src/shared/components/PointContextMenu.tsx` — the shared component (currently has wrong signature)
- `frontend/src/shared/components/PointContextMenu.tsx:5-10` — current props: `{ pointId, children, onViewDetail, onAddToTrend }` — wrong signature

## Verification Checklist

- [ ] The shared `PointContextMenu` component signature is updated to `{ pointId, tagName, isAlarm, isAlarmElement }`.
- [ ] Process module uses `PointContextMenu` (not local `ContextMenu`) for point right-click.
- [ ] All 7 canonical items present in order: Point Detail, Trend This Point, separator, Investigate Point, Report on Point, separator (conditional), Investigate Alarm (conditional), separator, Copy Tag Name.
- [ ] "Investigate Alarm" item is only rendered when `isAlarm || isAlarmElement`.
- [ ] "Investigate Point" and "Report on Point" are hidden (not grayed) when user lacks `forensics:read` / `reports:read`.
- [ ] Mobile long-press at 500ms triggers the context menu on point-bound elements.
- [ ] "Trend This Point" has no permission gate.
- [ ] "Copy Tag Name" copies the full tag name to clipboard.

## Assessment

- **Status**: ❌ Wrong
- `index.tsx:981-1023` — Process implements its own inline point context menu using the generic `ContextMenu` component. Items are: Point Detail, Copy Tag, Trend Point, Investigate Point, Report on Point. The shared `PointContextMenu` component at `shared/components/PointContextMenu.tsx` is imported but never used in `index.tsx`.
- The existing `PointContextMenu` component has wrong props signature (missing `tagName`, `isAlarm`, `isAlarmElement`).
- "Investigate Alarm" item is absent.
- No permission checks on any items.
- No mobile long-press handling.

## Fix Instructions

**Step 1: Update `PointContextMenu` component signature**

In `frontend/src/shared/components/PointContextMenu.tsx`, update the props interface to:
```typescript
export interface PointContextMenuProps {
  pointId: string
  tagName: string
  isAlarm?: boolean
  isAlarmElement?: boolean
  children: React.ReactNode
}
```

Add permission checks using the auth store to hide `forensics:read` and `reports:read` gated items.

**Step 2: Update Process module to use the shared component**

In `frontend/src/pages/process/index.tsx`:
1. Remove the `pointCtxMenu` state and `handleContainerContextMenu` custom logic for point elements.
2. Instead, wrap each point-bound SVG element (or use the canvas container's right-click with point detection) to trigger `PointContextMenu`.
3. The challenge: the graphic renders as an SVG inside `SceneRenderer`. The cleanest approach is to pass an `onPointContextMenu` callback to `SceneRenderer` and have `SceneRenderer` fire it on right-click with `{ pointId, tagName }`.

**Step 3: Mobile long-press**

Add a `useLongPress` hook or inline logic on the canvas container:
- On `pointerdown` on a touch device: start a 500ms timer. If `pointerup` fires before timer, cancel it. If timer fires, open the `PointContextMenu` for the targeted point.
- Cancel on `pointermove` if movement exceeds 10px.

Do NOT:
- Keep the custom local `ContextMenu` for point right-clicks — the spec explicitly requires the shared component.
- Gray out permission-lacking items — they must be hidden entirely.
- Make "Trend This Point" require any permission.
