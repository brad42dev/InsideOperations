---
id: DD-31-021
unit: DD-31
title: "Muster Dashboard Export Unaccounted List button — requires live muster test to verify"
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-31/CURRENT.md
---

## What to Build

Task DD-31-007 added an "Export Unaccounted List" button to the MusterDashboard component. This button could not be confirmed during automated UAT because the MusterDashboard component is only rendered when a muster-type alert is active, and no active muster alerts were present in the test environment.

Additionally, per DD-31-012, the muster dashboard is hidden entirely when no access control integration is configured.

This task requires a manual verification pass with a live muster-type notification active, or a test environment with access control integration configured.

## Acceptance Criteria

- [ ] When a muster-type notification is active, MusterDashboard is visible and contains an "Export Unaccounted List" button
- [ ] Clicking the button triggers `GET /api/notifications/:id/muster/export` and a file download initiates
- [ ] Button is hidden when user lacks `alerts:muster` permission
- [ ] If access control integration is not configured, the muster section is hidden (existing behavior per DD-31-012)

## Verification Checklist

- [ ] Trigger a muster-type notification (or configure access control integration in test environment)
- [ ] Navigate to /alerts → Active tab → muster dashboard section is visible
- [ ] "Export Unaccounted List" button is present in the muster dashboard
- [ ] Clicking the button produces a file download
- [ ] Button is absent for users without `alerts:muster` permission

## Do NOT

- Do not mark this verified without actually seeing the button in the browser
- Do not stub the export endpoint — it must trigger a real download

## Dev Notes

UAT failure 2026-03-25: MusterDashboard not rendered during automated test run — no active muster alerts. Cannot confirm DD-31-007's Export Unaccounted List button without a live muster event. Needs human-assisted or triggered test.
