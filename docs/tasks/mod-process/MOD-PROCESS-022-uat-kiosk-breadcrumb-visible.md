---
id: MOD-PROCESS-022
unit: MOD-PROCESS
title: Kiosk mode leaves breadcrumb nav bar ("Process" header) visible
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-PROCESS/CURRENT.md
---

## What to Build

When navigating to /process?kiosk=true, a thin bar at the top of the page showing the
heading "Process" remains visible. This breadcrumb/module nav bar should be hidden in
kiosk mode per the spec.

Currently in kiosk mode:
- ✅ Left sidebar hidden
- ✅ View toolbar (zoom, Live/Historical, Export, Print) hidden
- ✅ Status bar hidden
- ✅ App shell top bar (search, alerts, user buttons) hidden
- ❌ Module-level breadcrumb bar (banner with "Process" heading) still visible

Spec reference: MOD-PROCESS-019 (Hide breadcrumb nav bar and view toolbar in kiosk mode)

## Acceptance Criteria

- [ ] Navigating to /process?kiosk=true renders NO breadcrumb/module nav bar at the top
- [ ] The canvas fills the full viewport height in kiosk mode (no header gap)
- [ ] Sidebar remains hidden (already correct — do not break)
- [ ] View toolbar remains hidden (already correct — do not break)

## Verification Checklist

- [ ] Navigate to /process?kiosk=true — confirm no "Process" heading bar visible at top
- [ ] Screenshot shows full-bleed canvas from top to bottom with no header bar
- [ ] Pressing Escape exits kiosk mode and restores all hidden elements

## Do NOT

- Do not hide the kiosk exit button/mechanism (Escape still needs to work)
- Do not break the already-working kiosk sidebar/toolbar hiding

## Dev Notes

UAT failure 2026-03-26: Screenshot s8-kiosk-breadcrumb-present.png shows a thin bar
at the very top displaying "Process" text in kiosk mode. The banner (HTML <header> or
equivalent) is still rendered — only its inner content (search/alerts/user) was hidden.
The entire banner element must not render in kiosk mode.
Spec reference: MOD-PROCESS-019
