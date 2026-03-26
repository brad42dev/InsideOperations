# UAT Scenarios — DD-13

## Page Load & Stability
Scenario 1: [DD-13-006] Log module renders without error — navigate to /log → module UI visible, no "Log failed to load" error boundary
Scenario 2: [DD-13-006] — data flow: GET /api/logs/instances — navigate to /log, click Completed tab, wait for load → entries table visible OR empty state message (no error boundary, no crash)

## Export Split Button (DD-13-006)
Scenario 3: [DD-13-006] Export split button visible on Completed tab — navigate to /log, click Completed tab → "[Export v]" or "Export" split button visible in toolbar above table
Scenario 4: [DD-13-006] Export dropdown lists format options — click the dropdown chevron on the Export button → dropdown shows CSV, XLSX, PDF, JSON options

## Schedule Management UI (DD-13-008)
Scenario 5: [DD-13-008] Schedule page loads without stub — navigate to /log/schedules → full schedule management UI visible (list + "+ New Schedule" button), NOT a stub/placeholder/blank
Scenario 6: [DD-13-008] New Schedule form opens — click "+ New Schedule" button on /log/schedules → form opens with template selector, recurrence type, and other fields (not a no-op)

## RBAC Route Access (DD-13-017)
Scenario 7: [DD-13-017] Templates page accessible to admin — navigate to /log/templates → page loads with template list or empty state (no 403, no redirect away)
Scenario 8: [DD-13-017] Schedules page accessible to admin — navigate to /log/schedules → page loads (no 403, no redirect for admin user with all permissions)

## Tiptap Extensions (DD-13-016)
Scenario 9: [DD-13-016] Font family control in WYSIWYG toolbar — navigate to /log, open or create a log entry that has a WYSIWYG segment → toolbar shows a font family selector (dropdown/select control for font)

## Point Context Menu (DD-13-018)
Scenario 10: [DD-13-018] Point context menu on point data rows — navigate to /log, open a log entry with a PointDataSegment (point data rows visible), right-click a point row → PointContextMenu appears with point-related actions
