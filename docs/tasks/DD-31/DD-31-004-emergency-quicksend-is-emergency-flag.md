---
id: DD-31-004
title: Filter emergency quick-send section by is_emergency flag, not by severity
unit: DD-31
status: pending
priority: low
depends-on: [DD-31-003]
---

## What This Feature Should Do

The emergency quick-send section at the top of the send form must only show templates explicitly marked `is_emergency: true` in the database. A CRITICAL-severity template without `is_emergency: true` must not appear there. The section must be absent entirely if no `is_emergency` templates exist.

## Spec Excerpt (verbatim)

> `is_emergency` BOOLEAN — Show in emergency quick-send section
>
> Emergency mode shortcut: For EMERGENCY templates, an additional quick-send option is available from the main view. A dedicated "Emergency" section at the top of the template picker shows only emergency templates with large one-click send buttons.
> — `31_ALERTS_MODULE.md`, §Template Fields and §Send Alert View

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/alerts/AlertComposer.tsx` lines 146–178 — emergency quick-send section filter
- `frontend/src/api/notifications.ts` line 12–26 — `NotificationTemplate` interface (add `is_emergency` field)

## Verification Checklist

- [ ] `NotificationTemplate` interface has `is_emergency: boolean`
- [ ] Emergency quick-send section filters by `t.is_emergency === true`, not `t.severity === 'emergency' || t.severity === 'critical'`
- [ ] A CRITICAL template with `is_emergency: false` does not appear in the quick-send section
- [ ] The section does not render at all when no templates have `is_emergency: true`

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: `AlertComposer.tsx:153` filters `t.severity === 'emergency' || t.severity === 'critical'`. The `NotificationTemplate` type does not have `is_emergency`. This will show CRITICAL templates in the emergency section even when they should not be there.

## Fix Instructions

1. Add `is_emergency: boolean` to `NotificationTemplate` in `frontend/src/api/notifications.ts`.
2. Change `AlertComposer.tsx:153` from `.filter(t => t.severity === 'emergency' || t.severity === 'critical')` to `.filter(t => t.is_emergency === true)`.
3. The same change should be applied in `index.tsx` if the composite `SendAlertPanel` also renders this section.

Do NOT:
- Use `is_emergency` as a replacement for the severity field — both fields exist independently
- Remove the `is_emergency` guard from the button style logic (the button colors remain keyed on severity)
