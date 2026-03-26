---
id: MOD-CONSOLE-029
unit: MOD-CONSOLE
title: Workspace save feedback missing dirty indicator and persistent failure banner
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

Two related save-feedback features are missing:

1. **Dirty indicator**: While a workspace change is debouncing or a save is in-flight, a visual indicator (dot, asterisk, or "unsaved" badge) must appear on the workspace tab button. Currently the tab shows only the workspace name with no save-state indicator.

2. **Persistent failure banner**: After 3 consecutive save failures, a persistent (non-dismissible) banner must appear saying "Workspace changes not saved" with a "Save now" button. Currently, save failures produce a dismissible toast notification ("Failed to save workspace. Retrying…") which is wrong — it must be a persistent banner that does not auto-dismiss.

## Acceptance Criteria

- [ ] After modifying a workspace layout, a dot/asterisk/badge appears on the workspace tab while the 2s debounce is pending or save is in-flight
- [ ] Indicator disappears after a successful save
- [ ] After 3 consecutive save failures, a persistent (non-dismissible) banner appears with text "Workspace changes not saved" and a "Save now" button
- [ ] Banner does NOT auto-dismiss
- [ ] "Save now" button manually triggers a retry
- [ ] Toast notifications for save errors are removed or replaced by the persistent banner

## Verification Checklist

- [ ] Modify workspace layout → dot/asterisk visible on tab within 2s
- [ ] After save completes → dot disappears
- [ ] With backend down (causing save failures) → after 3 failures, persistent banner appears (not just a toast)
- [ ] Banner has "Save now" button that triggers retry
- [ ] Banner persists until a successful save

## Do NOT

- Do not use a dismissible toast for the failure state — it must be a persistent banner
- Do not remove the retry logic — saves must retry automatically

## Dev Notes

UAT failure from 2026-03-26: Changed workspace layout from 2×2 to 3×2. Workspace tab showed only "Workspace 1" text with no dirty indicator. After layout change, a dismissible toast notification appeared: "Failed to save workspace. Retrying…" — this is a toast, not the required persistent banner. Required: dirty dot on tab + persistent banner after 3 failures.
Spec reference: MOD-CONSOLE-001
