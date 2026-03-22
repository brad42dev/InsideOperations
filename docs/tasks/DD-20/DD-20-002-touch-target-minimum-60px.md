---
id: DD-20-002
title: Enforce 60px minimum touch targets on mobile tab bar links
unit: DD-20
status: pending
priority: medium
depends-on: [DD-20-001]
---

## What This Feature Should Do

Each interactive element on mobile must be at least 60px tall and wide to accommodate gloved operation on industrial tablets. The bottom tab bar container is 56px tall and individual NavLink items have only `padding: '6px 0'` with no explicit minimum dimensions. This means tappable area is under 60px for each link, violating the spec.

## Spec Excerpt (verbatim)

> **60px minimum** touch targets for all interactive elements (gloved operation)
> **72px** for critical/emergency actions
> **Expand hit zones 20px** beyond visual boundary — a 30px valve icon has a 60px+ tappable area
> **16px minimum spacing** between adjacent targets
> — design-docs/20_MOBILE_ARCHITECTURE.md, §Touch Interaction > Targets

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/layout/AppShell.tsx` — lines 1063-1110: bottom tab bar height (56px) and NavLink styles

## Verification Checklist

- [ ] Bottom tab bar height is at least 60px (currently 56px)
- [ ] Each NavLink item has `minHeight: '60px'` or equivalent in its inline style
- [ ] The `main-content` padding-bottom matches the updated bar height (currently `padding-bottom: 56px` at line 1125)

## Assessment

- **Status**: ⚠️ Partial — bar exists but height is 56px and links lack 60px minimum

## Fix Instructions

File: `frontend/src/shared/layout/AppShell.tsx`.

1. Change the nav element height at line 1070: `height: '56px'` → `height: '64px'` (64px gives comfortable 60px+ per link with padding).

2. Add `minHeight: '60px'` to each NavLink's style object (around line 1088):
```tsx
style={{
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '60px',   // ← add this
  ...
}}
```

3. Update the `.main-content` media query padding at line 1125: `padding-bottom: 56px` → `padding-bottom: 64px`.

Do NOT:
- Change the desktop sidebar — this fix only applies to the mobile bottom bar
- Use `height` instead of `minHeight` on the links — flex children should use minHeight so they expand if content wraps
