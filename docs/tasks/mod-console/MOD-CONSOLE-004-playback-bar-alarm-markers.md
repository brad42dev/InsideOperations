---
id: MOD-CONSOLE-004
title: Add alarm event markers on Playback Bar scrub timeline
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When in Historical mode, the Playback Bar scrub timeline should show colored tick marks at timestamps where alarms fired. Each tick's color corresponds to the alarm priority (Critical = red, High = orange, etc.). Users can see at a glance where significant events occurred in the historical window and can click those marks to jump directly to that timestamp.

## Spec Excerpt (verbatim)

> **Scrub bar:**
> Alarm markers: colored tick marks on the timeline where alarms fired (color = alarm priority)
> — console-implementation-spec.md, §8.3
>
> Alarm markers on the scrub bar come from `GET /api/v1/alarms/events` for the displayed time range.
> — SPEC_MANIFEST.md, §CX-PLAYBACK Non-negotiables #4

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/HistoricalPlaybackBar.tsx` — the scrub bar render section; no alarm fetch currently present
- `frontend/src/store/playback.ts` — `timeRange` state (start/end timestamps for the loaded window)
- `frontend/src/api/` — look for an alarms API client that wraps `GET /api/v1/alarms/events`

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `HistoricalPlaybackBar` fetches alarm events via `GET /api/v1/alarms/events?start={start}&end={end}` when entering historical mode
- [ ] Alarm event markers are rendered as colored vertical tick marks on the scrub bar SVG/div
- [ ] Tick color matches alarm priority: Critical = `var(--io-alarm-critical)`, High = `var(--io-alarm-high)`, Medium = `var(--io-alarm-medium)`, Advisory = `var(--io-alarm-advisory)`
- [ ] Clicking a tick on the scrub bar seeks the playback position to that alarm's timestamp
- [ ] Fetch is re-issued when the playback time range changes (new window fetched)

## Assessment

Current state: no alarm fetch or marker rendering exists in `HistoricalPlaybackBar.tsx`. The scrub bar is a plain `<input type="range">` with no overlaid markers.

## Fix Instructions

1. In `frontend/src/shared/components/HistoricalPlaybackBar.tsx`:
   - Import or write an API helper: `GET /api/v1/alarms/events?start={ISO}&end={ISO}&limit=500`
   - Use `useQuery` to fetch alarm events when `mode === 'historical'` and `timeRange.start`/`timeRange.end` are defined
   - The response should return an array of `{ timestamp: string, priority: 'critical'|'high'|'medium'|'advisory' }`

2. Replace the plain `<input type="range">` scrub bar with a container div that:
   - Overlays a positioned `<div>` or `<svg>` on top of the range input
   - Renders one `<div>` per alarm event, positioned at `(timestamp - start) / (end - start) * 100%` from the left
   - Each marker: `width: 2px`, `height: 8px`, `background: var(--io-alarm-{priority})`, `position: absolute`, `bottom: 0`
   - On click of a marker div: calls `setTimestamp(new Date(event.timestamp).getTime())`

3. Use the ISA-101 alarm priority tokens — do NOT hardcode hex colors.

Do NOT:
- Fetch alarm events in live mode (only historical mode)
- Block the playback bar from rendering while the alarm fetch is loading — show the bar immediately, add markers when data arrives
- Limit markers to just the current visible range — fetch the whole loaded window
