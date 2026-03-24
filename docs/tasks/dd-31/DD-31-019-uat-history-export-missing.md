---
id: DD-31-019
unit: DD-31
title: Alert History tab missing Export button (CX-EXPORT)
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-31/CURRENT.md
---

## What to Build

The History tab in /alerts shows a severity filter dropdown and an empty state ("No messages found.") but has NO Export button. DD-31-008 was supposed to add an Export button to the Alert History table per the CX-EXPORT cross-cutting contract, but no such button is visible in the rendered UI.

## Acceptance Criteria

- [ ] Alert History tab has a visible Export button in the toolbar or table header area
- [ ] Clicking Export triggers a download or export format dialog
- [ ] Export works even when the table is empty (button still visible)

## Verification Checklist

- [ ] Navigate to /alerts → click "History" tab → Export button visible
- [ ] Export button is not hidden or conditionally rendered away when table is empty
- [ ] Clicking Export button produces visible action (dialog, download, or format picker)

## Do NOT

- Do not hide the Export button behind a non-empty table condition
- Do not stub the click handler with a no-op

## Dev Notes

UAT failure 2026-03-24: History tab renders only a severity filter combobox and "No messages found." paragraph. No Export button found in the accessibility tree. Expected: Export button per CX-EXPORT contract.
Spec reference: DD-31-008 (Add Export button to Alert History table — CX-EXPORT)
