---
id: MOD-DESIGNER-036
unit: MOD-DESIGNER
title: "View Alerts" missing from display element point context menu
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

When right-clicking a display element on the Designer canvas, the context menu is missing the "View Alerts" (or equivalent) CX-POINT-CONTEXT item. The spec requires three point-context items: Open Trend, View Detail, and View Alerts.

**Observed in UAT (2026-03-24):** Right-clicking a Text Readout display element on canvas produced a full context menu. The following point-context items were found (disabled, as expected for unbound element):
- "Trend This Point" ✅ (= Open Trend equivalent)
- "Point Detail" ✅ (= View Detail equivalent)
- "Investigate Point" (forensics — not alerts)
- "Report on Point" (reports — not alerts)
- "Copy Tag Name"

**Missing:** No "View Alerts", "Alerts", "Active Alarms", or any alerts-related item was found.

**Expected behavior:** The context menu for display elements should include an "Alerts" / "View Alerts" item (disabled when unbound, enabled when bound to a point) per CX-POINT-CONTEXT spec.

## Acceptance Criteria

- [ ] Right-clicking a display element shows a context menu containing "View Alerts" or equivalent (e.g., "Active Alarms", "Alerts for Point")
- [ ] The "View Alerts" item is disabled when the element is unbound (no point ID)
- [ ] The "View Alerts" item is enabled when the element is bound to a point
- [ ] "Trend This Point" (Open Trend) and "Point Detail" (View Detail) continue to be present
- [ ] "Bind Point…" and "Change Type" continue to be present

## Verification Checklist

- [ ] Navigate to /designer/graphics/new, create a graphic
- [ ] Drag a Text Readout display element from palette to canvas
- [ ] Right-click the display element
- [ ] Confirm context menu contains an alerts-related item ("View Alerts", "Alerts", "Active Alarms for Point", or per-spec equivalent)
- [ ] Confirm item is disabled (no binding) but visible
- [ ] Confirm "Trend This Point", "Point Detail", "Bind Point…", "Change Type" all still present

## Do NOT

- Do not remove the existing "Investigate Point" or "Report on Point" items — only add the missing alerts item
- Do not make the item always disabled — it should be enabled when a point is bound

## Dev Notes

UAT failure 2026-03-24: Screenshot at .playwright-mcp/page-2026-03-24T19-19-33-952Z.png shows context menu without any alerts item. Menu had 30+ items including Investigate Point, Report on Point, Copy Tag Name — all CX-POINT-CONTEXT forensics/reports items — but no alerts item.
Spec references: MOD-DESIGNER-009 (PointContextMenu wiring, uat_status=fail), MOD-DESIGNER-033 (prior UAT bug task for same issue), CX-POINT-CONTEXT spec
