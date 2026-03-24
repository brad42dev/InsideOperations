---
id: DD-13-015
unit: DD-13
title: Template editor crashes on open: allSegments.filter is not a function
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-13/CURRENT.md
---

## What to Build

Clicking "New Template" on the Log Templates tab navigates to `/log/templates/new/edit` but immediately crashes with an ErrorBoundary showing "Log failed to load — allSegments.filter is not a function".

The error originates in the template editor component (likely a Tiptap or rich-text editor initialization path) where `allSegments` is expected to be an array but is not — so calling `.filter` on it throws a TypeError.

The correct behavior is: clicking "New Template" should open a functional template editor allowing the user to create a new log template. No crash should occur.

## Acceptance Criteria

- [ ] Navigating to /log/templates/new/edit does not show the ErrorBoundary "Log failed to load" message
- [ ] The template editor view renders with a form/editor UI for creating a new template
- [ ] `allSegments` (or the relevant data) is guarded before calling `.filter` — use `Array.isArray(allSegments) ? allSegments.filter(...) : []`
- [ ] Existing templates (if any) can also be opened for editing without crashing

## Verification Checklist

- [ ] Navigate to /log, click Templates tab, click "New Template" → template editor renders (no crash)
- [ ] Template editor shows a name/title field and a body editor area
- [ ] No "allSegments.filter is not a function" error in browser console
- [ ] Reload the template editor route directly (/log/templates/new/edit) — no crash

## Do NOT

- Do not stub the template editor with a TODO comment — the tab-level UI already works
- Do not silently catch the error without fixing the root cause

## Dev Notes

UAT failure 2026-03-24: Clicking "New Template" → /log/templates/new/edit → ErrorBoundary fires immediately with "allSegments.filter is not a function". Screenshot: docs/uat/DD-13/fail-scenario10-template-editor-crash.png
Spec reference: DD-13-008 (log schedule management UI implementation)
