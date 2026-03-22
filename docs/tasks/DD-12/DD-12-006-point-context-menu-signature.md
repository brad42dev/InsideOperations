---
id: DD-12-006
title: Fix PointContextMenu to include tagName, isAlarm, isAlarmElement props per CX-POINT-CONTEXT spec
unit: DD-12
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The shared `PointContextMenu` component must accept the four required props specified by CX-POINT-CONTEXT: `pointId`, `tagName`, `isAlarm`, and `isAlarmElement`. This is the canonical signature all modules must call — a component missing these props cannot be correctly wired up for alarm-aware menu items like "Investigate Alarm".

## Spec Excerpt (verbatim)

> The component signature is `PointContextMenu({ pointId, tagName, isAlarm, isAlarmElement })`. Callers must pass all four props.
> — SPEC_MANIFEST.md, §CX-POINT-CONTEXT, Non-negotiable #2

> "Investigate Alarm" item missing, or present unconditionally regardless of `isAlarm`/`isAlarmElement`
> — SPEC_MANIFEST.md, §CX-POINT-CONTEXT, Known false-DONE patterns

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/PointContextMenu.tsx` — current props interface at lines 5–10; missing `tagName`, `isAlarm`, `isAlarmElement`
- All callers of `PointContextMenu` in the codebase — update each after fixing the signature

## Verification Checklist

- [ ] `PointContextMenuProps` at line 5 includes `tagName: string`, `isAlarm: boolean`, `isAlarmElement: boolean`
- [ ] "Investigate Alarm" menu item appears only when `isAlarm === true`
- [ ] "Investigate Point" menu item appears unconditionally (no permission gate)
- [ ] `tagName` is used in the "Copy Tag Name" menu item
- [ ] All existing callers of `PointContextMenu` compile without TypeScript errors after the signature change

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: PointContextMenu.tsx props interface (lines 5–10) only declares `pointId`, `children`, `onViewDetail?`, `onAddToTrend?`. The three required props `tagName`, `isAlarm`, `isAlarmElement` are absent. The menu has no "Investigate Alarm" or "Investigate Point" items and no "Copy Tag Name" item using a `tagName`.

## Fix Instructions

In `frontend/src/shared/components/PointContextMenu.tsx`:

1. Update `PointContextMenuProps` to add required props:
   ```ts
   export interface PointContextMenuProps {
     pointId: string
     tagName: string
     isAlarm: boolean
     isAlarmElement: boolean
     children: React.ReactNode
     onViewDetail?: (pointId: string) => void
     onAddToTrend?: (pointId: string) => void
   }
   ```

2. Update the component signature to destructure the new props.

3. Add canonical menu items in the specified order:
   - "Copy Tag Name" — always present; calls `navigator.clipboard.writeText(tagName)`
   - "View History" — always present; navigates to `/forensics?point=...`
   - "View Point Detail" — always present; triggers PointDetailPanel
   - "Trend This Point" — always present; no permission gate
   - "Investigate Alarm" — only when `isAlarm === true`; navigates to `/forensics/new?alarm=...`
   - "Investigate Point" — always present; navigates to `/forensics/new?point=...`

4. After updating the signature, fix TypeScript errors in all callers (e.g., Console, Process, Dashboards components).

Do NOT:
- Gate "Trend This Point" or "Investigate Point" behind any permission
- Show "Investigate Alarm" when `isAlarm` is false
- Disable menu items — missing-permission items must be hidden entirely
