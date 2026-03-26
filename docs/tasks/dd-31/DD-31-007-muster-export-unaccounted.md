---
id: DD-31-007
title: Add Export Unaccounted List button to Muster Dashboard
unit: DD-31
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Muster Dashboard must show an "Export Unaccounted List" button that downloads a CSV of all currently unaccounted personnel for the active emergency. This button must call `GET /api/notifications/:id/muster/export` and stream the file directly to the browser. The button must be hidden when the user lacks `alerts:muster` permission.

## Spec Excerpt (verbatim)

> `[Export Unaccounted List]`
>
> `GET /api/notifications/:id/muster/export` — Export unaccounted personnel list (CSV). Permission: `alerts:muster`
> — `31_ALERTS_MODULE.md`, §Muster Status Dashboard and §API Endpoints / Muster Status

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/alerts/MusterDashboard.tsx` lines 403–541 — main component; add export button near summary or bottom
- `frontend/src/api/notifications.ts` — add `exportMusterUnaccounted(messageId)` method

## Verification Checklist

- [ ] "Export Unaccounted List" button is rendered in MusterDashboard
- [ ] Button calls `GET /api/notifications/:id/muster/export` and triggers browser file download
- [ ] Button is hidden when user lacks `alerts:muster` permission
- [ ] `notificationsApi` has an `exportMusterUnaccounted(messageId)` method

## Assessment

- **Status**: ❌ Missing
- **If missing**: `MusterDashboard.tsx` renders summary, filter controls, and person cards but no export button. `notifications.ts` has no export method. The spec wireframe explicitly shows `[Export Unaccounted List]` at the bottom of the dashboard.

## Fix Instructions

1. Add to `frontend/src/api/notifications.ts`:
   ```ts
   exportMusterUnaccounted(messageId: string): string {
     return `/api/notifications/muster/${messageId}/export`
   },
   ```
   (Return a URL string — trigger download via `window.open(url)` or an anchor tag with `download` attribute so the browser saves the CSV.)

2. In `MusterDashboard.tsx`, add an export button below the person cards grid (after line 528):
   ```tsx
   <a
     href={notificationsApi.exportMusterUnaccounted(messageId)}
     download
     style={{ ... }}
   >
     Export Unaccounted List
   </a>
   ```
3. Gate the button on `alerts:muster` permission using the permission hook.

Do NOT:
- Load the CSV data into a JS array and build the file in the browser — call the backend endpoint which already has the data
- Show the button when the user lacks `alerts:muster`
