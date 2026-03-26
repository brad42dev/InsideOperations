---
id: DD-11-007
title: Fix ErrorBoundary button text from "Try again" to "[Reload Module]"
unit: DD-11
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The CX-ERROR contract specifies that every module's error boundary must display a "[Reload Module]" button that remounts the module component without a full page reload. The shared ErrorBoundary component currently shows "Try again" as the button text. This must be corrected to "[Reload Module]" to match the spec and provide a consistent recovery UX across all modules.

## Spec Excerpt (verbatim)

> Error UI shows: generic error message + **[Reload Module]** button (remounts the module component, no full page reload).
> — docs/SPEC_MANIFEST.md, §CX-ERROR Non-negotiables #2

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/ErrorBoundary.tsx` — button at line 41–49; currently shows "Try again"

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] ErrorBoundary recovery button text reads "Reload Module" (not "Try again", not "Retry")
- [ ] Button click calls `this.setState({ hasError: false, error: null })` which remounts children (already correct at line 42)
- [ ] Button does NOT call `window.location.reload()` — it only resets component state (already correct)
- [ ] The module name is incorporated where available, e.g. "Reload Reports" when `module="Reports"` is passed

## Assessment

After checking:
- **Status**: ⚠️ Wrong — button text is "Try again" at ErrorBoundary.tsx:49

## Fix Instructions

In `frontend/src/shared/components/ErrorBoundary.tsx`, change the button text at line 49:

From:
```
Try again
```
To:
```tsx
{this.props.module ? `Reload ${this.props.module}` : 'Reload Module'}
```

This renders "Reload Reports" when used with the Reports module, "Reload Console" for Console, etc. When no module name is provided, it falls back to "Reload Module" per the spec.

The state reset logic at line 42 (`this.setState({ hasError: false, error: null })`) is already correct — do not change it. Do not call `window.location.reload()`.

Do NOT:
- Change the reset behavior — only the button label needs updating
- Create module-specific ErrorBoundary subclasses — the single shared component with the `module` prop is the correct approach
