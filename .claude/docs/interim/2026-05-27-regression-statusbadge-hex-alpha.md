---
id: 2026-05-27-regression-statusbadge-hex-alpha
title: OpcSources StatusBadge hex-alpha CSS concat bug fix
status: interim
created: 2026-05-27
last_updated: 2026-05-27
last_synced_with_code: 2026-05-27
work_units:
- 2026-05-27_regression-statusbadge-hex-alpha_054757
implementation:
- frontend/src/pages/settings/OpcSources.tsx
- ui-audit/02-comparison.md
- ui-audit/04-recommendations.md
related:
- 2026-05-27-regression-accent-token-prefix
topics:
- ui-framework
- module-designer
aliases: []
keywords: []
covers: OpcSources StatusBadge hex-alpha CSS concat bug fix
---

# OpcSources StatusBadge hex-alpha CSS concat bug fix

Fixed a functional regression in `OpcSources.tsx` where template literal hex-alpha concatenation (`${color}20`, `${color}40`) produced invalid CSS when the color value was a CSS custom property reference, rendering all `StatusBadge` backgrounds and borders as transparent.

## Purpose

The `StatusBadge` component in `OpcSources.tsx` renders a pill badge for OPC source connection states (active, inactive, connecting, error). The badge uses a semi-transparent background and border derived from the state color token. The broken implementation concatenated a two-digit hex alpha suffix directly onto a CSS variable string, producing expressions like `var(--io-success)20` which are not valid CSS color values.

## Behavior

After the fix, `StatusBadge` renders correctly for all four states:

- `active` → green pill, `color-mix(in srgb, var(--io-success) 12%, transparent)` background
- `inactive` → muted pill, `color-mix(in srgb, var(--io-text-muted) 12%, transparent)` background
- `connecting` → warning/yellow pill
- `error` → danger/red pill

The fix uses the `color-mix(in srgb, <token> <pct>%, transparent)` pattern already established in `SystemHealth.tsx`, keeping both files consistent.

## Implementation Notes

The bug was in the local `StatusBadge` function at `OpcSources.tsx:165–175`. The function is module-local (not a shared component), so the fix was scoped there.

Before:
```tsx
background: `${color}20`,
border: `1px solid ${color}40`,
```

After:
```tsx
background: `color-mix(in srgb, ${color} 12%, transparent)`,
border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
```

**Open finding:** The same `${color}20`/`${color}40` hex-alpha bug exists in four additional files and was not fixed here (out of scope):
- `Users.tsx` — Badge component, lines 108/110
- `Roles.tsx` — Badge component, lines 51/53
- `CameraStreams.tsx` — lines 785/787
- `MaintenanceTicketsPanel.tsx` — line 52

These files pass CSS variable strings as the `color` argument to the same broken pattern and remain broken. They are tracked as open findings in `ui-audit/04-recommendations.md`.

Audit artifacts updated: `ui-audit/02-comparison.md` Category 8 Settings deviations field and `ui-audit/04-recommendations.md` Phase 2 regression list both updated to mark this item resolved and record the remaining open instances.

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->

### 2026-05-27

Created. Documents the OpcSources StatusBadge hex-alpha concatenation bug fix: replaced invalid `${color}20`/`${color}40` template literal patterns with `color-mix(in srgb, ...)` expressions matching the SystemHealth.tsx pattern. Audit files updated to reflect resolution and record four remaining unfixed instances in other Settings pages.
