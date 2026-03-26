---
id: MOD-PROCESS-020
title: Pass isAlarm prop to PointContextMenu in Process module
unit: MOD-PROCESS
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The shared `PointContextMenu` component requires four props: `pointId`, `tagName`, `isAlarm`, and `isAlarmElement`. The Process module passes only three, omitting `isAlarm`. While the component defaults `isAlarm` to `false`, the manifest requires all four props to be explicitly provided by callers.

## Spec Excerpt (verbatim)

> The component signature is `PointContextMenu({ pointId, tagName, isAlarm, isAlarmElement })`. Callers must pass all four props.
> — SPEC_MANIFEST.md, §CX-POINT-CONTEXT Non-negotiables #2

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/process/index.tsx:1315-1335` — `<PointContextMenu ...>` render — `isAlarm` prop absent
- `frontend/src/pages/process/index.tsx:884-885` — `pointCtxMenu` state shape (does not track `isAlarm`)
- `frontend/src/pages/process/index.tsx:57-67` — `findIsAlarmElement()` — detects alarm indicator elements
- `frontend/src/shared/components/PointContextMenu.tsx:10` — `isAlarm?: boolean` prop (optional, defaults to false)

## Verification Checklist

- [ ] `<PointContextMenu>` in Process is called with an explicit `isAlarm` prop.
- [ ] `isAlarm` correctly reflects whether the target element is bound to an alarm-type point (distinct from `isAlarmElement` which flags alarm indicator display elements).

## Assessment

- **Status**: ⚠️ Wrong
- `index.tsx:1315-1320` — `PointContextMenu` is called with `pointId`, `tagName`, `isAlarmElement` but NOT `isAlarm`.
- The component defaults `isAlarm={false}`, so behavior is not currently broken — but the contract requires explicit passing.

## Fix Instructions

The simplest fix: pass `isAlarm={pointCtxMenu.isAlarmElement}` for now (since the current detection logic determines alarm context via `findIsAlarmElement`, which is the same signal):

In `index.tsx:1315-1320`:
```tsx
<PointContextMenu
  pointId={pointCtxMenu.pointId}
  tagName={pointCtxMenu.pointId}
  isAlarm={pointCtxMenu.isAlarmElement}        // add this line
  isAlarmElement={pointCtxMenu.isAlarmElement}
  open={true}
  onOpenChange={(open) => { if (!open) setPointCtxMenu(null) }}
>
```

If a future spec requires `isAlarm` to mean "this point is an alarm-type point" (as opposed to `isAlarmElement` which means "this element is an alarm indicator widget"), the state shape and detection logic would need updating to distinguish the two concepts. For now, using `isAlarmElement` for both is the correct interim approach.

Do NOT:
- Change the `PointContextMenu` component signature — fix the caller.
- Pass `isAlarm={true}` unconditionally — it must reflect actual alarm context.
