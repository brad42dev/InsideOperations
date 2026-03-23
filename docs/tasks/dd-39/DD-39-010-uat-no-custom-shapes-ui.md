---
id: DD-39-010
unit: DD-39
title: No custom shapes management UI — Symbol Library shows only built-in ISA-101 categories
status: pending
priority: medium
depends-on: []
source: uat
uat_session: docs/uat/DD-39/CURRENT.md
---

## What to Build

The Symbol Library at /designer/symbols shows only built-in ISA-101 shape categories
(Vessels, Pumps, Valves, Heat Exchangers, Columns, Compressors, Instruments, Piping).
There is no "Custom", "My Shapes", or "User Shapes" section where users can view,
manage, or upload their own custom shapes.

This means the DD-39-006 feature (shape.json sidecar export alongside shape.svg for
custom shapes) cannot be verified via browser UAT — there are no custom shapes to
export in the first place.

Custom shapes are user-created SVG shapes that can be used in process graphics. They
should appear in a dedicated section of the Symbol Library or the Designer canvas
palette alongside the built-in ISA-101 shapes.

## Acceptance Criteria

- [ ] A "Custom Shapes" or "My Shapes" section appears in the Symbol Library or Designer canvas palette
- [ ] Users can view custom shapes they have uploaded or created
- [ ] Custom shapes can be used in process graphics (drag-to-canvas from palette)
- [ ] When a graphic containing custom shapes is exported as .iographic, the ZIP includes a shape.json sidecar alongside each custom shape's SVG file

## Verification Checklist

- [ ] Navigate to /designer/symbols — confirm a "Custom" or user shapes section is visible
- [ ] If no custom shapes exist, an empty state ("No custom shapes yet") is shown, not just hidden
- [ ] Upload or create a custom shape — it appears in the custom section
- [ ] Export a graphic using a custom shape as .iographic — verify the ZIP contains both shape.svg and shape.json

## Do NOT

- Do not hide the custom shapes section entirely when empty — show an empty state
- Do not implement only the Symbol Library browse page — the canvas palette must also show custom shapes

## Dev Notes

UAT failure from 2026-03-23: Symbol Library at /designer/symbols shows only 8 built-in
categories with no mechanism to add or view custom/user shapes. The page also shows a
note: "The full interactive symbol browser with SVG preview, drag-to-canvas, and search
will be available in a future release."
Spec reference: DD-39-001, DD-39-006 (shape export with sidecar)
