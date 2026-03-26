---
id: DD-14-010
unit: DD-14
title: PrintDialog crashes on open — templates.map is not a function
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-14/CURRENT.md
---

## What to Build

The Print button in the Rounds module header opens a PrintDialog component. When clicked, the dialog attempts to call `.map()` on the `templates` value — but `templates` is not an array (it's undefined, null, or a non-array response from the API). The result is an unhandled crash that shows the full module error boundary: "Rounds failed to load / templates.map is not a function".

This means DD-14-004 (printable round checklist) is broken at the entry point. The dialog never opens.

**Observed:** Clicking Print → module crashes with error boundary "templates.map is not a function" (PrintDialog component, caught by [IO ErrorBoundary / Rounds]).

**Expected:** Clicking Print → dialog opens with template selector, blank/current-results mode toggle, and page size selector.

**Root cause:** PrintDialog.tsx (or wherever the component is defined) calls `templates.map(...)` without guarding against a non-array value. The API for `/api/rounds/templates` (or equivalent) either returns a non-array (e.g. `{ data: [...] }` wrapper) or the templates query result is accessed before it resolves.

## Acceptance Criteria

- [ ] Clicking the Print button opens the PrintDialog without crashing
- [ ] PrintDialog handles the case where templates is null/undefined/loading — shows a loading state or empty selector rather than crashing
- [ ] PrintDialog shows template selector, blank/current-results mode toggle, and page size selector once templates load
- [ ] The full module error boundary ("Rounds failed to load") does NOT appear when clicking Print

## Verification Checklist

- [ ] Navigate to /rounds
- [ ] Click the Print button in the header
- [ ] Confirm dialog opens (no error boundary)
- [ ] Confirm template selector, mode toggle (Blank/Current Results), and page size selector are present
- [ ] No silent no-op: clicking Print produces a visible dialog

## Do NOT

- Do not stub this with a TODO comment — the crash is already in production
- Do not fix only the crash without making the dialog functional

## Dev Notes

UAT failure from 2026-03-25: Clicking Print button at /rounds → TypeError: templates.map is not a function at PrintDialog component (chunk-EMBGZOEE.js:19137:13). Module error boundary caught it.
Screenshot: docs/uat/DD-14/dd14-print-crash.png
Spec reference: DD-14-004 (printable round checklist)
