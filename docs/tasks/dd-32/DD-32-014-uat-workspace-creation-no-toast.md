---
id: DD-32-014
unit: DD-32
title: Workspace creation still silent — no toast on success or failure after + → Done flow
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-32/CURRENT.md
---

## What to Build

The Console workspace creation flow (clicking "+" to create a new workspace, then "Done") produces zero user feedback.  
When "Done" is clicked, the API call to `POST /api/v1/console/workspaces` fails with a 404 (backend not running), but the UI shows nothing — no toast, no error message, no indication of success or failure.  
This was supposed to be fixed by DD-32-010, but UAT on 2026-03-24 confirms the toast is still absent.

The correct behavior is:
- If workspace creation **succeeds**: show a success toast ("Workspace created" or similar)
- If workspace creation **fails**: show a persistent error toast with the reason

Both cases must produce visible user feedback via the Toast/Notifications system.

## Acceptance Criteria

- [ ] After clicking "+" then configuring and clicking "Done" in the Console, a toast appears confirming success or reporting failure
- [ ] The toast is visible in the Notifications region (F8)
- [ ] Error toasts (API failure) persist until manually dismissed
- [ ] No silent failures — the user always knows whether the operation succeeded

## Verification Checklist

- [ ] Navigate to /console, click "+", set any layout, click "Done" → success toast appears within 3 seconds
- [ ] Simulate a backend failure (or test with backend down) → error toast appears and persists
- [ ] F8 opens Notifications and shows the toast history
- [ ] Workspace tab count increments on success (e.g., "2")

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not only add toast logic for success — failure toasts are equally important
- Do not emit a console.log instead of a visible toast

## Dev Notes

UAT failure from 2026-03-24: clicked "+", adjusted layout, clicked "Done" — console showed 404 for `/api/v1/console/workspaces/{uuid}` but UI was completely silent.  
Spec reference: DD-32-010 (original task — marked verified but toast is still absent in browser)  
Note: Dashboard save DOES produce a toast ("Dashboard saved") — the toast infrastructure works. The Console workspace creation path is simply not wired up to use it.
