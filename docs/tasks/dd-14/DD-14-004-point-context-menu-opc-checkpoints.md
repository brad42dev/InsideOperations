---
id: DD-14-004
title: Wire PointContextMenu on OPC-bound checkpoint value displays in RoundPlayer
unit: DD-14
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When a checkpoint has an `opc_point_id` binding, the checkpoint value display in RoundPlayer must support right-click (desktop) or 500ms long-press (mobile) to open the shared `PointContextMenu` component. This gives the operator direct access to Point Detail, Trend This Point, and other shared actions without leaving the round.

## Spec Excerpt (verbatim)

> Right-clicking (desktop) or long-pressing 500ms (mobile) on any point-bound element opens the unified `PointContextMenu` shared component. Individual modules must NOT implement their own version.
> — docs/SPEC_MANIFEST.md, §CX-POINT-CONTEXT Non-negotiables #1

> **Applies to**: ALL modules that display point tag names or live/historical values — ... Rounds (point value readings) ...
> — docs/SPEC_MANIFEST.md, §CX-POINT-CONTEXT

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/rounds/RoundPlayer.tsx` — CheckpointInput component (lines 513-833); the numeric input at line 641-663 and the OPC point display area are where PointContextMenu should attach
- `frontend/src/shared/components/PointContextMenu.tsx` — the shared component to use; check its props signature: `PointContextMenu({ pointId, tagName, isAlarm, isAlarmElement })`
- `frontend/src/api/rounds.ts` — Checkpoint type; `opc_point_id` field tells us when a checkpoint has a live point binding

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] CheckpointInput imports and uses `PointContextMenu` from the shared component
- [ ] The context menu trigger wraps the checkpoint value input/display area when `checkpoint.opc_point_id` is set
- [ ] Right-click on the value area opens the unified PointContextMenu (not a custom menu)
- [ ] 500ms long-press on mobile also opens the menu
- [ ] The `pointId` prop is set to `checkpoint.opc_point_id`
- [ ] `isAlarm` and `isAlarmElement` props are passed (can default to `false` for checkpoint context)

## Assessment

After checking:
- **Status**: ❌ Missing
- **What's missing**: CheckpointInput in RoundPlayer.tsx has no PointContextMenu import, no onContextMenu handler, no long-press handler. The `opc_point_id` field is available on the `Checkpoint` type and visible at runtime but never used to trigger a context menu.

## Fix Instructions (if needed)

In `frontend/src/pages/rounds/RoundPlayer.tsx`:

1. Import `PointContextMenu` from the shared component location. Check `frontend/src/shared/components/PointContextMenu.tsx` for the exact import path and component signature.

2. In `CheckpointInput`, when `checkpoint.opc_point_id` is set, wrap the value display area with the PointContextMenu trigger. The numeric input at line 641 is the primary target — wrap its containing `<div>` with a ContextMenu.Root or use the onContextMenu prop pattern that PointContextMenu supports.

3. Pass the required props:
   ```tsx
   <PointContextMenu
     pointId={checkpoint.opc_point_id}
     tagName={checkpoint.opc_point_id}  // or fetch tag name if available
     isAlarm={false}
     isAlarmElement={false}
   >
     {/* the value input */}
   </PointContextMenu>
   ```

4. For mobile long-press, follow the same pattern used elsewhere in the codebase (check for a `useLongPress` hook or implement one: set a 500ms timeout on `onTouchStart`, cancel on `onTouchEnd`/`onTouchMove`).

Do NOT:
- Implement a custom point context menu — use only the shared `PointContextMenu` component
- Show the context menu when `checkpoint.opc_point_id` is null or empty
- Add this to checkpoints without OPC binding (text-only checkpoints have no point to context-menu on)
