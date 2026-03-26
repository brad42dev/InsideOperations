# UAT Scenarios — DD-15

## Settings Page Baseline
Scenario 1: [DD-15-017] Settings page renders without error — navigate to /settings → settings page visible with sidebar nav, no error boundary

## Data Links Tab (DD-15-017)
Scenario 2: [DD-15-017] Data Links tab visible in Imports — navigate to /settings/imports → tab bar includes "Data Links" tab label
Scenario 3: [DD-15-017] Data Links tab shows table — click Data Links tab → table visible with columns Source Dataset, Source Column, Target Dataset, Target Column, Match Type, Direction, Enabled, Actions
Scenario 4: [DD-15-017] Add Link button opens form — click "Add Link" button → form/dialog opens with source dataset dropdown, target dataset dropdown, match type select

## Entity Context Menus (DD-15-018)
Scenario 5: [DD-15-018] Groups right-click context menu — navigate to /settings/groups, right-click a group row → [role="menu"] appears with "Add Members", "Manage Roles" items
Scenario 6: [DD-15-018] Import connections right-click context menu — navigate to /settings/imports, right-click a connection row → [role="menu"] appears with "Test Connection", "Enable" or "Disable", "Delete" items
Scenario 7: [DD-15-018] Import definitions right-click context menu — on /settings/imports definitions table, right-click a definition row → [role="menu"] appears with "Run Now", "View Run History", "Enable" or "Disable" items
Scenario 8: [DD-15-018] Certificates right-click context menu — navigate to /settings/certificates, right-click a certificate row → [role="menu"] appears with "View Details", "Download Certificate", "Copy Fingerprint" items
Scenario 9: [DD-15-018] Recognition right-click context menu — navigate to /settings/recognition, right-click a model row → [role="menu"] appears with "View Details", "Set as Active", "View Feedback History" items
Scenario 10: [DD-15-018] Context menu dismisses on Escape — open any context menu, press Escape → menu disappears
