# UAT Scenarios — DD-29

## Login Page Baseline
Scenario 1: [DD-29-016] Login page renders without error — navigate to /login → login form visible, no error boundary

## PIN Setup Flow
Scenario 2: [DD-29-016] Profile page accessible from user menu — click admin user menu in header → "My Profile" or "Profile" link visible
Scenario 3: [DD-29-016] Profile page has PIN setup section — navigate to /profile → PIN Setup section visible with Set PIN controls
Scenario 4: [DD-29-016] Set PIN succeeds — fill PIN form (123456/123456/admin), click Save → success toast or confirmation shown

## Lock Screen PIN Entry
Scenario 5: [DD-29-016] Lock Screen option exists in user menu — click admin user menu → "Lock Screen" option visible
Scenario 6: [DD-29-016] Lock screen shows PIN entry after PIN is set — after setting PIN, click "Lock Screen" → lock dialog shows PIN input field or "Use PIN" option alongside password
Scenario 7: [DD-29-016] PIN unlock dismisses lock screen — enter 123456 in PIN field, click Unlock → dialog dismisses and session resumes
Scenario 8: [DD-29-016] Lock screen password-only when no PIN set — remove PIN from profile, lock screen again → PIN option absent, only password field shown
