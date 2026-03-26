# UAT Scenarios — DD-14

## Page Load
Scenario 1: [DD-14-010] Rounds page renders without error — navigate to /rounds → page loads, no error boundary ("Something went wrong" / "Rounds failed to load")

## Print Dialog (DD-14-010)
Scenario 2: [DD-14-010] Print button visible in rounds header — navigate to /rounds → a Print button is visible in the header toolbar
Scenario 3: [DD-14-010] Print dialog opens without crash — click Print button → dialog opens (no error boundary, no "templates.map is not a function" crash)
Scenario 4: [DD-14-010] Print dialog contains expected controls — after opening Print dialog → template selector, mode toggle (Blank/Current Results), and page size selector are all visible
Scenario 5: [DD-14-010] Print dialog closes cleanly — open Print dialog then close/cancel it → dialog dismisses, module still functional (no error boundary)

## Export Buttons (DD-14-011)
Scenario 6: [DD-14-011] data flow: GET /api/v1/rounds/history — navigate to /rounds → click History tab → table renders with content or graceful empty state (no crash, no error boundary)
Scenario 7: [DD-14-011] History tab has multi-format Export button — navigate to /rounds → click History tab → Export button visible in toolbar (not just "Export CSV")
Scenario 8: [DD-14-011] History Export opens format selector dialog — click Export button on History tab → format selector dialog appears with CSV, XLSX, PDF, JSON, Parquet, HTML options
Scenario 9: [DD-14-011] Templates tab has Export button — navigate to /rounds → click Templates tab → Export button visible adjacent to New Template button
Scenario 10: [DD-14-011] Schedules tab has Export button — navigate to /rounds → click Schedules tab → Export button visible in header
Scenario 11: [DD-14-011] Templates Export opens format selector dialog — click Export button on Templates tab → format selector dialog appears (not a direct CSV download)
