---
id: DD-06-014
unit: DD-06
title: Kiosk mode URL parameter is ?kiosk=true instead of spec ?mode=kiosk
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-06/CURRENT.md
---

## What to Build

The kiosk mode URL parameter does not match the spec. The spec (DD-06-002) requires `?mode=kiosk` as the URL parameter, but the implementation sets `?kiosk=true`. This means:
1. Navigating to `http://app/console?mode=kiosk` does NOT activate kiosk mode (the parameter is ignored)
2. Entering kiosk mode via the UI adds `?kiosk=true` to the URL instead of `?mode=kiosk`

UAT observation: navigating to `/console?mode=kiosk` left the sidebar and topbar fully visible. Entering kiosk mode via the user menu set the URL to `/console?kiosk=true`.

## Acceptance Criteria

- [ ] `AppShell` reads `?mode=kiosk` from `useSearchParams()` and calls `setKiosk(true)` on mount if present
- [ ] When entering kiosk mode, URL parameter added is `?mode=kiosk` (not `?kiosk=true`)
- [ ] When exiting kiosk mode, `?mode=kiosk` is removed from URL
- [ ] Navigating to any route with `?mode=kiosk` activates kiosk: sidebar hidden, topbar hidden

## Verification Checklist

- [ ] Navigate to `/console?mode=kiosk` — sidebar and topbar hide immediately on load
- [ ] Enter kiosk via user menu — URL becomes `?mode=kiosk` not `?kiosk=true`
- [ ] Press Escape — URL returns to `/console` (no `?mode=kiosk`)
- [ ] `useSearchParams()` call reads key `mode` with value `kiosk`

## Do NOT

- Do not just alias the old parameter — switch to the spec-correct `?mode=kiosk` parameter
- Do not break the Escape key exit or the user menu Enter Kiosk Mode button (both work correctly today)

## Dev Notes

UAT failure 2026-03-23: /console?mode=kiosk loaded with sidebar/topbar visible. Entering kiosk via user menu used ?kiosk=true parameter instead of ?mode=kiosk.
Spec reference: DD-06-002 — "AppShell reads ?mode=kiosk from useSearchParams()"
