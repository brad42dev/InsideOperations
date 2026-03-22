---
id: DD-13-003
title: Fix auto-save to use 30-second periodic interval instead of 2s debounce
unit: DD-13
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The log editor must auto-save the operator's work every 30 seconds. This is a periodic background save, not a debounce that fires after each keystroke pause. Operators need to be able to type continuously without triggering constant API calls, but they also need a predictable 30-second guarantee that their work is not lost.

## Spec Excerpt (verbatim)

> Auto-save drafts every 30 seconds
> — design-docs/13_LOG_MODULE.md, §WYSIWYG Editor and §Technical Requirements > Editor

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/log/LogEditor.tsx:644-659` — `scheduleAutoSave` function and the `setTimeout(…, 2000)` call
- `frontend/src/pages/log/LogEditor.tsx:576-579` — `autoSaveTimerRef` and related state

## Verification Checklist

- [ ] A `setInterval` (or equivalent `useEffect`-managed interval) fires every 30000ms and saves any pending changes
- [ ] The 2000ms `setTimeout` debounce is removed or replaced
- [ ] When the interval fires with no pending changes (nothing typed since last save), no API call is made
- [ ] The "Saved HH:MM:SS" indicator in the header updates after each successful periodic save (LogEditor.tsx:767)
- [ ] The interval is cleared on component unmount to prevent memory leaks

## Assessment

- **Status**: ⚠️ Wrong
- `LogEditor.tsx:648`: `setTimeout(() => { … }, 2000)` — 2-second debounce fires after every change stops for 2 seconds.
- The spec requires 30-second periodic auto-save, not per-change debounce.
- The current behavior sends a PUT request to the server after every ~2 seconds of typing inactivity, which creates unnecessary API load and doesn't match the documented behavior that operators and supervisors would expect.

## Fix Instructions

In `frontend/src/pages/log/LogEditor.tsx`:

1. Replace the `autoSaveTimerRef` (which holds a `setTimeout`) with a `useEffect`-managed `setInterval`:

```tsx
// Remove the scheduleAutoSave callback entirely.
// Change autoSaveTimerRef to track just "has pending changes":
const hasPendingRef = useRef(false)

// In handleContentChange, set the flag instead of scheduling a timer:
const handleContentChange = (segmentId: string, content: Record<string, unknown>) => {
  const next = { ...pendingContent, [segmentId]: content }
  setPendingContent(next)
  hasPendingRef.current = true
}

// Add a useEffect that runs the 30-second interval:
useEffect(() => {
  const interval = setInterval(() => {
    if (!hasPendingRef.current) return
    const updates = Object.entries(pendingContent).map(([segment_id, content]) => ({
      segment_id,
      content,
    }))
    if (updates.length === 0) return
    hasPendingRef.current = false
    setSaving(true)
    updateMutation.mutate({ content_updates: updates })
  }, 30_000)
  return () => clearInterval(interval)
}, [pendingContent, updateMutation])
```

2. Remove the `scheduleAutoSave` callback (lines 645-659) and its call in `handleContentChange`.

3. Remove the old `autoSaveTimerRef` cleanup (it is no longer needed).

Do NOT:
- Use a 2-second or other sub-30-second interval — the spec says 30 seconds
- Remove the manual Save/Submit action buttons — the auto-save supplements, not replaces, explicit saves
- Let the interval close over stale `pendingContent` — ensure the effect dep array or a ref is used correctly
