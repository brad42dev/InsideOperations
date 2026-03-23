# UAT Scenarios — DD-13

## Log Module
Scenario 1: [DD-13-010] Log page renders without error — navigate to /log → page loads, no error boundary
Scenario 2: [DD-13-010] Log shows list or empty state (not "Loading...") — navigate to /log → skeleton or list visible, no plain "Loading..." text
Scenario 3: [DD-13-004] Log instance status dropdown values — navigate to /log, open a log instance or create one → status dropdown shows draft/submitted/reviewed
Scenario 4: [DD-13-002] Log editor toolbar has Underline button — navigate to /log, open a log entry → rich text toolbar has Underline button (not just Strike)
Scenario 5: [DD-13-005] Attachment upload UI visible — navigate to /log, open a log entry → attachment/media upload button or section visible
Scenario 6: [DD-13-009] Log page uses design tokens (no hardcoded colors visible) — navigate to /log → UI renders with themed colors, no obvious color mismatches
