# UAT Scenarios — DD-29

## Page Baseline
Scenario 1: [DD-29-010] Login page renders without error — navigate to /login → login form visible, no error boundary text

## Session Lock UI
Scenario 2: [DD-29-010] Lock screen trigger exists — log in, navigate to /console, look for a lock/lock-screen button in header or user menu → lock option visible
Scenario 3: [DD-29-010] Lock screen activates — click the lock button or trigger lock → lock screen overlay appears (shows unlock UI)
Scenario 4: [DD-29-010] Lock screen shows PIN entry — when locked, look for a PIN input or passcode field → PIN entry field present on lock screen

## PIN Management
Scenario 5: [DD-29-011] Profile/settings has PIN section — navigate to /profile or /settings/profile → PIN setup section visible
Scenario 6: [DD-29-011] PIN can be set from profile — PIN setup section has a "Set PIN" or "Change PIN" button/form → form is actionable (not a stub)
Scenario 7: [DD-29-011] Lock screen unlock with PIN — if lock screen is active, enter digits into PIN field → PIN input accepts digits
