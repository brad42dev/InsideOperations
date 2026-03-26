# UAT Scenarios — DD-13

## Log Module — Page Load & RBAC
Scenario 1: [DD-13-017] Log module renders without error — navigate to /log → page loads, no error boundary, navigation tabs visible (Entries, Templates, Schedules)
Scenario 2: [DD-13-017] Log/templates route accessible for admin — navigate to /log/templates → templates list or empty state loads (no Access Denied / PermissionGuard block)
Scenario 3: [DD-13-017] Log/schedules route accessible for admin — navigate to /log/schedules → schedules list or empty state loads (no Access Denied / PermissionGuard block)

## Data Flow — Templates API
Scenario 4: [DD-13-024] — data flow: GET /api/v1/logs/templates —
  1. Navigate to /log/new
  2. Perform action that triggers load: page load auto-fetches templates via React Query
  3. Wait for response: browser_wait_for time=3000
  4. Snapshot and check: template dropdown/select must contain named options (Test Template, Shift Handover, UAT Test Template, or similar)
  Pass: at least one named template option is present in the dropdown AND no error boundary visible
  Fail: dropdown empty, still loading, error boundary, or "No data" when seed templates exist

## Log New Entry — Template Dropdown
Scenario 5: [DD-13-024] Template dropdown populates on /log/new — navigate to /log/new, wait 3s, click/open template select → named template options visible
Scenario 6: [DD-13-024] Start Entry button enables after template selection — select any template from dropdown → "Start Entry" button becomes enabled/clickable

## Log Entry Creation
Scenario 7: [DD-13-023] Creating a log instance navigates to editor — select template, click Start Entry → navigates away from /log/new to editor page (not stays on /log/new or shows error)

## WYSIWYG Editor — Font Family
Scenario 8: [DD-13-016] Font-family control visible in toolbar — start a log entry to reach editor → toolbar contains a font-family selector (select/dropdown with font names)

## Template List — Right-click Context Menu
Scenario 9: [DD-13-019] Right-click on template row opens context menu — navigate to /log/templates, right-click a template row → [role="menu"] appears
Scenario 10: [DD-13-019] Template context menu contains expected items — after right-click on template row → menu contains Edit Template, Duplicate, Delete items

## Point Data Segment — Right-click Context Menu
Scenario 11: [DD-13-018] Point context menu on PointDataSegment row — open a log entry with a point data segment, right-click a point row → context menu appears with point-specific actions
