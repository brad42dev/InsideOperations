---
id: DD-13-018
title: Wire PointContextMenu onto point rows in PointDataSegment (CX-POINT-CONTEXT)
unit: DD-13
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The point data section of a log entry displays live OPC point values. Operators must be able to right-click (or long-press on mobile) any point row to access the canonical point context menu — Trend This Point, Point Detail, Investigate Point, etc. Currently the rows are plain table rows with no context menu behavior.

## Spec Excerpt (verbatim)

> CX-POINT-CONTEXT applies to: ALL modules that display point tag names or live/historical values — Console, Process, Dashboards, Forensics, Log, Rounds (point value readings), Alerts (alarm point references), Settings (OPC point browser).
> — docs/SPEC_MANIFEST.md, §CX-POINT-CONTEXT

> Right-clicking (desktop) or long-pressing 500ms (mobile) on any point-bound element opens the unified PointContextMenu shared component. Individual modules must NOT implement their own version.
> — docs/SPEC_MANIFEST.md, §CX-POINT-CONTEXT, Non-negotiable #1

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/log/LogEditor.tsx:419–461` — `PointDataSegment` component; point rows rendered in a `<tr>` per point ID with no context menu handler
- `frontend/src/shared/components/PointContextMenu.tsx` — shared component to import and use

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `PointContextMenu` is imported from `../../shared/components/PointContextMenu` in LogEditor.tsx.
- [ ] Each point row in `PointDataSegment` (LogEditor.tsx:445–456) has an `onContextMenu` handler that opens `PointContextMenu` with `pointId` and `tagName` props.
- [ ] `PointContextMenu` is rendered with all required props: `pointId`, `tagName`, `isAlarm`, `isAlarmElement`.
- [ ] Long-press (500ms) support is present for mobile (either built into PointContextMenu or added via a touch handler on each row).

## Assessment

After checking:
- **Status**: ❌ Missing — `PointDataSegment` renders point IDs and values in a `<tr>` loop (LogEditor.tsx:445) with zero context menu wiring. `PointContextMenu` is never imported in the log module.

## Fix Instructions

In `frontend/src/pages/log/LogEditor.tsx`:

**Step 1 — Import shared component** (add after line 16):
```ts
import PointContextMenu from '../../shared/components/PointContextMenu'
```

**Step 2 — Add context menu state** to `PointDataSegment` (currently a stateless function at line 419). Convert to use `useState` for the open/position/target state, or use whatever pattern `PointContextMenu` exposes (check PointContextMenu.tsx for its API — it may use a portal or an imperative open function).

**Step 3 — Wire `onContextMenu`** on each point row `<tr>` at LogEditor.tsx:448:
```tsx
<tr
  key={pid}
  onContextMenu={(e) => { e.preventDefault(); openContextMenu(pid) }}
  style={...}
>
```

**Step 4 — Render `PointContextMenu`** somewhere in `PointDataSegment`'s output, passing:
- `pointId={pid}`
- `tagName={pid}` (tag name is the same as the point ID string in PointDataSegment; if the API returns a separate `tag_name`, use that)
- `isAlarm={false}`
- `isAlarmElement={false}`

Do NOT:
- Implement a custom context menu instead of using the shared `PointContextMenu` component. The contract explicitly prohibits per-module implementations.
- Add the context menu to the column header rows — only the data rows per point ID.
