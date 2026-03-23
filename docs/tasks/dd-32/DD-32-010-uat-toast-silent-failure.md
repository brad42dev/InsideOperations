---
id: DD-32-010
unit: DD-32
title: Toast notification not shown on workspace creation failure (silent fail)
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-32/CURRENT.md
---

## What to Build

When a workspace creation action fails, no toast notification is shown. The action fails silently — the user gets no feedback about what happened. The toast notification system exists (Notifications region F8 is visible) but is not wired to workspace creation error paths.

More broadly, error paths in the Console module (workspace creation, workspace deletion, rename) must show appropriate toast notifications on both success and failure.

## Acceptance Criteria

- [ ] When workspace creation fails, a toast/notification appears with an error message
- [ ] When workspace creation succeeds, a success toast appears
- [ ] Toasts are visible in the Notifications region (accessible via F8)
- [ ] Toast includes an actionable message (not just generic "Error")

## Verification Checklist

- [ ] Navigate to /console, attempt to create a workspace → on failure, a toast notification appears
- [ ] Navigate to /console, create a workspace successfully → a success toast appears
- [ ] The Notifications region (F8) shows the toast history
- [ ] No silent failures for any workspace CRUD operations

## Do NOT

- Do not only add toasts for happy path — error paths are the priority
- Do not implement a toast that immediately disappears before user can read it

## Dev Notes

UAT failure from 2026-03-23: Attempted workspace creation from /console. The operation appeared to fail (workspace not added to list) but no toast or error notification appeared. Screenshot: docs/uat/DD-32/console-workspace-created.png
Spec reference: DD-32-007 (toast notifications)
