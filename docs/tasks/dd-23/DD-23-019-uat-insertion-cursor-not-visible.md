---
id: DD-23-019
unit: DD-23
title: Insertion cursor not visible in workspace
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-23/CURRENT.md
---

## What to Build

The expression builder workspace should show a visible insertion cursor (text-cursor style blinking caret) to indicate where the next tile will be inserted. Currently the only cursor mechanism is via aria-hidden gap divs with `cursor: text` styling — these are invisible to sighted users (10px wide transparent divs) and invisible to screen readers (aria-hidden). There is no blinking caret or visible "click here to insert" indicator.

UAT Scenario 4 [DD-23-011]: workspace should show visible insertion cursor → none found in accessibility tree or visually.

## Acceptance Criteria

- [ ] A visible cursor indicator appears in the workspace showing where the next palette tile will be inserted
- [ ] The cursor is perceivable by sighted users (visible line, caret, or highlighted gap)
- [ ] When clicking a different position in the workspace, the cursor moves to that position
- [ ] The cursor position is visible when the workspace is empty ("click to start" or similar)

## Verification Checklist

- [ ] Navigate to /settings/expressions, open Edit on an expression
- [ ] Confirm a visible insertion cursor or position indicator is present in the empty workspace
- [ ] Click a gap between tiles and confirm cursor visually moves to that gap
- [ ] Add a tile and confirm cursor appears after it

## Do NOT

- Do not use aria-hidden divs as the only cursor indicator — they are invisible to users
- Do not implement only as a CSS trick with no visible state; the cursor must be perceivable

## Dev Notes

UAT failure from 2026-03-24: workspace only contains aria-hidden=true gap divs (cursor:text CSS, 10px wide). No blinking cursor, no visible insertion marker in the DOM. Accessibility tree shows only "Drop tiles here" text with no cursor element.
Spec reference: DD-23-011 (insertion cursor / tile position indicator)
