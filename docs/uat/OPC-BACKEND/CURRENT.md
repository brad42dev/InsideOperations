---
unit: OPC-BACKEND
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 3
scenarios_passed: 3
scenarios_failed: 0
scenarios_skipped: 0
---

## Module Route Check

pass: OPC Sources page loads with source config form

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | OPC Backend | OPC sources page renders | ✅ pass | OPC UA Sources page loads with source table |
| 2 | OPC Backend | OPC source form loads | ✅ pass | Edit form opens with all config fields |
| 3 | OPC Backend | Security endpoint settings | ✅ pass | Security Policy (None/Basic256Sha256/Aes128/Aes256) and Security Mode dropdowns visible |

## New Bug Tasks Created

None

## Screenshot Notes

OPC-BACKEND-001/002/003 are backend-only (endpoint selection, A&C methods, deadband). Settings UI works correctly. SimBLAH OPC source shows BadNotConnected (expected in dev env).
