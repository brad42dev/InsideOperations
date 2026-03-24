---
id: DD-31-018
unit: DD-31
title: Management tab crashes — "templates.map is not a function"
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-31/CURRENT.md
---

## What to Build

Clicking the "Management" tab in /alerts triggers an error boundary: "Alerts failed to load / templates.map is not a function". The crash is thrown from the Templates section of the Management view, which calls `.map()` on the `templates` variable before it has been confirmed to be an array.

This is a regression from DD-31-017 (which fixed `.find` but not `.map`), and is also related to DD-31-003 (template variable type change from string[] to struct). The Management tab is completely inaccessible — neither the Templates sub-section nor the Muster dashboard (also in Management) can be reached.

## Acceptance Criteria

- [ ] Clicking the "Management" tab does NOT trigger an error boundary
- [ ] Templates list is visible (or empty state shown) without a crash
- [ ] Muster dashboard section is reachable within the Management tab
- [ ] `templates` variable is guaranteed to be an array before `.map()`, `.find()`, or any array method is called

## Verification Checklist

- [ ] Navigate to /alerts → click "Management" tab → no "templates.map is not a function" error boundary
- [ ] Template list or empty state "No templates" is visible
- [ ] Muster section (if present in Management) is reachable without crash
- [ ] Browser console has no TypeError for templates array methods

## Do NOT

- Do not stub with a TODO — the crash needs to be resolved so the tab is usable
- Do not only fix `.map` — ensure `.find`, `.filter`, and all other array methods on `templates` are safe

## Dev Notes

UAT failure 2026-03-24: clicking Management tab throws "templates.map is not a function" immediately. Error boundary displayed: "Alerts failed to load". Screenshot: docs/uat/DD-31/fail-management-tab-crash.png
Spec reference: DD-31-003 (template variable struct change), DD-31-017 (fix templates.find crash)
