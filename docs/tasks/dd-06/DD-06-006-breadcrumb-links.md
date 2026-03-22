---
id: DD-06-006
title: Make breadcrumb segments clickable links (except the last)
unit: DD-06
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

Each breadcrumb segment except the last (current location) must be a clickable link that navigates to that path. Currently all segments render as plain `<span>` elements with no click target.

## Spec Excerpt (verbatim)

> **Rules:**
> - Maximum 4 levels (matches ISA-101 display hierarchy)
> - Each segment is clickable except the last (current location, plain text)
> — 06_FRONTEND_SHELL.md, §Breadcrumbs

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/layout/AppShell.tsx` lines 127–131 — buildBreadcrumbs returns string labels only
- `frontend/src/shared/layout/AppShell.tsx` lines 841–848 — renders segments as `<span>`, no link

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] buildBreadcrumbs returns `{label: string, path: string}[]` not `string[]`
- [ ] Each segment except the last renders as a `<NavLink>` (or `<button onClick={() => navigate(path)}>`)
- [ ] Last segment renders as plain text
- [ ] Clicking a segment navigates to the correct partial path (e.g., `Console` → `/console`)
- [ ] Maximum 4 levels enforced (intermediate segments collapse to `...` with dropdown on narrow screens)

## Assessment

After checking:
- **Status**: ❌ Missing — buildBreadcrumbs (line 127) only returns string labels. Render at line 843 uses `<span>` elements.

## Fix Instructions

In `frontend/src/shared/layout/AppShell.tsx`:

**1. Update buildBreadcrumbs to return path-aware objects:**
```typescript
interface Crumb { label: string; path: string }

function buildBreadcrumbs(pathname: string): Crumb[] {
  if (pathname === '/' || pathname === '') return [{ label: 'Inside/Operations', path: '/' }]
  const parts = pathname.split('/').filter(Boolean)
  return parts.map((seg, idx) => ({
    label: segmentLabel(seg),
    path: '/' + parts.slice(0, idx + 1).join('/'),
  }))
}
```

**2. Update the render (lines 841–848) to use links for non-last segments:**
```tsx
const breadcrumbs = buildBreadcrumbs(location.pathname)

// in JSX:
{breadcrumbs.map((crumb, idx) => (
  <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
    {idx > 0 && <span style={{ opacity: 0.5 }}>›</span>}
    {idx < breadcrumbs.length - 1 ? (
      <NavLink
        to={crumb.path}
        style={{ color: 'var(--io-text-muted)', textDecoration: 'none' }}
      >
        {crumb.label}
      </NavLink>
    ) : (
      <span style={{ color: 'var(--io-text-muted)' }}>{crumb.label}</span>
    )}
  </span>
))}
```

Do NOT:
- Make the last breadcrumb segment a link (it represents the current page)
- Use a full `<a href>` that triggers a page reload (use NavLink or navigate())
