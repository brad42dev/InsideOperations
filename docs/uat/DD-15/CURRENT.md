---
unit: DD-15
date: 2026-03-26
uat_mode: auto
verdict: partial
scenarios_tested: 10
scenarios_passed: 6
scenarios_failed: 4
scenarios_skipped: 0
---

## Module Route Check

✅ pass: Navigating to /settings loads real Settings implementation with full sidebar nav and sub-pages.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Settings Baseline | [DD-15-017] Settings page renders without error | ✅ pass | Full sidebar nav visible, redirects to /settings/users |
| 2 | Data Links Tab | [DD-15-017] Data Links tab visible in Imports | ✅ pass | "Data Links" button present in Import tab bar |
| 3 | Data Links Tab | [DD-15-017] Data Links tab shows table | ✅ pass | Clean empty state: "No data links configured yet" with Add Link button |
| 4 | Data Links Tab | [DD-15-017] Add Link button opens form | ✅ pass | Form opens with source/target dataset dropdowns, column dropdowns, match type select (Exact/Case-insensitive/Transformed), bidirectional toggle, 12 transform ops per side |
| 5 | Context Menus | [DD-15-018] Groups right-click context menu | ✅ pass | Right-click on group row shows "Add Members", "Manage Roles", "Delete" |
| 6 | Context Menus | [DD-15-018] Import connections right-click context menu | ❌ fail | No connection rows exist (empty state) — context menu untestable; right-click cannot be verified |
| 7 | Context Menus | [DD-15-018] Import definitions right-click context menu | ❌ fail | No definition rows exist (empty state) — context menu untestable |
| 8 | Context Menus | [DD-15-018] Certificates right-click context menu | ❌ fail | Page crashes with error boundary: "Settings failed to load — certs.map is not a function" (TypeError in Certificates.tsx) |
| 9 | Context Menus | [DD-15-018] Recognition right-click context menu | ❌ fail | No model rows exist (empty state: "No models uploaded") — context menu untestable |
| 10 | Context Menus | [DD-15-018] Context menu dismisses on Escape | ✅ pass | Groups context menu dismissed on Escape key |

## New Bug Tasks Created

DD-15-019 — Import Connections table has no seed data — right-click context menu untestable
DD-15-020 — Import Definitions table has no seed data — right-click context menu untestable
DD-15-021 — Certificates page crashes with "certs.map is not a function" TypeError
DD-15-022 — Recognition models table has no seed data — right-click context menu untestable

## Screenshot Notes

- Scenario 6: /settings/import Connections tab empty — no rows to right-click. Screenshot: .playwright-mcp/page-2026-03-26T16-20-30-444Z.png
- Scenario 8: /settings/certificates crashes with TypeError: certs.map is not a function — full error boundary. Screenshot: .playwright-mcp/page-2026-03-26T16-21-13-122Z.png
- Seed data status: UNAVAILABLE (psql not accessible) — data flow scenarios not applicable for DD-15 (Settings module, exempt)
