---
id: MOD-CONSOLE-005
title: Add keyboard shortcuts to Historical Playback Bar (Space, arrows, Home, End, brackets, L)
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

While in Historical mode, keyboard shortcuts should control playback without requiring mouse interaction. This is essential for operators who need to quickly scrub through historical data. Space toggles play/pause; arrows step through time; Home/End jump to range boundaries; [ and ] set loop region handles; L toggles loop on/off.

## Spec Excerpt (verbatim)

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
- `frontend/src/shared/components/HistoricalPlaybackBar.tsx` — no keydown listener currently present
- `frontend/src/store/playback.ts` — `setIsPlaying`, `setTimestamp`, `timeRange` actions

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `useEffect` with `document.addEventListener('keydown', ...)` exists in `HistoricalPlaybackBar.tsx`
- [ ] Listener only fires when `mode === 'historical'` (no effect in live mode)
- [ ] Space key toggles `isPlaying`
- [ ] Left/Right arrows step timestamp by current step interval; Shift+Left/Right steps by 5× larger interval
- [ ] Home sets timestamp to `timeRange.start`; End sets to `timeRange.end`
- [ ] `[` sets loop region start; `]` sets loop region end; `L` toggles loop active
- [ ] `e.preventDefault()` called on all handled keys to avoid browser default actions (e.g., page scroll on Space/arrows)
- [ ] Listener is removed on unmount or when `mode` changes to `live`

## Assessment

Current state: no `keydown` event listener in `HistoricalPlaybackBar.tsx`. The playback bar renders in live mode always (visible only in historical mode due to conditional at `index.tsx:1306`), but even when visible, no keyboard shortcuts work.

## Fix Instructions

1. In `frontend/src/shared/components/HistoricalPlaybackBar.tsx`, add a `useEffect` that registers a global `keydown` handler when `mode === 'historical'`:

   ```typescript
   useEffect(() => {
     if (mode !== 'historical') return
     function onKeyDown(e: KeyboardEvent) {
       // Only handle when no text input is focused
       const tag = (document.activeElement as HTMLElement)?.tagName
       if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

       switch (e.key) {
         case ' ':
           e.preventDefault()
           setIsPlaying(!isPlaying)
           break
         case 'ArrowLeft':
           e.preventDefault()
           // step back by current step interval (or 5x if Shift held)
           setTimestamp(t => Math.max(timeRange.start, t - stepInterval * (e.shiftKey ? 5 : 1)))
           break
         case 'ArrowRight':
           e.preventDefault()
           setTimestamp(t => Math.min(timeRange.end, t + stepInterval * (e.shiftKey ? 5 : 1)))
           break
         case 'Home':
           e.preventDefault()
           setTimestamp(timeRange.start)
           break
         case 'End':
           e.preventDefault()
           setTimestamp(timeRange.end)
           break
         case '[':
           setLoopStart(timestamp)
           break
         case ']':
           setLoopEnd(timestamp)
           break
         case 'l':
         case 'L':
           toggleLoop()
           break
       }
     }
     document.addEventListener('keydown', onKeyDown)
     return () => document.removeEventListener('keydown', onKeyDown)
   }, [mode, isPlaying, timestamp, timeRange, stepInterval, setIsPlaying, setTimestamp, setLoopStart, setLoopEnd, toggleLoop])
   ```

2. The `stepInterval` is determined by the step interval dropdown. Default: 60 seconds (1 minute).

3. If loop start/end/toggle are not yet in `playback.ts`, add them as actions.

Do NOT:
- Register the listener globally when in live mode
- Intercept keyboard events when the user is typing in an input field
- Use `onKeyDown` on the component element (must be `document` level to work regardless of focus)
