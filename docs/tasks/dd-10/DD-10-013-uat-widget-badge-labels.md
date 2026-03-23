---
id: DD-10-013
unit: DD-10
title: Dashboard widgets render as type-label badges instead of actual widget content
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-10/CURRENT.md
---

## What to Build

Dashboard widgets at /dashboards/{id} are showing raw type-label badges (e.g., "alarm-kpi", "opc-status", "shift-info", "area-status-table") instead of rendering actual widget UI content. The widget container renders but the widget component inside shows its type identifier as plain text rather than the actual visualization.

## Acceptance Criteria

- [ ] Widgets render actual visual content (alarm count, OPC status indicator, shift info, etc.) not type-name badges
- [ ] Empty/loading state is shown when no backend data, not the type string
- [ ] Dashboard at /dashboards/{id} loads widget components correctly

## Verification Checklist

- [ ] Navigate to /dashboards, open Operations Overview
- [ ] Confirm widgets show real UI (alarm counts, status indicators) or proper empty/loading states
- [ ] No widget shows a raw type string like "alarm-kpi" or "opc-status" as visible text content

## Do NOT

- Do not stub widget rendering with a type-name badge as placeholder
- Do not leave TODO placeholders in widget render methods

## Dev Notes

UAT failure 2026-03-23: Opening Operations Overview dashboard shows widgets labeled with their type strings ("alarm-kpi", "opc-status", "shift-info", "area-status-table") instead of rendered widget components.
Spec reference: DD-10-011, DD-10-012
