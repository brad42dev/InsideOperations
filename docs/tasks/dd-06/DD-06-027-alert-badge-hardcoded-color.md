---
id: DD-06-027
title: Replace hardcoded #ef4444 alert badge color with var(--io-alarm-critical)
unit: DD-06
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The alert badge on the bell icon in the top bar uses a hardcoded hex color `#ef4444` for its background. This violates the CX-TOKENS contract which requires all colors to reference CSS custom properties from the design token registry. The correct token is `var(--io-alarm-critical)`.

## Spec Excerpt (verbatim)

> All colors, spacing, radius, shadow, and typography values reference **CSS custom properties** from the token registry. No hardcoded hex colors, no hardcoded pixel values for semantic properties.
> — docs/SPEC_MANIFEST.md, §CX-TOKENS Non-negotiables #1

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/layout/AppShell.tsx:254–255` — `background: '#ef4444', color: '#fff'` in the `AlertBell` component's badge span

## Verification Checklist

- [ ] `background: '#ef4444'` is replaced with `background: 'var(--io-alarm-critical)'` at AppShell.tsx:254
- [ ] `color: '#fff'` is replaced with `color: 'var(--io-text-inverse)'` or `color: '#fff'` kept (text-inverse is appropriate here)
- [ ] The badge renders correctly in all 3 themes (dark, light, hphmi) after the change

## Assessment

- **Status**: ⚠️ Wrong — hardcoded hex at AppShell.tsx:254

## Fix Instructions

In `frontend/src/shared/layout/AppShell.tsx`, in the `AlertBell` component badge span (~line 248–268):

Change:
```tsx
background: '#ef4444',
color: '#fff',
```

To:
```tsx
background: 'var(--io-alarm-critical)',
color: 'var(--io-text-inverse)',
```

Note: the sidebar badge spans at lines 1145 and 1158 already use `var(--io-alarm-critical, #ef4444)` correctly — only the `AlertBell` badge at line 254 is wrong.

Do NOT:
- Change the sidebar badge spans (lines 1145, 1158) — they already reference the token correctly
- Use a different token — `--io-alarm-critical` is the correct semantic token for this alarm indicator
