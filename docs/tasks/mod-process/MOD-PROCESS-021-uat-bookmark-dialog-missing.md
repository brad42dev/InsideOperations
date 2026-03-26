---
id: MOD-PROCESS-021
unit: MOD-PROCESS
title: Bookmark ★ button does not open Name/Description dialog
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-PROCESS/CURRENT.md
---

## What to Build

Clicking the ★ (bookmark) button in the Process view toolbar should open a dialog/modal
with a Name input (required) and Description input (optional). Currently, clicking ★ only
toggles the button's active/highlighted state — no dialog appears at all.

Spec reference: MOD-PROCESS-015 (Add Name/Description dialog when creating a viewport bookmark)

Expected behavior per spec:
- Clicking ★ shows a dialog with a Name input (required) and Description input (optional)
- Pressing Ctrl+Shift+B shows the same dialog
- Submitting with empty Name is prevented (required field validation)
- Confirmed bookmarks save the user-entered name, not an auto-generated one
- Cancelling creates no bookmark
- Dialog closes after successful save

## Acceptance Criteria

- [ ] Clicking the ★ toolbar button opens a [role="dialog"] with Name and Description fields
- [ ] Name field is required — submitting with empty Name shows validation error
- [ ] Confirming saves a bookmark with the user-entered name
- [ ] Cancelling creates no bookmark
- [ ] Dialog closes after successful save

## Verification Checklist

- [ ] Navigate to /process, click ★ button — confirm dialog/modal appears
- [ ] Attempt to submit dialog with empty Name — confirm it is blocked
- [ ] Enter a name, submit — confirm bookmark appears in the Bookmarks sidebar section
- [ ] Cancel the dialog — confirm no bookmark is created

## Do NOT

- Do not let ★ silently toggle state without showing the dialog
- Do not auto-generate a bookmark name without user input

## Dev Notes

UAT failure 2026-03-26: Clicking ★ button set it to [active] state but no dialog appeared.
The sidebar Bookmarks section showed "+ Save current viewport" button as alternative, but
the toolbar ★ button itself had no dialog interaction implemented.
Spec reference: MOD-PROCESS-015
