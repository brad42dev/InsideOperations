---
id: MOD-CONSOLE-007
title: Fix PointContextMenu item order and remove non-spec "View History" item
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The PointContextMenu must present items in the exact canonical order specified: Point Detail → Trend This Point → separator → Investigate Point → Report on Point → conditional separator → Investigate Alarm (only when alarm) → separator → Copy Tag Name. The current implementation has a non-spec "View History" item and a different order.

## Spec Excerpt (verbatim)

> **Canonical items** (in order):
> - **Point Detail** — always visible, no permission required. `openPointDetail(pointId)`.
> - **Trend This Point** — always visible, no permission required. Opens full-screen trend (24h default).
> - *Separator*
> - **Investigate Point** — hidden (not grayed) when user lacks `forensics:read`.
> - **Report on Point** — hidden (not grayed) when user lacks `reports:read`.
> - *Separator* — only rendered when `isAlarm || isAlarmElement`
> - **Investigate Alarm** — only rendered when `isAlarm || isAlarmElement`. Hidden if user lacks `forensics:read`.
> - *Separator*
> - **Copy Tag Name** — always visible. Copies full tag name to system clipboard.
> — SPEC_MANIFEST.md, §CX-POINT-CONTEXT Non-negotiables #3

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/PointContextMenu.tsx` — lines 109-191 contain all menu items

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] First item: "Point Detail" (always visible, no permission gate)
- [ ] Second item: "Trend This Point" (always visible, no permission gate)
- [ ] Separator after Trend This Point
- [ ] "Investigate Point" — gated on `canForensics`, hidden when false
- [ ] "Report on Point" — gated on `canReports`, hidden when false
- [ ] Separator + "Investigate Alarm" only rendered when `isAlarm || isAlarmElement`; also gated on `canForensics`
- [ ] Final separator then "Copy Tag Name" always visible
- [ ] "View History" item is NOT present
- [ ] No items are grayed/disabled — they must be hidden (not rendered) when permission is absent

## Assessment

Current state at `PointContextMenu.tsx:109-191`:
1. Copy Tag Name (should be last)
2. View History (non-spec extra item)
3. View Point Detail (correct but wrong position)
4. Trend This Point (correct but wrong position)
5. Investigate Alarm (conditional — correct)
6. Investigate Point (gated — correct but wrong position)
7. Report on Point (gated — correct but wrong position)

"View History" navigates to `/forensics?point=...` which is equivalent to Investigate Point. It should be removed or merged.

## Fix Instructions

1. In `frontend/src/shared/components/PointContextMenu.tsx`, reorder the `DropdownMenu.Content` children to match the canonical spec order:

   ```tsx
   {/* 1. Point Detail — always visible */}
   <DropdownMenu.Item onSelect={() => onViewDetail?.(pointId)}>Point Detail</DropdownMenu.Item>

   {/* 2. Trend This Point — always visible */}
   <DropdownMenu.Item onSelect={() => onAddToTrend?.(pointId)}>Trend This Point</DropdownMenu.Item>

   <DropdownMenu.Separator />

   {/* 3. Investigate Point — hidden without forensics:read */}
   {canForensics && <DropdownMenu.Item onSelect={handleInvestigatePoint}>Investigate Point</DropdownMenu.Item>}

   {/* 4. Report on Point — hidden without reports:read */}
   {canReports && <DropdownMenu.Item onSelect={handleReportOnPoint}>Report on Point</DropdownMenu.Item>}

   {/* 5. Investigate Alarm — only when isAlarm/isAlarmElement and user has forensics:read */}
   {(isAlarm || isAlarmElement) && canForensics && (
     <>
       <DropdownMenu.Separator />
       <DropdownMenu.Item onSelect={handleInvestigateAlarm}>Investigate Alarm</DropdownMenu.Item>
     </>
   )}

   <DropdownMenu.Separator />

   {/* 6. Copy Tag Name — always last */}
   <DropdownMenu.Item onSelect={() => { void handleCopyTagName() }}>Copy Tag Name</DropdownMenu.Item>
   ```

2. Remove the "View History" item (`handleViewHistory` and its menu entry at lines 120-128). Its `handleViewHistory` callback (line 61-63) navigates to the same forensics route as `handleInvestigatePoint` — they are duplicates.

3. Remove the `handleViewHistory` function and its `useCallback` if no other references exist.

Do NOT:
- Change the `PointContextMenu` component props or callers — the fix is purely internal item ordering
- Gate "Point Detail" or "Trend This Point" on any permission
- Gray out items — hidden is correct for permission-lacking items in this menu
