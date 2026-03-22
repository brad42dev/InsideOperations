---
id: DD-31-012
title: Hide muster dashboard and on-shift/on-site group types when no access control integration configured
unit: DD-31
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The Muster Command Center route and muster navigation links must be hidden entirely when no access control integration (doc 30) is configured. Similarly, the on-shift and on-site group type options must be hidden in the group creation form when their respective integrations are not configured. There must be no placeholder, no grayed-out state — the UI elements simply do not appear.

## Spec Excerpt (verbatim)

> **Availability**: If no access control integration is configured, the Muster Status dashboard is hidden entirely. No placeholder, no grayed-out state -- just absent.
>
> **On-shift** groups: Hidden if no shift data configured.
> **On-site** groups: Hidden if no access control configured.
> — `31_ALERTS_MODULE.md`, §Muster Status Dashboard and §Custom Alert Groups

## Where to Look in the Codebase

Primary files:
- `frontend/src/App.tsx` lines 707–715 — `/alerts/muster` route always rendered
- `frontend/src/pages/alerts/MusterPage.tsx` — muster list always rendered
- `frontend/src/pages/alerts/AlertGroups.tsx` lines 21 — `GROUP_TYPES` always includes `on_shift`, `on_site`

## Verification Checklist

- [ ] A backend API is called to determine whether access control integration is active (e.g., `GET /api/settings/integrations/access-control`)
- [ ] The `/alerts/muster` route and "Muster" navigation item are hidden when integration is inactive
- [ ] `on_shift` group type option is hidden when shift data integration is not configured
- [ ] `on_site` group type option is hidden when access control integration is not configured
- [ ] Active alert cards do not show the "Muster" button when integration is inactive

## Assessment

- **Status**: ❌ Missing
- **If missing**: `App.tsx:707-715` renders the `/alerts/muster` route unconditionally. `AlertGroups.tsx:21` includes all 5 group types always. `ActiveAlerts.tsx:53-56` shows the Muster link for emergency/critical regardless of integration. No API call is made to check integration status anywhere in the alerts code.

## Fix Instructions

1. Create or find an existing API endpoint to check integration status (doc 30 integration). Something like `GET /api/settings/integrations` that returns which integrations are active.
2. Add a `useIntegrationStatus()` hook (or query) that caches this at the app level.
3. In `AlertGroups.tsx`, filter `GROUP_TYPES` based on integration status: exclude `on_shift` if no shift integration, exclude `on_site` if no access control integration.
4. In `ActiveAlerts.tsx`, wrap the "Muster" button in a conditional that checks access control integration status.
5. In the sidebar navigation (where the Muster link appears), conditionally hide the link.

Do NOT:
- Gray out the muster features — they must be absent entirely
- Implement a "configure integration" prompt in place of the muster UI — just absent
