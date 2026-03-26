# UAT Scenarios — DD-14

Tasks under test: DD-14-004, DD-14-006, DD-14-010, DD-14-011
Seed data status: UNAVAILABLE (psql not accessible)

## Page Load & Navigation

Scenario 1: [DD-14-004] Rounds page renders without error — navigate to /rounds → page renders with tabs (Active, History, Templates, Schedules), no error boundary text ("Something went wrong")

Scenario 2: [DD-14-004] — data flow: GET /api/rounds/templates — navigate to /rounds → click Templates tab → wait 3s → template list or empty state renders (no "Loading...", no error boundary, no crash)

## Print Checklist (DD-14-004 and DD-14-010)

Scenario 3: [DD-14-004] Print button visible in rounds header — navigate to /rounds → Print button visible in page header or toolbar

Scenario 4: [DD-14-010] Print dialog opens without crash — click Print button in rounds header → dialog opens (no error boundary, no "Rounds failed to load", no crash)

Scenario 5: [DD-14-010] Print dialog has correct controls — after Print dialog opens → template selector, mode toggle with "Blank" and "Current Results" options, and page size selector all visible

## Export Button (DD-14-006 and DD-14-011)

Scenario 6: [DD-14-011] History tab has Export button (not just CSV) — navigate to /rounds → click History tab → Export button visible in toolbar

Scenario 7: [DD-14-011] Export button opens 6-format dialog — click Export button on History tab → format selector dialog appears with CSV, XLSX, PDF, JSON, Parquet, HTML options

Scenario 8: [DD-14-011] Templates tab has Export button — navigate to /rounds → click Templates tab → Export button visible adjacent to "+ New Template" button

Scenario 9: [DD-14-006] Schedules tab has Export button — navigate to /rounds → click Schedules tab → Export button visible in header
