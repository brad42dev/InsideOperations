---
id: MOD-CONSOLE-004
title: Fix Historical Playback Bar speed values, add alarm markers, and keyboard shortcuts
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Historical Playback Bar's speed selector should offer the 8 speeds defined in the spec (×0.25 through ×32). The scrub bar should show colored tick marks where alarms fired during the playback window. The keyboard shortcuts (Space=play/pause, arrow keys=step, Home/End, [ ] L) should be active when the playback bar is visible.

## Spec Excerpt (verbatim)

> **Speed selector:** ×1, ×2, ×4, ×8, ×16, ×32
>
> **Scrub bar:**
> - Alarm markers: colored tick marks on the timeline where alarms fired (color = alarm priority)
>
> **Keyboard shortcuts:**
> | Key | Action |
> |-----|--------|
> | Space | Play/Pause toggle |
> | Left Arrow | Step back |
> | Right Arrow | Step forward |
> | Shift+Left | Step back (larger interval) |
> | Shift+Right | Step forward (larger interval) |
> | Home | Jump to start of loaded range |
> | End | Jump to end of loaded range (or Live) |
> | [ | Set loop start at current position |
> | ] | Set loop end at current position |
> | L | Toggle loop on/off |
> — console-implementation-spec.md, §8.3

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/HistoricalPlaybackBar.tsx` — entire playback bar component; `SPEEDS` constant at line 20

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `SPEEDS` array equals `[0.25, 0.5, 1, 2, 4, 8, 16, 32]` (8 values)
- [ ] Alarm markers: component fetches alarm events from `GET /api/v1/alarms/events?start=...&end=...` when entering historical mode
- [ ] Alarm events are rendered as colored tick marks on the scrub bar (color from alarm priority)
- [ ] `keydown` handler registered on `window` (or the playback bar element) that handles Space, Left, Right, Shift+Left, Shift+Right, Home, End, [, ], L
- [ ] Keyboard handler only active when playback bar is visible (historical mode)

## Assessment

After checking:
- **Status**: ❌ Wrong / ❌ Missing
  - `SPEEDS = [1, 2, 5, 10, 60, 300]` at line 20 — wrong values (appears to be minutes, not speed multipliers)
  - Alarm markers: comment at line 195 says "Scrub slider with alarm event markers" but no API call for alarm events exists
  - No `keydown` listener anywhere in `HistoricalPlaybackBar.tsx`

## Fix Instructions (if needed)

1. **Speed values** — change `SPEEDS` in `HistoricalPlaybackBar.tsx` from `[1, 2, 5, 10, 60, 300]` to `[0.25, 0.5, 1, 2, 4, 8, 16, 32]`. Update the display labels to render as `×0.25`, `×0.5`, etc. The speed multiplier is applied to wall-clock advancement: at ×2, 1 real second = 2 playback seconds.

2. **Alarm markers** — when the component mounts or when `startTime`/`endTime` change, fetch alarm events:
   ```typescript
   GET /api/v1/alarms/events?start={startIso}&end={endIso}&limit=500
   ```
   Map each event to a pixel position on the scrub bar: `x = (event.ts - start) / (end - start) * barWidth`. Render as absolutely-positioned 2px-wide divs with height 100%, color mapped from event priority (`high` = `var(--io-alarm-high)`, `medium` = `var(--io-alarm-medium)`, `low` = `var(--io-alarm-low)`).

3. **Keyboard shortcuts** — in a `useEffect` within `HistoricalPlaybackBar.tsx`, register a `window.addEventListener('keydown', handler)` when `isVisible` is true, remove it when false. Handler:
   - `Space` → toggle play/pause
   - `ArrowLeft` (no shift) → step back by `stepInterval`
   - `ArrowRight` (no shift) → step forward by `stepInterval`
   - `Shift+ArrowLeft` → step back by larger interval (next preset step up)
   - `Shift+ArrowRight` → step forward by larger interval
   - `Home` → jump to `startTime`
   - `End` → jump to `endTime` or exit historical mode
   - `[` → set loop start to current timestamp
   - `]` → set loop end to current timestamp
   - `l` or `L` → toggle loop on/off

Do NOT:
- Use the old `SPEEDS` values — they are wrong (they appear to be step intervals in seconds, not speed multipliers).
- Block default browser behavior unconditionally for arrow keys — only call `e.preventDefault()` when in historical mode and no text input is focused.
