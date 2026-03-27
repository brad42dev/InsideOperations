---
unit: DD-26
date: 2026-03-26
uat_mode: auto
verdict: partial
scenarios_tested: 9
scenarios_passed: 8
scenarios_failed: 1
scenarios_skipped: 0
---

## Module Route Check

pass: Navigating to /settings/recognition loads the Recognition settings page — "Recognition" heading, Service Status section with per-domain P&ID/DCS stats, Loaded Models section, and Gap Reports section are all present with no error boundary.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Recognition Settings | [DD-26-011] Settings recognition page renders without error | ✅ pass | "Recognition" heading visible, no error boundary |
| 2 | Recognition Settings | [DD-26-011] Service Status section shows per-domain status | ✅ pass | "P&ID Model" and "DCS Model" appear as separate stat items in Service Status card |
| 3 | Recognition Settings | [DD-26-011] — data flow: GET /api/recognition/status | ✅ pass | Both P&ID and DCS domains show "Not Loaded" + "mode: disabled · hw: cpu" — real API response rendered, not loading/error state |
| 4 | Recognition Settings | [DD-26-011] P&ID and DCS model labels both visible simultaneously | ✅ pass | "P&ID Model" and "DCS Model" labels both present in Service Status section at the same time |
| 5 | Loaded Models | [DD-26-012] Loaded Models section renders with Upload button | ✅ pass | "Loaded Models" section visible, "Upload .iomodel" button present |
| 6 | Loaded Models | [DD-26-012] Models table has Domain column | ❌ fail | GET /api/recognition/models returns 404 — models table never renders, Domain column unverifiable; UI silently falls back to "No models uploaded" empty state instead of showing an error |
| 7 | Recognition Settings | [DD-26-011] Status subtext shows mode and hardware per domain | ✅ pass | "mode: disabled · hw: cpu" subtext visible under both P&ID Model and DCS Model |
| 8 | Gap Reports | [DD-26-012] Gap Reports section renders | ✅ pass | "Gap Reports" section visible with "Import .iogap" button |
| 9 | Recognition Settings | [DD-26-011] No error boundary after page load | ✅ pass | No "Something went wrong" text, page renders cleanly |

## New Bug Tasks Created

DD-26-013 — /api/recognition/models endpoint returns 404; models table never renders

## Screenshot Notes

Seed data: UNAVAILABLE (psql not accessible). Recognition service API: /api/recognition/status returns 200 with per-domain domains.pid and domains.dcs structure — confirming ModelManager dual-slot architecture is working at the API level. /api/recognition/models returns 404 — this endpoint is not registered in the API gateway routing. The UI component silently falls back to the empty state message rather than surfacing an error. The "Domain" column in the models table (which would confirm per-domain display of DD-26-012 hot-swap architecture) is therefore unverifiable.
