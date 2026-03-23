---
unit: DD-23
date: 2026-03-23
uat_mode: auto
verdict: fail
scenarios_tested: 2
scenarios_passed: 0
scenarios_failed: 2
scenarios_skipped: 8
---

## Module Route Check

fail: Expression builder not accessible. Settings/expressions shows "⊘ Access Denied / You do not have permission to view this page" even for admin user. Point binding in Designer canvas is a plain textbox with no expression builder modal.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Access | [DD-23-012] Expression builder opens from Designer point binding | ❌ fail | Clicking binding textbox in Designer canvas property panel activates a plain textbox — no expression builder modal appears |
| 2 | Access | [DD-23-006] Settings/Expression Library accessible | ❌ fail | /settings/expressions shows "Access Denied" even for admin user |
| 3 | Palette | [DD-23-012] Palette tiles visible and draggable | ⏭ skipped | Expression builder not accessible |
| 4 | Depth | [DD-23-003] Nesting depth limit enforced | ⏭ skipped | Expression builder not accessible |
| 5 | Cursor | [DD-23-011] Blinking insertion cursor in workspace | ⏭ skipped | Expression builder not accessible |
| 6 | Cancel | [DD-23-008] Cancel shows unsaved-changes prompt | ⏭ skipped | Expression builder not accessible |
| 7 | Save | [DD-23-014] Save for Future checked by default | ⏭ skipped | Expression builder not accessible |
| 8 | Breadcrumb | [DD-23-013] Breadcrumb trail in nested container | ⏭ skipped | Expression builder not accessible |
| 9 | Colors | [DD-23-004] Nesting level colors match Okabe-Ito | ⏭ skipped | Expression builder not accessible |
| 10 | ARIA | [DD-23-010] ARIA roles present | ⏭ skipped | Expression builder not accessible |

## New Bug Tasks Created

DD-23-017 — Expression Library page returns "Access Denied" for admin user — blocks all expression builder UAT

## Screenshot Notes

Designer canvas property panel for a Text Readout display element shows "Binding (Point ID)" as a plain textbox (placeholder: "tag.point"). No expression builder button or modal trigger found adjacent to the binding field. The binding is designed for direct point tag entry only, not expression-based bindings. Settings/expressions route explicitly denies access to admin.
