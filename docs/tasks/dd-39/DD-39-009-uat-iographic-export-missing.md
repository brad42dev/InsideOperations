---
id: DD-39-009
unit: DD-39
title: No .iographic file export option in Designer — Save persists to DB only
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-39/CURRENT.md
---

## What to Build

The Designer dashboard editor has no export or download option for the .iographic portable format. The toolbar only shows Variables, Published toggle, Cancel, Save — and Save persists to the database. There is no way to export a graphic as a portable .iographic file (ZIP container with SVG + metadata).

## Acceptance Criteria

- [ ] Export option accessible from the designer dashboard editor (e.g., File menu, Export button, or ⋯ menu)
- [ ] Export produces a downloadable .iographic file (ZIP format per spec)
- [ ] Exported file contains the graphic definition in a portable format

## Verification Checklist

- [ ] Open a dashboard in /designer/dashboards/{id}/edit
- [ ] Confirm Export or Download button visible in toolbar or menu
- [ ] Click Export — confirm file download initiates (not a silent no-op)
- [ ] Downloaded file has .iographic extension

## Do NOT

- Do not implement only "Save to DB" — the portable export format is required

## Dev Notes

UAT failure 2026-03-23: Dashboard editor toolbar shows Variables/Published/Cancel/Save only. No Export or Download button found. /designer/dashboards/{id} detail page returns 404.
Spec reference: DD-39-002, DD-39-005
