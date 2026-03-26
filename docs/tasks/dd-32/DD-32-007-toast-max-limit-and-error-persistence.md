---
id: DD-32-007
title: Fix Toast component — enforce 3-toast max with count badge, make error toasts persistent
unit: DD-32
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The Toast notification system must enforce a maximum of 3 visible toasts. When more than 3 are queued, older ones collapse into a count badge ("+ N more"). Error-type toasts must be persistent (no auto-dismiss) and require manual dismissal.

## Spec Excerpt (verbatim)

> **Auto-dismiss**: 5 seconds for informational/warning, persistent (manual dismiss) for errors
> **Limit**: Maximum 3 visible toasts; older ones collapse into a count badge
> — design-docs/32_SHARED_UI_COMPONENTS.md, §Toast Notifications

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/Toast.tsx` — `ToastItem` at line 74: `duration === 0` skips timer but error variant does not auto-set `duration=0`; `ToastProvider` at line 176 renders `toasts.map(...)` with no length cap

## Verification Checklist

- [ ] Toasts beyond the 3rd (oldest) are not rendered individually; instead a `"+N more"` compact badge appears at the top of the viewport stack
- [ ] Dismissing one of the visible 3 toasts promotes a queued toast into the visible slot
- [ ] An `error` variant toast does NOT auto-dismiss (no `setTimeout` fired); it stays until the user clicks the dismiss button
- [ ] `info`, `success`, and `warning` variants continue to auto-dismiss after 5 seconds (or the specified `duration`)

## Assessment

- **Status**: ⚠️ Wrong — `Toast.tsx:78` applies `duration ?? 5000` to all variants including errors; `Toast.tsx:174-200` renders all toasts with no limit

## Fix Instructions

1. **Error persistence**: In `ToastItem` (line 77-81), guard the `setTimeout` with a variant check:
   ```ts
   useEffect(() => {
     if (toast.variant === 'error') return // never auto-dismiss
     const duration = toast.duration ?? 5000
     const timer = setTimeout(() => dismiss(toast.id), duration)
     return () => clearTimeout(timer)
   }, [toast.id, toast.variant, toast.duration, dismiss])
   ```

2. **3-toast max**: In `ToastProvider` (line 175), slice the toasts array before rendering:
   ```ts
   const visibleToasts = toasts.slice(-3) // show newest 3
   const overflowCount = toasts.length - visibleToasts.length
   ```
   Render `visibleToasts.map(...)` then, if `overflowCount > 0`, render a compact badge:
   ```tsx
   <div style={{ /* compact badge style */ }}>+{overflowCount} more</div>
   ```
   Position the badge within the `<ToastPrimitive.Viewport>` at the bottom of the stack.

Do NOT:
- Change the dismiss behaviour for non-error toasts — they should continue auto-dismissing at 5s
- Remove the `action` button support — it is correct and used for retry scenarios
