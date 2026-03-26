---
id: DD-13-032
unit: DD-13
title: Re-verify DD-13-025 — POST /api/logs/instances blocked by crash cascade
status: pending
priority: high
depends-on: ["DD-13-031"]
source: uat
uat_session: docs/uat/DD-13/CURRENT.md
---

## What to Build

This is a re-verification task. DD-13-025 (POST /api/logs/instances returns 500) has been marked verified, but UAT could not confirm it because the /log/new route crashes the browser after the /log/templates crash cascade (browser_error — crash_streak=3).

Fix DD-13-031 first, then re-run this UAT scenario:
1. Navigate to /log/new
2. Select a template from dropdown
3. Click "Start Entry"
4. Verify: no 500 error, navigates to a log instance editor

## Acceptance Criteria

- [ ] /log/new loads without crash (depends on DD-13-031 being fixed)
- [ ] Selecting a template and clicking "Start Entry" creates a log instance (201 response)
- [ ] No error boundary shown after submission
- [ ] Navigates to the created log instance editor

## Verification Checklist

- [ ] Navigate to /log/new (confirm no crash)
- [ ] Select "Test Template" from dropdown
- [ ] Click "Start Entry"
- [ ] Confirm navigation to /log/{instance-id} (not an error page)
- [ ] Check browser console — no 500 errors

## Dev Notes

UAT failure 2026-03-26: Scenario 6 — browser_error crash_streak=3 prevented testing.
Underlying fix DD-13-025 has status=verified but UAT remains unconfirmed.
Depends on DD-13-031 (/log/templates route crash fix) before this can be tested.
