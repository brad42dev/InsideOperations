---
id: DD-12-007
title: Wire PointContextMenu onto point tag displays in Forensics module
unit: DD-12
status: pending
priority: medium
depends-on: [DD-12-006]
---

## What This Feature Should Do

Every place in the Forensics module that displays a point tag name or value must trigger the shared `PointContextMenu` on right-click (desktop) or 500ms long-press (mobile). This includes point rows in the left panel, point references in trend evidence headings, and the alarm list point column.

## Spec Excerpt (verbatim)

> Right-clicking (desktop) or long-pressing 500ms (mobile) on any point-bound element opens the unified `PointContextMenu` shared component. Individual modules must NOT implement their own version.
> — SPEC_MANIFEST.md, §CX-POINT-CONTEXT, Non-negotiable #1

> **Applies to**: ALL modules that display point tag names or live/historical values — Console, Process, Dashboards, Forensics, Log, Rounds (point value readings), Alerts (alarm point references), Settings (OPC point browser).
> — SPEC_MANIFEST.md, §CX-POINT-CONTEXT

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/forensics/InvestigationWorkspace.tsx` — `PointRow` component at lines 828–875; displays point names without any context menu
- `frontend/src/pages/forensics/EvidenceRenderer.tsx` — `TrendEvidence` (lines 98–158) shows point ID labels; `AlarmListEvidence` shows `tag` column (line 197); neither wraps in PointContextMenu
- `frontend/src/shared/components/PointContextMenu.tsx` — the shared component to import

## Verification Checklist

- [ ] PointContextMenu is imported in `InvestigationWorkspace.tsx`
- [ ] `PointRow` wraps the point name span with `<PointContextMenu pointId={p.point_id} tagName={p.point_tag ?? p.point_id} isAlarm={false} isAlarmElement={false}>...</PointContextMenu>`
- [ ] Right-clicking a point row in the left panel opens the context menu
- [ ] `EvidenceRenderer.tsx` wraps point labels in TrendEvidence and AlarmListEvidence with PointContextMenu
- [ ] No forensics file implements its own custom right-click menu for points

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: No import of `PointContextMenu` exists in any file under `frontend/src/pages/forensics/`. `PointRow` (InvestigationWorkspace.tsx:828) renders a plain `<span>` with no onContextMenu handling.

## Fix Instructions

1. In `frontend/src/pages/forensics/InvestigationWorkspace.tsx`, import `PointContextMenu` from `../../shared/components/PointContextMenu`.

2. In `PointRow` (line 828), wrap the point label span:
   ```tsx
   <PointContextMenu
     pointId={point.point_id}
     tagName={point.point_tag ?? point.point_id}
     isAlarm={false}
     isAlarmElement={false}
   >
     <span style={...} title={point.point_id}>
       {point.point_name ?? point.point_tag ?? point.point_id}
     </span>
   </PointContextMenu>
   ```

3. In `frontend/src/pages/forensics/EvidenceRenderer.tsx`, wrap point ID displays in `TrendEvidence` (the series labels) and `AlarmListEvidence` (the `tag` column cell content) with `PointContextMenu`.

4. Complete DD-12-006 first (fix PointContextMenu signature) — this task depends on that being done.

Do NOT:
- Implement a custom context menu in the forensics files — always use the shared component
- Add PointContextMenu to non-point UI elements (stage names, evidence titles, etc.)
