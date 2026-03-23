---
id: DD-10-011
unit: DD-10
title: Playback Bar (play/pause/seek) not implemented in DashboardViewer time-context mode
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-10/CURRENT.md
---

## What to Build

The DashboardViewer has a static time range selector (preset buttons: 15m/1h/6h/24h/7d/30d plus From/To date fields). The spec requires a Playback Bar component in time-context mode that allows interactive historical playback with play/pause/seek controls.

The current implementation is a static time range filter, not a Playback Bar. The Playback Bar should:
- Show a timeline scrubber for seeking through historical data
- Have Play/Pause button to auto-advance through time
- Show current playback position as a timestamp
- Support configurable playback speed

## Acceptance Criteria

- [ ] DashboardViewer in time-context mode shows a Playback Bar component
- [ ] Playback Bar has at minimum: play/pause button, timeline scrubber, current time display
- [ ] Scrubbing the timeline updates all widgets to show data at that historical point
- [ ] Play mode auto-advances time and updates widget data

## Verification Checklist

- [ ] Navigate to /dashboards, open any dashboard → Playback Bar visible below the dashboard header
- [ ] Click Play → time advances and widgets update
- [ ] Drag scrubber → widgets show historical data at selected time

## Do NOT

- Do not confuse the static time range selector (15m/1h presets) with the Playback Bar — both should exist
- Do not implement only on one dashboard type

## Dev Notes

UAT failure from 2026-03-23: Dashboard viewer shows only a static time range selector. No Playback Bar with play/pause/seek found. Spec reference: DD-10-008 (Playback Bar in time-context mode), CX-PLAYBACK cross-cutting spec.
