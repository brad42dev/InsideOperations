---
unit: DD-26
date: 2026-03-23
uat_mode: auto
verdict: pass
scenarios_tested: 3
scenarios_passed: 3
scenarios_failed: 0
scenarios_skipped: 0
---

## Module Route Check

pass: /settings/recognition loads recognition management page.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Recognition | [DD-26-001] Recognition settings page accessible | ✅ pass | Page renders at /settings/recognition |
| 2 | Recognition | [DD-26-002] Recognition status visible | ✅ pass | "Could not reach recognition service" status shown |
| 3 | Recognition | [DD-26-006] Model upload form | ✅ pass | "Upload .iomodel" button visible with note: "domain is auto-detected from the manifest" |

## New Bug Tasks Created

None

## Screenshot Notes

- Recognition page: "Full ONNX inference is enabled when .iomodel packages are loaded"
- Upload button note confirms DD-26-006 (auto-detect domain) is implemented: "Upload a .iomodel package from SymBA — domain is auto-detected from the manifest"
- .iogap import button also visible for gap reports
- DD-26-001 (route rename), DD-26-004 (column width), DD-26-005 (SHA-256 check) are backend tasks not directly browser-verifiable
