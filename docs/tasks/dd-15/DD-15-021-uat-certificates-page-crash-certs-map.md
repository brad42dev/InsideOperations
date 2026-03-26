---
id: DD-15-021
unit: DD-15
title: Certificates page crashes with "certs.map is not a function" TypeError
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-15/CURRENT.md
---

## What to Build

The /settings/certificates page crashes immediately on load with an error boundary showing:

> Settings failed to load
> certs.map is not a function

Console log: `TypeError: certs.map is not a function` at Certificates component render.

Root cause: the API response for certificates is not an array, or is null/undefined, but the component tries to call `.map()` on it without checking the type first. The component must guard against non-array responses.

## Acceptance Criteria

- [ ] /settings/certificates loads without error boundary
- [ ] Page shows certificate list (or a clean empty state if no certs exist)
- [ ] No TypeError thrown during render even when the API returns null, undefined, or a non-array

## Verification Checklist

- [ ] Navigate to /settings/certificates → page loads without "Settings failed to load" error
- [ ] No error boundary visible
- [ ] If certificates exist, they are listed in a table
- [ ] If no certificates exist, clean empty state is shown (e.g. "No certificates uploaded yet")
- [ ] Right-click on a certificate row → context menu with "View Details", "Download Certificate", "Copy Fingerprint"

## Do NOT

- Do not just wrap in try/catch and show nothing — the component must handle the empty/error state visibly
- Do not default `certs` to null — default to `[]` so `.map()` works safely

## Dev Notes

UAT failure 2026-03-26: Page threw "certs.map is not a function" immediately after load. Error boundary triggered. Screenshot: .playwright-mcp/page-2026-03-26T16-21-13-122Z.png
Spec reference: DD-15-018 (entity right-click context menus — Certificates.tsx)
