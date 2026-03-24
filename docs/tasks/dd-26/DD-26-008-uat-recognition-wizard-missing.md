---
id: DD-26-008
unit: DD-26
title: Recognition import wizard not accessible — Recognize Image button hidden due to API 404
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-26/CURRENT.md
---

## What to Build

The "Recognize Image" button or wizard entry point in the Designer is hidden because the recognition API endpoint (/api/recognition/status) returns 404. The recognition import wizard cannot be accessed by users even though the recognition service is expected to be available.

## Acceptance Criteria

- [ ] /api/recognition/status returns a valid response (not 404)
- [ ] "Recognize Image" button or equivalent entry point is visible in the Designer
- [ ] Clicking the entry point opens the recognition import wizard

## Verification Checklist

- [ ] Navigate to /designer → "Recognize Image" button or "Import from P&ID" option visible
- [ ] Click the recognition entry point → wizard dialog opens
- [ ] API /api/recognition/status returns 200 with status information

## Do NOT

- Do not hide the entry point when the API is unavailable — show a disabled state with explanation
- Do not implement only the button — the wizard must be accessible

## Dev Notes

UAT failure from 2026-03-24: /api/recognition/status returns 404 causing the Recognize Image button to be conditionally hidden. The recognition import wizard is inaccessible.
Spec reference: DD-26-002 (recognition wizard), DD-26-003 (API integration)
