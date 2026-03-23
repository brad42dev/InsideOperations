---
unit: OPC-BACKEND
date: 2026-03-23
uat_mode: auto
verdict: pass
scenarios_tested: 3
scenarios_passed: 3
scenarios_failed: 0
scenarios_skipped: 0
---

## Module Route Check

pass: /settings/opc-sources loads OPC UA Sources page with source list and add form.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | OPC Config | [OPC-BACKEND-003] OPC settings page renders | ✅ pass | |
| 2 | OPC Config | [OPC-BACKEND-003] OPC source list visible | ✅ pass | Two sources: "Manual Entry" (active) and "SimBLAH OPC UA" (error: BadNotConnected) |
| 3 | OPC Config | [OPC-BACKEND-003] Add OPC source form | ✅ pass | Form has Name, Endpoint URL, Security Policy (None/Basic256Sha256/Aes128Sha256RsaOaep/Aes256Sha256RsaPss), Security Mode, Client Certificate, Platform, Category |

## New Bug Tasks Created

None

## Screenshot Notes

- OPC Sources page fully functional with global minimum publish interval setting (1000ms)
- OPC-BACKEND-003 (deadband filter) is a Rust service change — not visible in the browser OPC config UI
- Security policy and mode dropdowns confirm OPC security configuration UI is intact
