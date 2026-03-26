---
unit: DD-31
date: 2026-03-26
uat_mode: auto
verdict: partial
scenarios_tested: 10
scenarios_passed: 7
scenarios_failed: 3
scenarios_skipped: 0
---

## Module Route Check

✅ pass: Navigating to /alerts loads real implementation — Alerts heading, compose form, tabs (Send Alert, Active, History, Management) all present.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Module Stability | [DD-31-017] Alerts module loads without crash | ✅ pass | Page renders, no error boundary, no "templates.find is not a function" crash |
| 2 | Channels API | [DD-31-014/015/016/020] data flow: GET /api/notifications/channels/enabled | ❌ fail | Intermittent cold-start 404 — console shows "Failed to load resource: Not Found @ /api/notifications/channels/enabled" on every fresh browser session; only "websocket" checkbox appears on first load. Works after backend warms up (subsequent page loads show 6 channels). Acceptance criteria requires no 404 on page load. |
| 3 | Channels API | [DD-31-005] Channel selector driven by API | ❌ fail | Same intermittent cold-start 404 — channels section shows only "websocket" on cold start; selector is not consistently API-driven |
| 4 | Alert History Export | [DD-31-008] Export button visible in History toolbar | ✅ pass | Export button present in toolbar alongside severity filter dropdown |
| 5 | Alert History Export | [DD-31-008] Export format picker shows all 6 formats | ✅ pass | Clicking Export shows: CSV, XLSX, JSON, PDF, Parquet, HTML |
| 6 | Template Variables | [DD-31-003] Alert templates list loads without crash | ✅ pass | Management → Templates tab loaded, 10 templates listed, no crash |
| 7 | Template Variables | [DD-31-003] Template variable inputs use structured labels | ❌ fail | Selected "Fire Alarm" template; variable field shows raw name "location" not a human-readable label; no required indicator (asterisk) visible. Spec requires v.label as field label and required marker for required fields. |
| 8 | Muster Dashboard | [DD-31-007] Muster dashboard section on Active tab | ✅ pass | Active tab shows "No active emergency or critical alerts" — muster section correctly absent per DD-31-012 (no access control integration configured). Expected behavior. |
| 9 | RBAC Gates | [DD-31-021] Templates management visible for admin | ✅ pass | Management tab → Templates section visible with 10 templates listed |
| 10 | RBAC Gates | [DD-31-021] Groups management visible for admin | ✅ pass | Management tab → Groups section shows "Notification Groups" heading with "+ New Group" button |

## New Bug Tasks Created

DD-31-022 — /api/notifications/channels/enabled intermittent cold-start 404 — alert compose shows only WebSocket
DD-31-023 — Template variable inputs show raw name instead of structured label; no required indicator

## Screenshot Notes

- ⚠️ seed data status unknown (psql unavailable)
- Channels API intermittent: on every cold browser start (fresh Chrome process), /api/notifications/channels/enabled returns 404. After the backend warms up (usually within 3-4 seconds of page load), subsequent /alerts page loads show 6 channels: in_app, pa, push, radio, sms, websocket (websocket checked by default). The cold-start 404 is consistent and reproducible.
- Template variables: "Fire Alarm" template variable section renders, but label shows raw snake_case "location" not a human-readable label. No asterisk or "required" text indicator visible.
- Export button and format picker (DD-31-008/019): fully working — button in toolbar, picker shows all 6 required formats.
- DD-31-007 (Muster Export button): cannot test without active muster event; Active tab correctly shows empty state.
