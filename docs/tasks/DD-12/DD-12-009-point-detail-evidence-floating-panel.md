---
id: DD-12-009
title: Implement point_detail evidence type using the floating PointDetailPanel scoped to stage time range
unit: DD-12
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The `point_detail` evidence type in a stage should render the shared floating `PointDetailPanel` component scoped to the stage's time range — not a static label with a link. The panel shows alarms, work orders, and tickets for the selected point during the stage's time window, as it existed during that period (versioned metadata).

## Spec Excerpt (verbatim)

> **Point Detail**: Point Detail panel (doc 32) scoped to the stage's time range — alarms, work orders, tickets, etc. from that window, not from "now".
> — 12_FORENSICS_MODULE.md, §Evidence Toolkit > Available Evidence Items

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/forensics/EvidenceRenderer.tsx` — `point_detail` case at lines 643–676: renders static text + link to Process page, not the PointDetailPanel
- `frontend/src/shared/components/PointDetailPanel.tsx` — the shared floating panel component; check its props for time-range scoping

## Verification Checklist

- [ ] `point_detail` evidence renders `PointDetailPanel` (or equivalent inline version) scoped to `stageStart`/`stageEnd`
- [ ] The panel shows historical data for the stage's time range, not current live data
- [ ] Point alarms, work orders, and tickets within the stage window are displayed
- [ ] The evidence card header still shows "Point Detail" with the point ID

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: EvidenceRenderer.tsx lines 643–676: renders a static div with point ID, "Last value: —" text, and a link to `/process?highlight=...`. This is not the PointDetailPanel and shows no historical data scoped to the stage.

## Fix Instructions

In `frontend/src/pages/forensics/EvidenceRenderer.tsx`, update the `point_detail` case in `renderBody()` (lines 643–676):

1. Import `PointDetailPanel` from `../../shared/components/PointDetailPanel`.

2. Replace the static display with the actual panel, passing the stage's time range:
   ```tsx
   case 'point_detail': {
     const pointId = item.config.point_id as string | undefined
     if (!pointId) return <span style={{ color: 'var(--io-text-muted)' }}>No point configured.</span>
     return (
       <PointDetailPanel
         pointId={pointId}
         startTime={stageStart}
         endTime={stageEnd}
         inline={true}  // Embedded in evidence card, not floating
       />
     )
   }
   ```

3. If `PointDetailPanel` does not yet support `inline` mode or time-range scoping, add those props — the panel must render inline within the evidence card (not as a floating window, since it is evidence content) and accept `startTime`/`endTime` to scope its data queries.

4. The API call inside PointDetailPanel (or a new `InlinePointDetail` component) should use `GET /api/v1/points/:id/detail?start=...&end=...` to scope alarms and events to the stage window.

Do NOT:
- Keep the link to the Process page — that link is useless for a closed investigation and does not show time-scoped data
- Open the full floating panel (which is for the shell-level CX-POINT-DETAIL contract) — this evidence type needs an inline embedded version
