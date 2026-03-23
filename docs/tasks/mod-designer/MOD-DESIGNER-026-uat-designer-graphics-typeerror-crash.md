---
id: MOD-DESIGNER-026
unit: MOD-DESIGNER
title: Designer graphics list crashes with TypeError reading 'slice' on load
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

Navigating to /designer/graphics causes an immediate crash: "Cannot read properties of undefined (reading 'slice')". The DesignerGraphics component attempts to call .slice() on a data property that is undefined before the API response arrives.

The dashboard editor (/designer/dashboards/new) works correctly — this crash is specific to the graphics list page.

## Acceptance Criteria

- [ ] Navigating to /designer/graphics no longer shows "Designer failed to load" error boundary
- [ ] The graphics list page renders (empty state or list)
- [ ] The .slice() call is guarded with a default value ([] or similar)

## Verification Checklist

- [ ] Navigate to /designer/graphics → page loads without error
- [ ] "New Graphic" button is accessible
- [ ] Creating a new graphic opens the graphic editor canvas

## Do NOT

- Do not stub this with a TODO comment
- Do not only fix the symptom — find all undefined array accesses in the graphics components

## Dev Notes

UAT failure 2026-03-23: /designer/graphics crashes with TypeError: Cannot read properties of undefined (reading 'slice') in DesignerGraphicsPage component. Error boundary shows "Reload Designer" (should be "Reload Module"). Dashboard editor works fine — only the graphics list crashes.
