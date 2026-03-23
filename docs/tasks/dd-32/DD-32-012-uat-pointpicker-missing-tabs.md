---
id: DD-32-012
unit: DD-32
title: PointPicker is plain text input — missing Browse/Search/Favorites tab interface
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-32/CURRENT.md
---

## What to Build

The PointPicker component in dashboard widget config is implemented as a plain text input with "Search points..." placeholder. The spec requires a tabbed point picker interface with Browse (tree/hierarchy view), Search (text search), and Favorites (saved/starred points) tabs.

## Acceptance Criteria

- [ ] PointPicker opens as a modal/popover with at minimum: Browse, Search, and Favorites tabs
- [ ] Favorites tab shows points the user has starred/saved
- [ ] Browse tab shows the OPC point hierarchy
- [ ] Search tab allows text search across point names/tags

## Verification Checklist

- [ ] In /designer/dashboards/{id}/edit, open a KPI widget via ⋯ → Edit
- [ ] Click the Metric / point picker field
- [ ] Confirm a tabbed picker UI appears with Browse, Search, Favorites tabs
- [ ] Favorites tab is visible alongside Browse and Search tabs

## Do NOT

- Do not leave the picker as a plain text input
- Do not implement only Search — all three tabs are required

## Dev Notes

UAT failure 2026-03-23: Widget Config "Metric" field is a plain text input with placeholder "Search points...". No tabbed picker appears when clicking the field.
Spec reference: DD-32-006
