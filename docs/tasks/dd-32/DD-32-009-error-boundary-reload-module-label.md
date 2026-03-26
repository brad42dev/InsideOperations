---
id: DD-32-009
title: Fix ErrorBoundary button label to "Reload Module" per spec
unit: DD-32
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The ErrorBoundary fallback UI shows a recovery button. The spec specifies the button label must be "Reload Module". The current label is "Try again". The remount behaviour is already correct (setState clears the error, remounting children), only the label needs changing.

## Spec Excerpt (verbatim)

> **Fallback UI**: "Something went wrong" + [Reload Module] button
> **Behavior**: Clicking [Reload Module] remounts the module component (not a full page reload)
> — design-docs/32_SHARED_UI_COMPONENTS.md, §Error Boundary

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/ErrorBoundary.tsx:48` — button renders with label "Try again"

## Verification Checklist

- [ ] The error boundary button label reads "Reload Module"
- [ ] Clicking the button still calls `this.setState({ hasError: false, error: null })` to remount children (behaviour must not change)

## Assessment

- **Status**: ⚠️ Wrong — `ErrorBoundary.tsx:48` renders "Try again"; behaviour (remount) is correct

## Fix Instructions

In `frontend/src/shared/components/ErrorBoundary.tsx`, line 48, change:
```tsx
Try again
```
to:
```tsx
Reload Module
```

No other changes needed. The `setState({ hasError: false, error: null })` remount behaviour is correct.

Do NOT:
- Change the `onClick` handler — `setState` remount is the specified behaviour
- Add a full page reload (`window.location.reload()`) — spec explicitly says "not a full page reload"
