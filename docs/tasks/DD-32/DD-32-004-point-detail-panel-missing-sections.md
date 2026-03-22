---
id: DD-32-004
title: Implement PointDetailPanel full section layout (Alarm Data, Graphics, action buttons, resize, pin, minimize, multi-instance)
unit: DD-32
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Point Detail panel is a comprehensive floating window that shows everything I/O knows about a point. Currently it shows only the current process value and a 1-hour sparkline. The spec requires: an Alarm Data section (HH/H/L/LL thresholds, alarm count 30d, time in alarm, last 5 alarms), a Graphics section (clickable links to all graphics containing this point), and action buttons ("View in Forensics", "Open Trend"). Additionally, the panel must be resizable, support a pin toggle (update-in-place vs. open new), minimize to a compact bar, and allow up to 3 concurrent instances.

## Spec Excerpt (verbatim)

> **Built-in sections** (always available, data from I/O core tables):
> | **Alarm Data** | `alarm_definitions` + `events` + `alarm_shelving` | HH/H/L/LL thresholds, alarm count (30d), time in alarm, time shelved, last 5 alarms, last 5 shelves |
> | **Graphics** | `design_object_points` reverse lookup | All graphics containing this point, clickable links to open |
>
> **Resizable**: Drag edges/corners to resize. Default size: 400×600px. Min: 320×400px.
> **Pinnable**: Pin icon in title bar. When pinned, clicking a different point updates the panel in place. When unpinned, each point opens a new panel.
> **Minimizable**: Minimize to a compact bar showing just the point tag name. Click to re-expand.
> **Multiple instances**: Up to 3 concurrent panels for side-by-side comparison.
> — design-docs/32_SHARED_UI_COMPONENTS.md, §Point Detail Panel

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/PointDetailPanel.tsx` — entire panel implementation; body section (lines 253-326) needs Alarm Data and Graphics sections
- `frontend/src/api/points.ts` — check for alarm data API methods; may need to add `getAlarmData(pointId)` and `getLinkedGraphics(pointId)`

## Verification Checklist

- [ ] Panel default size is 400×600px (currently 320px wide, no height constraint)
- [ ] Resize handles exist on all 4 edges and corners; dragging them updates panel width/height with a 320×400px minimum
- [ ] Title bar has a pin icon button; pin state toggles between "open new panel" and "update in place" mode
- [ ] A minimize button in the title bar collapses the panel to a ~32px tall compact bar showing only the tag name
- [ ] Alarm Data section is rendered with: HH/H/L/LL threshold values, alarm count (30d), time in alarm (minutes/hours), and last 5 alarm events as a list
- [ ] Graphics section shows a list of graphic names that contain this point, each as a clickable link that navigates to that graphic
- [ ] "View in Forensics" and "Open Trend" action buttons are rendered at the bottom of the panel
- [ ] Up to 3 panels can be open simultaneously; attempting to open a 4th shows a prompt

## Assessment

- **Status**: ❌ Missing — panel body (PointDetailPanel.tsx:253-326) only renders current value, description, and 1-hour sparkline; all other sections and interactive window features are absent

## Fix Instructions

**Section additions** (in `PointDetailPanel.tsx` body, after the sparkline block around line 306):

1. **Alarm Data section**: Add a `useQuery` for alarm thresholds via `/api/v1/points/{id}/alarms` (or similar endpoint). Render a collapsible section showing: threshold table (HH/H/L/LL), alarm count last 30d, time in alarm, and a list of the last 5 alarm events (timestamp, value, priority). Each section should have its own loading spinner for independent parallel loading.

2. **Graphics section**: Add a `useQuery` for `/api/v1/points/{id}/graphics` (reverse lookup against `design_object_points`). Render as a list of clickable graphic names. Clicking navigates to the Console or Process page for that graphic.

3. **Action buttons**: Before the point ID footer, add two buttons: `[View in Forensics]` — navigates to `/forensics?point={pointId}`. `[Open Trend]` — opens a trend for the point (navigate to `/console?trend={pointId}` or open an inline trend modal).

**Window behavior additions**:

4. **Resize**: Add `resizing` state. For each edge/corner, add a `<div>` positioned absolutely with appropriate cursor style and `onMouseDown` handler that tracks dx/dy and updates panel width/height state. Enforce `min: { width: 320, height: 400 }`.

5. **Pin toggle**: Add `isPinned` state. Add a pin button (📌) in the title bar. When pinned, the parent component that controls `pointId` should update it in place rather than opening a new panel.

6. **Minimize**: Add `isMinimized` state. When true, render only the header bar (no body). The header compact mode shows the tag name only.

7. **Multi-instance**: This is managed by the parent (e.g., AppShell or module). The panel itself only needs a unique `instanceId` prop. Parent maintains an array of up to 3 open `{ instanceId, pointId }` entries.

Do NOT:
- Remove the existing draggable behaviour (lines 141-158) — it is correct
- Make API calls mandatory for sections — sections with failed/loading data must gracefully show "Unable to load [Retry]"
- Add the section builder UI (Settings > Integrations > Point Detail) at this stage — that is a Settings module feature
