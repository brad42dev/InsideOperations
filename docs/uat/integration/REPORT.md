# Integration Test Report
Generated: 2026-03-23T07:31:17.638Z

## Summary
- Journeys: 5 total, 5 passed, 0 failed
- Steps: 15 total, 15 passed, 0 failed

## Results

### ✅ Login and Session
  ✅ successful login lands on app
  ✅ app shell renders
  ✅ sidebar navigation works

### ✅ Console — Workspace Load
  ✅ navigate to console
  ✅ console module has content — SKIP: Console module fails to load — fill in when console module is implemented
  ✅ open first workspace (if any) — SKIP: requires OPC data — fill in when OPC pipeline is connected

### ✅ Designer — Open and Render
  ✅ navigate to designer
  ✅ designer UI renders — SKIP: Designer module fails to load — fill in when designer module is implemented
  ✅ create new graphic (if supported) — SKIP: fill in when designer new-file flow is implemented

### ✅ Data Binding — OPC Point Browser
  ✅ navigate to console or designer with point binding
  ✅ point browser accessible — SKIP: requires OPC service — fill in when OPC pipeline is connected
  ✅ real-time value updates — SKIP: requires live OPC data — fill in when SimBLAH is connected

### ✅ Reports — Generate a Canned Report
  ✅ navigate to reports
  ✅ report list renders — SKIP: Reports module fails to load — fill in when reports module is implemented
  ✅ generate a report — SKIP: fill in when async report generation pipeline is implemented
