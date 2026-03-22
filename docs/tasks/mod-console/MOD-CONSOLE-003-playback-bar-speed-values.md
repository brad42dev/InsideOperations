---
id: MOD-CONSOLE-003
title: Fix Playback Bar speed selector values to match spec (x0.25 through x32)
unit: MOD-CONSOLE
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The Historical Playback Bar speed selector currently offers [1x, 2x, 5x, 10x, 60x, 300x]. The spec requires [×0.25, ×0.5, ×1, ×2, ×4, ×8, ×16, ×32]. These are entirely different values. The playback speed multiplier controls how fast simulation time advances relative to real time — ×32 means 32 seconds of historical data play back per real second.

## Spec Excerpt (verbatim)

> **Speed selector:** ×1, ×2, ×4, ×8, ×16, ×32
> — console-implementation-spec.md, §8.3
>
> In Full mode: ... speed selector (×0.25, ×0.5, ×1, ×2, ×4, ×8, ×16, ×32), loop region toggle, keyboard shortcuts (Space=play/pause, arrows=step).
> — SPEC_MANIFEST.md, §CX-PLAYBACK Non-negotiables #2

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/HistoricalPlaybackBar.tsx` — line 18: `const SPEEDS: PlaybackSpeed[] = [1, 2, 5, 10, 60, 300]`; line 20-22: `speedLabel` function
- `frontend/src/store/playback.ts` — `PlaybackSpeed` type definition; must be updated to include new values

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `SPEEDS` array contains exactly: [0.25, 0.5, 1, 2, 4, 8, 16, 32]
- [ ] `PlaybackSpeed` type in `store/playback.ts` accepts 0.25 and 0.5
- [ ] `speedLabel` function displays: 0.25 as "¼×", 0.5 as "½×", others as "N×" (e.g., "32×")
- [ ] Default speed at playback entry is 1 (not changed)
- [ ] Playback RAF interval correctly uses the new speed values as multipliers

## Assessment

Current state: `HistoricalPlaybackBar.tsx:18` — `SPEEDS = [1, 2, 5, 10, 60, 300]`. The values 5×, 10×, 60×, 300× are non-spec; 0.25× and 0.5× are missing. The `speedLabel` function maps speeds <60 as `${s}×` and ≥60 as `${s/60}m/s` — these labels are entirely wrong.

## Fix Instructions

1. In `frontend/src/shared/components/HistoricalPlaybackBar.tsx`, replace line 18:
   ```typescript
   const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16, 32] as const
   type PlaybackSpeed = typeof SPEEDS[number]
   ```

2. Replace the `speedLabel` function:
   ```typescript
   function speedLabel(s: number): string {
     if (s === 0.25) return '¼×'
     if (s === 0.5) return '½×'
     return `${s}×`
   }
   ```

3. Check `frontend/src/store/playback.ts` for the `PlaybackSpeed` type. Update it to accept all 8 values.

4. Ensure the default speed in the playback store is `1` (unchanged).

Do NOT:
- Change the playback RAF timing logic — it already multiplies elapsed real time by `speed`
- Alter the live/historical mode toggle behavior
- Break the store's `setSpeed` action type safety
