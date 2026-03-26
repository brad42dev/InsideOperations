---
id: DD-32-010
title: "Toast notification not shown on workspace creation failure (silent fail)"
unit: DD-32
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-32/CURRENT.md
---

## What to Build

When workspace creation fails in the Console module (`frontend/src/pages/console/index.tsx`), the error is handled silently. The `saveMutation.onError` handler uses an exponential backoff retry mechanism and a persistent save banner (shown after 3 consecutive failures), but does NOT show an immediate toast notification. Users have no feedback that the workspace creation failed.

Per design doc 32 (SHARED_UI_COMPONENTS), error states must surface via the toast notification system. Add an immediate toast notification when workspace save/creation fails.

## Acceptance Criteria

- [ ] When `saveMutation` fails (workspace save/create), an error toast is shown immediately
- [ ] The toast message is descriptive: e.g., "Failed to save workspace. Retrying..." (for first failure) or "Workspace save failed" (after retries exhausted)
- [ ] The existing retry logic and save banner are NOT removed — the toast is additive
- [ ] No TypeScript compilation errors

## Files to Create or Modify

- `frontend/src/pages/console/index.tsx` — in `saveMutation.onError`, add a `showToast` call for the error case

## Specific Changes

In the `saveMutation.onError` handler (around line 265):

```ts
onError: (_err, ws) => {
  saveFailCountRef.current += 1
  const next = saveFailCountRef.current
  // ADD: show toast on first failure
  if (next === 1) {
    showToast({ type: 'error', message: 'Failed to save workspace. Retrying…' })
  } else if (next >= 3) {
    setShowSaveBanner(true)
    showToast({ type: 'error', message: 'Workspace save failed after multiple attempts.' })
  }
  // existing retry logic...
  if (next < 3) {
    const delay = Math.pow(2, next - 1) * 1000
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    retryTimerRef.current = setTimeout(() => {
      saveMutation.mutate(ws)
    }, delay)
  }
},
```

Also check imports: `showToast` from `../../shared/components/Toast` or the appropriate path.

## Verification Checklist

- [ ] TypeScript build passes: `cd frontend && npx tsc --noEmit`
- [ ] `showToast` is imported in `console/index.tsx`
- [ ] `saveMutation.onError` calls `showToast` with an error message

## Do NOT

- Do not remove the retry logic (`retryTimerRef.current = setTimeout(...)`)
- Do not remove the save banner (`setShowSaveBanner(true)`)
- Do not change the `persistWorkspace` or `createWorkspace` function signatures
- Do not add toasts for successful saves (only failures)

## Dev Notes

UAT failure 2026-03-23: Workspace creation attempt showed no toast notification on failure. The `saveMutation.onError` in `console/index.tsx` has retry/banner logic but no immediate user feedback. `showToast` is already imported elsewhere in the codebase (see `BulkUpdate.tsx`, `Snapshots.tsx`). Check the correct import path for `showToast` before implementing.
