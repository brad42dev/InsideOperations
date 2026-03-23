---
unit: DD-12
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 4
scenarios_passed: 2
scenarios_failed: 2
scenarios_skipped: 5
---

## Module Route Check

✅ pass: Navigating to /forensics loads Forensics module with landing page

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Forensics Landing | [DD-12-001] Forensics page renders | ✅ pass | Page loads with Investigations/Threshold Search/Alarm Search tabs |
| 2 | Forensics Landing | [DD-12-001] Alarm search entry point | ✅ pass | "Alarm Search" button visible in tab bar on landing page |
| 3 | Investigation | [DD-12-004] Investigation stage drag-to-reorder | skipped | No investigations exist to open |
| 4 | Investigation | [DD-12-003] Toolbar Export/Share/Print | skipped | No investigations exist to open |
| 5 | Investigation | [DD-12-008] Right-click on investigation rows | ❌ fail | Investigation list is empty — cannot test right-click; empty state shows no investigations |
| 6 | Investigation | [DD-12-011] Nested error boundaries | skipped | Cannot verify without opening investigation |
| 7 | Point Context | [DD-12-006] PointContextMenu on point tags | skipped | Cannot verify without investigation workspace |
| 8 | Point Context | [DD-12-010] Historical playback bar | skipped | Cannot verify without investigation workspace |
| 9 | Empty State | [DD-12-012] Empty state CTA permission | ❌ fail | Empty state shown but no CTA button visible for admin to create investigation — the "New Investigation" button is in the header but no empty-state specific CTA |

## New Bug Tasks Created

None

## Screenshot Notes

Forensics landing shows Investigations (empty), Threshold Search, Alarm Search tabs. "New Investigation" button in top-right. Filter buttons: All/Active/Closed/Cancelled. Empty list with no CTA in the empty state area.
