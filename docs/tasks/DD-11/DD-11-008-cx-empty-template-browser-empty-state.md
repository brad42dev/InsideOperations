---
id: DD-11-008
title: Improve template browser empty state with illustration, explanation, and CTA
unit: DD-11
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

When no templates match the current search/category filter, the template browser currently shows a plain "No templates found." text. The CX-EMPTY contract requires tailored empty states with a module-specific icon/illustration, a plain-language explanation of why the screen is empty, and a contextual CTA where applicable. For the Reports template browser, the empty state should distinguish between "no templates match your search" and "no templates exist at all."

## Spec Excerpt (verbatim)

> Empty states are **tailored per module and entity**. No generic "No data found" messages.
> Empty state includes: module-specific illustration or icon, plain-language explanation of why it's empty, and a CTA (if applicable).
> CTAs in empty states are **permission-aware**: rendered only if the user has the permission to take the action.
> — docs/SPEC_MANIFEST.md, §CX-EMPTY Non-negotiables

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/reports/index.tsx` — `TemplateBrowser` function, empty state block at lines 303–316; currently renders `<div style={{...}}>No templates found.</div>`

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Empty state renders a module-appropriate icon (e.g. document/report SVG icon)
- [ ] When search/category filter is active and produces no results: message explains "No templates match your search" (not just "No templates found")
- [ ] When no templates exist at all (no filter active, zero results): message explains "No report templates have been seeded yet. Contact your administrator."
- [ ] Empty state does NOT show a "Create Template" CTA (template creation is done in the Designer, not this module — per design-doc §Overview)
- [ ] Plain "No templates found." generic text is gone

## Assessment

After checking:
- **Status**: ⚠️ Wrong — generic single-line text at index.tsx:314 with no icon, no explanation, no distinction between search-empty and system-empty

## Fix Instructions

In `frontend/src/pages/reports/index.tsx`, replace the empty state block at lines 303–316 inside `TemplateBrowser`:

```tsx
{!query.isLoading && templates.length === 0 && !query.isError && (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '180px',
      gap: '10px',
      color: 'var(--io-text-muted)',
      padding: '24px',
      textAlign: 'center',
    }}
  >
    <svg
      width="40" height="40" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1" opacity={0.4}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--io-text-secondary)' }}>
      {search || category !== 'All'
        ? 'No templates match your search'
        : 'No report templates available'}
    </div>
    <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
      {search || category !== 'All'
        ? 'Try clearing the search or selecting a different category.'
        : 'Report templates are seeded at startup. Contact your administrator if templates are missing.'}
    </div>
  </div>
)}
```

Note: `search` and `category` are already in scope inside `TemplateBrowser` (lines 194–195).

Do NOT:
- Add a "Create Template" CTA — the spec states template design is done in the Designer module, not the Reports module
- Use a generic shimmer or spinner for the empty state — this renders after loading completes
