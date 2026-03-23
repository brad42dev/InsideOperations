# UAT Scenarios — DD-13

## Log Editor Renders
Scenario 1: [DD-13-002] Log page renders without error — navigate to /log → page loads, no error boundary
Scenario 2: [DD-13-002] Log editor toolbar visible — navigate to /log, open or create a log entry → toolbar with B/I/U/S buttons visible

## Underline Button
Scenario 3: [DD-13-002] Underline button applies underline (not strikethrough) — click U button in log editor toolbar → text gets underline formatting, not strikethrough

## Auto-save Indicator
Scenario 4: [DD-13-003] Log editor has autosave indicator — open a log entry for editing → autosave status indicator visible (e.g., "Saved" or "Saving...")

## Status States
Scenario 5: [DD-13-004] Log instance status shows correct values — navigate to /log, view instance list → statuses show "draft", "submitted", or "reviewed" (not "pending" or "completed")

## Attachment Upload UI
Scenario 6: [DD-13-005] Attachment section visible in log editor — open a log entry in draft state → "Attachments" section visible below content
Scenario 7: [DD-13-005] Attachment upload accepts media types — click attachment upload button → file input accepts image/video/audio types
