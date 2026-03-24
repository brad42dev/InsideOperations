---
id: DD-27-013
unit: DD-27
title: Alerts module channel adapters untestable — module crashes on load (templates.find is not a function)
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-27/CURRENT.md
---

## What to Build

The /alerts page crashes immediately on load with a TypeError: "templates.find is not a function". This prevents any verification of the DD-27-007 channel adapter implementation (SMS, Voice, Radio, PA, BrowserPush channels).

The crash occurs because `templates` is not an array when `.find()` is called on it — the API likely returns an object or null instead of an array, and the component does not guard against this.

This is the same underlying issue as DD-27-012 (Alerts module crashes on load — templates.find is not a function). The bug must be fixed before channel adapter UAT can proceed.

Root cause: In `frontend/src/pages/alerts/index.tsx` (and/or `AlertComposer.tsx`), the `templates` value from the API/store is used directly with `.find()` without ensuring it is an array first.

## Acceptance Criteria

- [ ] Navigating to /alerts renders the Alerts module without an error boundary
- [ ] The `templates` value is always treated as an array (guard against null/object/undefined)
- [ ] Alert composer opens and shows channel options: SMS, PA, Radio, Push (BrowserPush)
- [ ] Channel checkboxes are toggleable in the composer
- [ ] Alert templates tab/section renders (empty state or list)

## Verification Checklist

- [ ] Navigate to /alerts as admin → no "Alerts failed to load" error boundary
- [ ] No console TypeError "templates.find is not a function"
- [ ] Open alert composer → SMS, PA, Radio, Push channel checkboxes visible
- [ ] Toggle SMS checkbox → state changes, no error
- [ ] Navigate to templates section → renders without error

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the happy path — ensure the component handles null/empty/non-array templates response gracefully

## Dev Notes

UAT failure from 2026-03-24: /alerts crashes immediately with "templates.find is not a function" error boundary.
Screenshot: docs/uat/DD-27/fail-alerts-crash.png
Spec reference: DD-27-007 (SMS, Voice, Radio, PA, BrowserPush channel adapters), DD-27-012 (same crash — already pending)
Note: DD-27-012 is the existing tracking task for this crash. This task specifically tracks that DD-27-007 channel adapters cannot be verified until the crash is resolved.
