---
id: MOD-CONSOLE-008
title: Fix playback bar speed options, add alarm markers, loop region, and keyboard shortcuts
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Historical Playback Bar must offer the spec-required speed multipliers (×0.25, ×0.5, ×1, ×2, ×4, ×8, ×16, ×32), show alarm event markers as colored tick marks on the scrub bar, support a loop region with two draggable handles, and handle keyboard shortcuts (Space=play/pause, arrow keys=step, [/] for loop bounds, L to toggle loop).

## Spec Excerpt (verbatim)

> In Full mode: scrub bar with alarm event markers overlaid, transport controls (play/pause/stop/step), speed selector (×0.25, ×0.5, ×1, ×2, ×4, ×8, ×16, ×32), loop region toggle, keyboard shortcuts (Space=play/pause, arrows=step).
> Alarm markers on the scrub bar come from `GET /api/v1/alarms/events` for the displayed time range.
> — SPEC_MANIFEST.md, CX-PLAYBACK non-negotiables #2 and #4

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/HistoricalPlaybackBar.tsx` — line 18: `SPEEDS = [1, 2, 5, 10, 60, 300]` (wrong). No alarm marker fetch. No loop region UI.
- `frontend/src/store/playback.ts` — check the `PlaybackSpeed` type and store fields.

## Verification Checklist

- [ ] SPEEDS array is `[0.25, 0.5, 1, 2, 4, 8, 16, 32]` with labels "×0.25", "×0.5", "×1", "×2", "×4", "×8", "×16", "×32".
- [ ] HistoricalPlaybackBar fetches `GET /api/v1/alarms/events?start=...&end=...` for the displayed time range.
- [ ] Alarm events are rendered as colored tick marks on the scrub bar (color = alarm priority: critical=red, high=orange, medium=yellow).
- [ ] A loop region UI exists: two draggable handles on the scrub bar define start/end. A loop toggle button enables/disables looping.
- [ ] Space key toggles play/pause when the playback bar is active.
- [ ] Left/Right arrow keys step backward/forward.
- [ ] [ key sets loop start, ] key sets loop end, L key toggles loop.

## Assessment

- **Status**: ❌ Wrong
- HistoricalPlaybackBar.tsx:18: SPEEDS = [1, 2, 5, 10, 60, 300]. These are wrong values (they appear to be "seconds per second" instead of the spec's speed multipliers). No alarm event fetch, no tick marks, no loop region, no keyboard shortcuts.

## Fix Instructions

**Speed options** (HistoricalPlaybackBar.tsx):
Replace line 18:
```typescript
const SPEEDS: PlaybackSpeed[] = [0.25, 0.5, 1, 2, 4, 8, 16, 32]
function speedLabel(s: PlaybackSpeed): string {
  return `×${s}`
}
```
Update `PlaybackSpeed` type in `frontend/src/store/playback.ts` to match the new values.

**Alarm markers:**
Add a query inside `HistoricalPlaybackBar`:
```typescript
const { data: alarmEvents } = useQuery({
  queryKey: ['playback-alarm-events', timeRange],
  queryFn: () => fetch(`/api/v1/alarms/events?start=${timeRange.start}&end=${timeRange.end}`)
    .then(r => r.json()),
  enabled: mode === 'historical',
  staleTime: 60_000,
})
```
Render each event as a colored vertical line on the scrub bar SVG/div using absolute positioning based on `(event.timestamp - rangeStart) / (rangeEnd - rangeStart) * 100%`.

**Loop region:**
Add `loopStart`, `loopEnd`, `loopEnabled` to the playback store. Render two draggable thumb handles on the scrub bar at those positions. When playback reaches `loopEnd`, jump back to `loopStart` if loop is enabled.

**Keyboard shortcuts:**
Add a `useEffect` with a `keydown` listener in `HistoricalPlaybackBar`:
- `Space` → toggle play/pause (call `setPlaying(!isPlaying)`)
- `ArrowLeft` → step back
- `ArrowRight` → step forward
- `[` → `setLoopStart(timestamp)`
- `]` → `setLoopEnd(timestamp)`
- `l` or `L` → `setLoopEnabled(!loopEnabled)`

Do NOT:
- Change the speed values in `useEffect` (the RAF timer multiplier) without also updating `PlaybackSpeed` type.
- Display alarm markers outside the visible scrub bar bounds — clamp to [0, 100%].
