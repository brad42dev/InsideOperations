---
id: DD-12-012
title: Fix empty state CTA permission gate, hardcoded colors in heatmap, and loading skeleton
unit: DD-12
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

Three CX-contract violations bundled into one low-priority task: (1) the ForensicsPage empty state CTA must be hidden when the user lacks `forensics:write`, (2) CorrelationHeatmap hardcoded axis colors must reference CSS design tokens, (3) InvestigationWorkspace's loading state must be a module-shaped skeleton, not plain text.

## Spec Excerpt (verbatim)

> CTAs in empty states are **permission-aware**: rendered only if the user has the permission to take the action. If not, show description only (no orphaned "Get started" button the user can't use).
> — SPEC_MANIFEST.md, §CX-EMPTY, Non-negotiable #3

> All colors, spacing, radius, shadow, and typography values reference **CSS custom properties** from the token registry. No hardcoded hex colors, no hardcoded pixel values for semantic properties.
> — SPEC_MANIFEST.md, §CX-TOKENS, Non-negotiable #1

> Each module provides a **module-shaped skeleton** that matches the structure of the content being loaded.
> — SPEC_MANIFEST.md, §CX-LOADING, Non-negotiable #1

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/forensics/index.tsx` — `EmptyState` component lines 242–281; always renders "New Investigation" button
- `frontend/src/pages/forensics/InvestigationWorkspace.tsx` — loading state at lines 1374–1388: plain centered text
- `frontend/src/pages/forensics/InvestigationWorkspace.tsx` — `CorrelationHeatmap` at lines 987–1073: hardcoded colors `#a1a1aa`, `#3f3f46`, `#2563eb`, `#27272a`, `#2dd4bf`

## Verification Checklist

- [ ] `EmptyState` in index.tsx checks `usePermission('forensics:write')` and omits the "New Investigation" button when permission is absent
- [ ] `CorrelationHeatmap` axis label color uses `var(--io-text-muted)` instead of hardcoded `#a1a1aa`
- [ ] `CorrelationHeatmap` axis line color uses `var(--io-border)` instead of hardcoded `#3f3f46`
- [ ] Heatmap gradient colors (blue/neutral/teal) are acceptable exceptions if they are semantic to the visualization and not general UI chrome — document this decision
- [ ] InvestigationWorkspace loading state renders a skeleton matching the two-panel layout (left panel skeleton + stage list skeleton), not plain text

## Assessment

- **Status**: ⚠️ Multiple minor violations
- **If partial/missing**:
  1. index.tsx:264–278 — "New Investigation" CTA always rendered in EmptyState, no permission check
  2. InvestigationWorkspace.tsx:1374–1388 — `<div style={{ alignItems:'center', justifyContent:'center' }}>Loading investigation...</div>` — plain text, not a skeleton
  3. CorrelationHeatmap:1029,1033,1037 — `color: '#a1a1aa'` and `lineStyle: { color: '#3f3f46' }` are hardcoded hex values for UI chrome

## Fix Instructions

**Fix 1 — EmptyState CTA permission gate** (index.tsx):
```tsx
function EmptyState({ onNew }: { onNew: () => void }) {
  const canWrite = usePermission('forensics:write')
  return (
    <div ...>
      ...description text...
      {canWrite && (
        <button onClick={onNew}>New Investigation</button>
      )}
    </div>
  )
}
```

**Fix 2 — CorrelationHeatmap token compliance** (InvestigationWorkspace.tsx):
Replace hardcoded axis colors:
- `color: '#a1a1aa'` → `color: 'var(--io-text-muted)'` (but note ECharts requires a string, not a CSS var; compute the actual CSS value via `getComputedStyle(document.documentElement).getPropertyValue('--io-text-muted').trim()` at render time, or accept this as an ECharts limitation and document it)
- `lineStyle: { color: '#3f3f46' }` → same pattern using `--io-border`
- The heatmap gradient colors `['#2563eb', '#27272a', '#2dd4bf']` are semantically meaningful to the visualization (blue = positive correlation, neutral = zero, teal = negative). These may be kept as-is with a code comment explaining they are visualization-semantic, not theme-sensitive.

**Fix 3 — Loading skeleton** (InvestigationWorkspace.tsx:1374–1388):
Replace the centered text with a two-panel skeleton:
```tsx
if (query.isLoading) {
  return (
    <div style={{ height:'100%', display:'flex' }}>
      {/* Left panel skeleton */}
      <div style={{ width:'260px', borderRight:'1px solid var(--io-border)', padding:'12px', display:'flex', flexDirection:'column', gap:'8px' }}>
        {[80, 60, 100, 60, 80].map((h, i) => (
          <div key={i} style={{ height:`${h}px`, background:'var(--io-surface-secondary)', borderRadius:'6px', animation:'io-skeleton-pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
      {/* Stage list skeleton */}
      <div style={{ flex:1, padding:'16px 20px', display:'flex', flexDirection:'column', gap:'12px' }}>
        {[200, 160, 220].map((h, i) => (
          <div key={i} style={{ height:`${h}px`, background:'var(--io-surface-secondary)', borderRadius:'8px', animation:'io-skeleton-pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    </div>
  )
}
```

Do NOT:
- Replace the ECharts heatmap gradient colors with CSS vars — ECharts does not read CSS vars from series colors at runtime; document the exception instead
- Add the permission check outside the `EmptyState` component — keep the check internal
