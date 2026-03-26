---
id: DD-15-022
unit: DD-15
title: Recognition models table has no seed data — right-click context menu untestable
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-15/CURRENT.md
---

## What to Build

The Recognition > Loaded Models table context menu (right-click: "View Details", "Set as Active", "View Feedback History") could not be verified during UAT because no .iomodel packages are loaded — the table showed "No models uploaded. Upload a .iomodel file to get started."

The spec (DD-15-018) requires: right-clicking a model row → menu with "View Details", "Set as Active", "View Feedback History" (no Edit item).

## Acceptance Criteria

- [ ] Right-clicking a model row on /settings/recognition shows a context menu
- [ ] Context menu contains "View Details", "Set as Active", and "View Feedback History" items
- [ ] No "Edit" item is present (spec explicitly excludes it)

## Verification Checklist

- [ ] Navigate to /settings/recognition → right-click any model row → [role="menu"] appears
- [ ] Menu items: "View Details", "Set as Active", "View Feedback History" present
- [ ] No "Edit" item in the menu
- [ ] Context menu dismisses on Escape and outside-click

## Do NOT

- Do not add an Edit item — spec explicitly says no Edit for Recognition rows
- Do not stub actions with no-ops — "Set as Active" must call the appropriate API

## Dev Notes

UAT failure 2026-03-26: Recognition page showed "No models uploaded." — zero rows. API /api/recognition/models returned 404. Could not execute right-click.
Spec reference: DD-15-018 (entity right-click context menus — Recognition.tsx)
