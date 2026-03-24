# UAT Scenarios — DD-29

## Auth Module: Session Lock / Unlock (DD-29-014)

Scenario 1: [DD-29-014] Login page renders without error — navigate to /login → login form visible, no error boundary
Scenario 2: [DD-29-014] User menu shows Lock Screen option — navigate to /console, click admin ▾ user menu → "Lock Screen" item visible in dropdown
Scenario 3: [DD-29-014] Triggering lock screen shows lock dialog — click "Lock Screen" from user menu → lock/screen overlay appears with password field
Scenario 4: [DD-29-014] Correct password unlocks session — enter "admin" in lock screen password field, click Unlock → lock dialog dismisses, app returns to normal state (no "Unable to verify" error)

## Auth Module: PIN Setup / Verify (DD-29-015)

Scenario 5: [DD-29-015] Profile page accessible from user menu — click admin ▾ in header → "My Profile" or "Profile" link visible in dropdown
Scenario 6: [DD-29-015] Profile page loads with PIN section — navigate to /profile (or /settings/profile) → page loads without error, PIN Setup / Security section visible
Scenario 7: [DD-29-015] Set PIN form accepts input — navigate to profile → Security section → fill PIN form with 123456 / 123456 / admin → click Save → success indicator (no "Failed to parse server response" or 404 error)
Scenario 8: [DD-29-015] Lock screen shows PIN option after PIN set — after setting PIN, click "Lock Screen" from user menu → lock dialog shows PIN entry field or PIN option
Scenario 9: [DD-29-015] Remove PIN option present on profile — navigate back to profile after setting PIN → "Remove PIN" button visible in Security section
