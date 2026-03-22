---
id: DD-31-005
title: Load available channels from Alert Service config instead of hardcoding all channels
unit: DD-31
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The channel checkboxes in the Send Alert form must only show channels that are enabled in the Alert Service configuration. If SMS is not configured, the SMS checkbox must not appear. This requires fetching the enabled channel list from the backend at module load time and using it to drive the channel picker.

## Spec Excerpt (verbatim)

> The Send Alert view only shows channels that are enabled in the Alert Service configuration (Settings > Alerts > Channels, doc 27). Disabled channels are not shown — no grayed-out options, no "configure this channel" prompts. If SMS is not configured, the SMS checkbox does not appear.
> — `31_ALERTS_MODULE.md`, §Channel Availability in UI

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/alerts/index.tsx` line 27 — `ALL_CHANNELS` hardcoded to all 6
- `frontend/src/pages/alerts/AlertComposer.tsx` line 12 — `CHANNELS` hardcoded to only 3
- `frontend/src/api/notifications.ts` — add a method to fetch enabled channels

## Verification Checklist

- [ ] A `GET /api/notifications/channels` (or equivalent Settings endpoint) call fetches the list of enabled channels at form load time
- [ ] The channel checkbox list is driven by this response, not by a hardcoded constant
- [ ] Channels absent from the enabled list do not appear (not shown, not grayed)
- [ ] If the channel list API fails, the form falls back gracefully (show error or fall back to `websocket` only)

## Assessment

- **Status**: ❌ Missing
- **If missing**: `index.tsx:27` hardcodes `['websocket', 'email', 'sms', 'pa', 'radio', 'push']`. `AlertComposer.tsx:12` hardcodes `['websocket', 'email', 'sms']`. There is no API method to fetch configured channels in `notifications.ts`.

## Fix Instructions

1. Add an API endpoint call in `notifications.ts`:
   ```ts
   getEnabledChannels(): Promise<ApiResult<NotificationChannel[]>> {
     return api.get('/api/notifications/channels/enabled')
   },
   ```
   (The backend endpoint path may be `/api/alerts/channels` per doc 27 — check with the backend team.)

2. In `SendAlertPanel` (index.tsx) and `AlertComposer`, replace the hardcoded constant with a `useQuery` that fetches enabled channels. Use the result array as the source for the checkbox list.

3. Default the channel list to `['websocket']` while loading (WebSocket is always available per spec).

4. In the channel state initialiser, filter `tpl.channels` to only include channels that are in the enabled list when a template is selected.

Do NOT:
- Show grayed-out channels with "not configured" tooltip — spec says absent entirely
- Crash if the enabled-channels endpoint returns empty — fall back to `['websocket']`
