---
id: MOD-PROCESS-012
title: Add "Unsubscribing N points" toast on graphic navigate-away
unit: MOD-PROCESS
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When the user navigates away from a currently loaded graphic that has active live subscriptions (i.e., not in historical/playback mode), the Process module shows a brief informational toast: "Unsubscribing N points" where N is the current subscribed point count. The toast auto-dismisses after 3 seconds and must not be a blocking dialog.

## Spec Excerpt (verbatim)

> **Scope warning toast** — navigating away from a graphic that has active (non-playback) subscriptions shows a brief "Unsubscribing N points" toast (informational, auto-dismisses 3s). Not a blocking confirm dialog.
> — SPEC_MANIFEST.md, MOD-PROCESS §Architectural non-negotiables #11

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/process/index.tsx:546-553` — `handleSelectView` — this is where view navigation happens; needs the toast call
- `frontend/src/pages/process/index.tsx:1021-1031` — `visiblePointIds` and `isHistorical` state (for the N and condition check)
- `frontend/src/shared/components/Toast.tsx` (or equivalent) — the toast mechanism to call

## Verification Checklist

- [ ] Switching to a different graphic in live mode shows a toast: "Unsubscribing N points" where N equals the count from `visiblePointIds.length`.
- [ ] Toast auto-dismisses after 3 seconds without user interaction.
- [ ] No toast appears when switching views in historical/playback mode (`isHistorical === true`).
- [ ] The toast is informational (no action button, no "confirm" required).
- [ ] Navigation proceeds immediately — the toast does not block or delay the view change.

## Assessment

- **Status**: ❌ Missing
- `handleSelectView` at `index.tsx:546-553` only calls `setSelectedId(id)`, `localStorage.setItem`, `pushRecentView`, and `setRecentViews`. No toast call exists anywhere in the navigate-away path.

## Fix Instructions

In `frontend/src/pages/process/index.tsx`, update `handleSelectView` to show the toast when navigating away from a loaded graphic with active live subscriptions:

```typescript
const handleSelectView = useCallback(
  (id: string, name: string) => {
    // Show scope warning toast if leaving a loaded view with live subscriptions
    if (selectedId && selectedId !== id && !isHistoricalRef.current && visiblePointIds.length > 0) {
      showToast(`Unsubscribing ${visiblePointIds.length} points`, { duration: 3000, type: 'info' })
    }
    setSelectedId(id)
    localStorage.setItem(DEFAULT_GRAPHIC_ID_KEY, id)
    pushRecentView(id, name)
    setRecentViews(loadRecentViews())
  },
  [selectedId, visiblePointIds],
)
```

Use the project's existing toast utility (check how other modules call it — likely `useToast()` from a shared hook or a direct `toast()` call from a toast library already in the project). Check `frontend/src/shared/hooks/useToast.ts` or `frontend/src/shared/components/Toast.tsx` for the correct API.

Do NOT:
- Show a confirmation dialog or block navigation — it must be a non-blocking informational toast.
- Show the toast when `isHistorical` is true (playback mode subscriptions are expected and not being abandoned).
- Show the toast when `selectedId === id` (same graphic reloaded — no subscriptions to unsubscribe).
- Hardcode a subscription count — use `visiblePointIds.length` which reflects the actual current count.
