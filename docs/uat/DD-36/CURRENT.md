---
unit: DD-36
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 3
scenarios_passed: 2
scenarios_failed: 1
scenarios_skipped: 0
---

## Module Route Check

✅ pass: /settings/health loads System Health page

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | System Health | [DD-36-008] System Health 6-tab page | ❌ fail | /settings/health loads but shows only a flat list of 5 services (api-gateway, data-broker, opc-service, archive-service, auth-service) — no 6-tab layout, missing 6 services |
| 2 | Health Indicator | [DD-36-008] Shell status dot | ✅ pass | Service health panel in sidebar footer shows all 11 service status dots |
| 3 | Health | [DD-36-001] Health indicator in sidebar | ✅ pass | Sidebar footer shows Services section with colored dots for all 11 services |

## New Bug Tasks Created

None

## Screenshot Notes

System Health page shows 5/5 services healthy (api-gateway:3000, data-broker:3001, opc-service:3002, archive-service:3005, auth-service:3009). Missing: event-service, parser-service, import-service, alert-service, email-service, recognition-service. No 6-tab layout as specified. Sidebar shows all 11 service dots (all "unknown" before health check).
