---
id: DD-15-020
unit: DD-15
title: Import Definitions table has no seed data — right-click context menu untestable
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-15/CURRENT.md
---

## What to Build

The Import > Definitions table context menu (right-click: "Run Now", "View Run History", "Enable"/"Disable") could not be verified during UAT because the Definitions table was empty — no definition rows existed to right-click.

The spec (DD-15-018) requires: right-clicking a definition row → menu with "Run Now", "View Run History", "Enable"/"Disable".

## Acceptance Criteria

- [ ] Right-clicking a definition row on /settings/import (Definitions tab) shows a context menu
- [ ] Context menu contains "Run Now", "View Run History", and "Enable" or "Disable" items
- [ ] "Run Now" triggers an import run (or shows feedback that it was queued)

## Verification Checklist

- [ ] Navigate to /settings/import → click Definitions tab → right-click any definition row → [role="menu"] appears
- [ ] Menu items: "Run Now", "View Run History", "Enable"/"Disable" all present
- [ ] Context menu dismisses on Escape and outside-click

## Do NOT

- Do not stub the menu actions with console.log — they must invoke real API calls
- Do not skip "View Run History" — it is a required menu item per spec

## Dev Notes

UAT failure 2026-03-26: Definitions tab showed "No import definitions configured." — zero rows. Could not execute right-click to verify context menu.
Spec reference: DD-15-018 (entity right-click context menus)
