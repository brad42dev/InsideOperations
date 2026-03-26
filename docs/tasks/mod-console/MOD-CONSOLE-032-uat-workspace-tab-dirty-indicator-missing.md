---
id: MOD-CONSOLE-032
unit: MOD-CONSOLE
title: Workspace tab dirty indicator missing after layout change in edit mode
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

When the user changes the workspace layout in edit mode (e.g., changing the grid from 2×2 to 1×1 via the layout combobox), the workspace tab button must show a visual dirty indicator (dot, asterisk, or unsaved badge) while the debounce is pending or the save is in-flight.

Currently, after a layout change the workspace tab shows only the workspace name ("Workspace 2") with no dirty indicator. The tab button's innerHTML is plain text only — no child spans, dots, or asterisks.

The spec (MOD-CONSOLE-029) requires:
- A dot/asterisk/badge appears on the workspace tab while a change is debouncing or a save is in-flight
- The indicator disappears after a successful save
- After 3 consecutive save failures, a persistent (non-dismissible) banner must appear: "Workspace changes not saved" with a "Save now" button

## Acceptance Criteria

- [ ] After changing workspace layout in edit mode, a dot/asterisk/unsaved badge appears on the active workspace tab
- [ ] The indicator is visible within 2 seconds of making the change (debounce start)
- [ ] The indicator disappears after the save completes successfully
- [ ] After 3 consecutive save failures, a persistent non-dismissible banner appears with "Workspace changes not saved" and a "Save now" button
- [ ] The existing dismissible toast for save errors is replaced by the persistent banner behavior

## Verification Checklist

- [ ] Navigate to /console → click Edit → change layout combobox → dirty dot/asterisk visible on workspace tab within 2s
- [ ] Wait for save to complete → dirty indicator disappears from tab
- [ ] Tab shows only workspace name (no indicator) when no unsaved changes exist
- [ ] With backend save failing → after 3 failures, persistent banner appears (not just a toast)
- [ ] Banner persists until a successful save; "Save now" button triggers retry

## Do NOT

- Do not implement only the visual indicator without the save integration — the indicator must disappear on successful save
- Do not use a dismissible toast for the failure state — it must be a non-dismissible persistent banner

## Dev Notes

UAT failure from 2026-03-26: In edit mode, JS-triggered layout change from 2×2 to 1×1. Tab button innerHTML = "Workspace 2" — plain text only, no child elements. No dirty indicator present in DOM.
Screenshot: docs/uat/MOD-CONSOLE/fail-s11-no-dirty-indicator.png
Spec reference: MOD-CONSOLE-029-uat-no-dirty-indicator-no-persistent-save-banner.md
