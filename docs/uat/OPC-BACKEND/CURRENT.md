---
unit: OPC-BACKEND
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 2
scenarios_passed: 1
scenarios_failed: 1
scenarios_skipped: 1
---

## Module Route Check

✅ pass: /settings/opc-sources loads OPC UA Sources configuration page

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | OPC Sources | [OPC-BACKEND-001] OPC sources page renders | ✅ pass | Page loads with sources list: Manual Entry (active) and SimBLAH OPC UA (error: BadNotConnected) |
| 2 | OPC Sources | [OPC-BACKEND-002] OPC alarm operations | ❌ fail | Edit dialog shows endpoint/security/platform/credentials config — no alarm acknowledge/enable/disable/shelve controls visible in UI |
| 3 | OPC Sources | [OPC-BACKEND-003] Subscription deadband settings | skipped | OPC source edit dialog shows security mode, platform, data category, credentials — no explicit deadband/subscription settings visible (backend behavior) |

## New Bug Tasks Created

None

## Screenshot Notes

OPC sources page shows Global Minimum Publish Interval (1000ms), source list with status, and Edit/Delete/Reconnect actions. Edit dialog: Name, Endpoint URL, Security Policy/Mode, Client Certificate, Platform (Siemens/Honeywell/ABB/Emerson/Yokogawa options), Data Category, Username/Password, Enabled checkbox, and Test Connection button.
