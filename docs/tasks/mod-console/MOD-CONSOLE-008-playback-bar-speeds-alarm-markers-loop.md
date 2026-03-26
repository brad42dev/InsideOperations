---
id: MOD-CONSOLE-008
title: Fix playback bar speed options, add loop region, reverse transport, step interval dropdown, and keyboard shortcuts
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Historical Playback Bar must offer the spec-required speed multipliers (x1, x2, x4, x8, x16, x32), a reverse transport button, a step interval dropdown (1s/5s/30s/1m/5m/15m/1h), a loop region with two draggable handles, and keyboard shortcuts (Space=play/pause, arrow keys=step, [/] for loop bounds, L to toggle loop).

Note: alarm event markers on the scrub bar were implemented in a prior commit and are now working correctly. The remaining gaps are speed values, transport completeness, loop region, and keyboard shortcuts.

## Spec Excerpt (verbatim)

> **Speed selector:** x1, x2, x4, x8, x16, x32
>
> **Transport controls:** Play (forward), Pause, Reverse (play backward), Step forward, Step back
>
> **Step interval dropdown:** Next change, 1 second, 5 seconds, 30 seconds, 1 minute, 5 minutes, 15 minutes, 1 hour
>
> **Loop region:** Two draggable handles on the scrub bar define a loop region. When playback reaches the end handle, it jumps back to the start handle. Loop region can be set by clicking the loop icon.
>
> **Keyboard shortcuts:** Space=Play/Pause, Left/Right Arrow=Step, Shift+Left/Shift+Right=Larger step, Home=Jump to start, End=Jump to end, [=Set loop start, ]=Set loop end, L=Toggle loop
> — console-implementation-spec.md, §8.3

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/HistoricalPlaybackBar.tsx` — line 20: `SPEEDS = [1, 2, 5, 10, 60, 300]` (wrong values). No reverse button. No step interval dropdown. No loop region UI. No keydown listener.
- `frontend/src/store/playback.ts` — check the `PlaybackSpeed` type and store fields for loop state.

## Verification Checklist

- [ ] `SPEEDS` array is `[1, 2, 4, 8, 16, 32]` with labels "x1", "x2", "x4", "x8", "x16", "x32".
- [ ] A Reverse button exists that plays backward (decrements timestamp by `simElapsed` each frame).
- [ ] A step interval dropdown exists with the 8 options from spec §8.3.
- [ ] A loop region UI exists: two draggable handles on the scrub bar define start/end; a loop toggle button enables/disables looping.
- [ ] `Space` key toggles play/pause when the playback bar is in historical mode.
- [ ] `ArrowLeft` / `ArrowRight` keys step backward/forward by the selected step interval.
- [ ] `[` sets loop start, `]` sets loop end, `l` or `L` toggles loop on/off.
- [ ] Keyboard handler is only active when in historical mode (guard: `mode !== 'historical' → return`).

## Assessment

- **Status**: ⚠️ Partial
- Alarm markers: FIXED — `HistoricalPlaybackBar.tsx:60-72` fetches from `alarmsApi.getEvents` and renders tick marks at lines 209-245.
- Speed values: STILL WRONG — `HistoricalPlaybackBar.tsx:20` has `SPEEDS = [1, 2, 5, 10, 60, 300]`. Spec §8.3 requires `[1, 2, 4, 8, 16, 32]`.
- Reverse transport: MISSING — no reverse/rewind button.
- Step interval dropdown: MISSING — step is hardcoded as `Math.max(60_000, rangeMs / 1000)`.
- Loop region: MISSING — no loop UI, no `loopStart`/`loopEnd`/`loopEnabled` state.
- Keyboard shortcuts: MISSING — no `keydown` listener anywhere in the file.

## Fix Instructions

**Speed values** (`frontend/src/shared/components/HistoricalPlaybackBar.tsx` line 20):
```typescript
const SPEEDS: PlaybackSpeed[] = [1, 2, 4, 8, 16, 32]
function speedLabel(s: PlaybackSpeed): string {
  return `x${s}`
}
```
Update `PlaybackSpeed` type in `frontend/src/store/playback.ts` to `1 | 2 | 4 | 8 | 16 | 32`.

**Reverse transport:**
Add a "Reverse" button next to Play/Pause. Add `isReversing: boolean` to the playback store. When reversing, the RAF timer decrements timestamp instead of incrementing.

**Step interval dropdown:**
Replace the hardcoded `stepMs` calculation with a dropdown state and a map:
```typescript
const STEP_OPTIONS = [
  { label: 'Next change', ms: 0 },  // special: jumps to next value change
  { label: '1 second',    ms: 1_000 },
  { label: '5 seconds',   ms: 5_000 },
  { label: '30 seconds',  ms: 30_000 },
  { label: '1 minute',    ms: 60_000 },
  { label: '5 minutes',   ms: 300_000 },
  { label: '15 minutes',  ms: 900_000 },
  { label: '1 hour',      ms: 3_600_000 },
]
```

**Loop region:**
Add `loopStart: number | null`, `loopEnd: number | null`, `loopEnabled: boolean` to `usePlaybackStore`. Render two absolutely-positioned thumb handles on the scrub bar. In the RAF timer, check: if `loopEnabled && loopEnd !== null && next >= loopEnd`, reset to `loopStart ?? timeRange.start`.

**Keyboard shortcuts:**
Add a `useEffect` in `HistoricalPlaybackBar` that registers a `window.addEventListener('keydown', handler)` only when `mode === 'historical'`. Handler:
- `Space` → `setPlaying(!isPlaying)` (prevent default)
- `ArrowLeft` (no shift) → step back by selectedStepMs
- `ArrowRight` (no shift) → step forward by selectedStepMs
- `Shift+ArrowLeft` → step back by next larger interval
- `Shift+ArrowRight` → step forward by next larger interval
- `Home` → `setTimestamp(timeRange.start)`
- `End` → `setTimestamp(timeRange.end)` or `setMode('live')`
- `[` → `setLoopStart(timestamp)`
- `]` → `setLoopEnd(timestamp)`
- `l` or `L` → `setLoopEnabled(!loopEnabled)`

Do NOT:
- Change speed values without updating the `PlaybackSpeed` union type in `store/playback.ts`.
- Remove the existing alarm marker rendering (lines 209-245) — it is correct.
- Call `e.preventDefault()` for arrow keys unconditionally — guard against focused text inputs.
