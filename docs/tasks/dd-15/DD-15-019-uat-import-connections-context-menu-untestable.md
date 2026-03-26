---
id: DD-15-019
unit: DD-15
title: Import Connections table has no seed data — right-click context menu untestable
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-15/CURRENT.md
---

## What to Build

The Import > Connections table context menu (right-click: "Test Connection", "Enable"/"Disable", "Delete") could not be verified during UAT because the Connections table was empty — no connection rows existed to right-click.

Two things are needed:
1. Confirm the right-click context menu is actually wired up on connection rows (not just an empty container).
2. Add at least one sample/seed connection entry (or a test helper) so the UAT scenario can be executed.

The spec (DD-15-018) requires: right-clicking a connection row → menu with "Test Connection", "Enable"/"Disable" toggle, "Delete" (grayed if definitions reference it).

## Acceptance Criteria

- [ ] Right-clicking a connection row on /settings/import (Connections tab) shows a context menu
- [ ] Context menu contains "Test Connection", "Enable" or "Disable", and "Delete" items
- [ ] "Delete" is grayed/disabled when definitions reference the connection

## Verification Checklist

- [ ] Navigate to /settings/import → click Connections tab → right-click any connection row → [role="menu"] appears
- [ ] Menu items: "Test Connection", "Enable"/"Disable", "Delete" all present
- [ ] Context menu dismisses on Escape and outside-click

## Do NOT

- Do not stub the context menu handler — it must perform the real action
- Do not add a connection row only in frontend state — it must persist via the API

## Dev Notes

UAT failure 2026-03-26: Connections tab showed "No connections configured yet." — zero rows. Could not execute right-click to verify context menu exists or has correct items.
Spec reference: DD-15-018 (entity right-click context menus)
