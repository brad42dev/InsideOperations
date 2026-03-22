---
id: MOD-DESIGNER-010
title: Add nested error boundaries, fix [Reload Module] label, module-shaped loading skeleton, and hardcoded colors
unit: MOD-DESIGNER
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Four related Wave 0 compliance issues in the Designer module need to be fixed:
1. The ErrorBoundary `onClick` button label must say "[Reload Module]" not "Try again".
2. The Designer needs nested error boundaries around its three main panels (canvas, left palette, right panel) so a crash in one panel does not kill the others.
3. The `LoadingSkeleton` component in `index.tsx` must be replaced with a structural skeleton that mirrors the Designer layout (toolbar strip + left palette strip + canvas area + right panel strip).
4. Three hardcoded hex colors must be replaced with design tokens.

## Spec Excerpt (verbatim)

> Error UI shows: generic error message + **[Reload Module]** button (remounts the module component, no full page reload).
> Large modules (Console, Forensics, Designer) have **nested error boundaries** around individual panes/panels — a single pane crash must not kill the whole module.
> — docs/SPEC_MANIFEST.md, CX-ERROR Non-Negotiables #2, #3

> Each module provides a **module-shaped skeleton** that matches the structure of the content being loaded. Not a generic shimmer bar or spinner covering the whole area.
> — docs/SPEC_MANIFEST.md, CX-LOADING Non-Negotiable #1

> All colors, spacing, radius, shadow, and typography values reference CSS custom properties from the token registry. No hardcoded hex colors.
> — docs/SPEC_MANIFEST.md, CX-TOKENS Non-Negotiable #1

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/ErrorBoundary.tsx:49` — button says "Try again"
- `frontend/src/pages/designer/index.tsx:232-246` — `LoadingSkeleton()` returns plain text "Loading graphic…"
- `frontend/src/pages/designer/index.tsx:990-1062` — main body layout wrapping canvas, left palette, right panel — no ErrorBoundary wrappers around individual panels
- `frontend/src/pages/designer/index.tsx:239` — `background: '#0a0a0b'` (should be `var(--io-surface-primary)`)
- `frontend/src/pages/designer/index.tsx:263` — `color: '#ef4444'` (should be `var(--io-status-error)` or `var(--io-alarm-critical)`)
- `frontend/src/pages/designer/index.tsx:162` — `color: '#09090b'` (should be `var(--io-text-on-accent)` or similar)

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `ErrorBoundary.tsx:49` button text is "[Reload Module]" (or "Reload Module" if brackets would be odd in HTML)
- [ ] `DesignerCanvas.tsx` is wrapped in `<ErrorBoundary module="Designer Canvas">` inside `DesignerPage`
- [ ] `DesignerLeftPalette` is wrapped in `<ErrorBoundary module="Designer Palette">` inside `DesignerPage`
- [ ] `DesignerRightPanel` is wrapped in `<ErrorBoundary module="Designer Properties">` inside `DesignerPage`
- [ ] `LoadingSkeleton` renders a structural div with approximate Designer layout (toolbar-height strip + flex row with left panel width + canvas fill + right panel width)
- [ ] `index.tsx:239` uses `var(--io-surface-primary)` not `#0a0a0b`
- [ ] `index.tsx:263` uses `var(--io-status-error)` not `#ef4444`
- [ ] `index.tsx:162` uses a token not `#09090b`

## Assessment

After checking:
- **Status**: ⚠️ Multiple — all four issues confirmed above

## Fix Instructions

**1. ErrorBoundary button label** — in `frontend/src/shared/components/ErrorBoundary.tsx`, line 49:
Change `Try again` to `Reload Module`. Note: this affects ALL modules using ErrorBoundary, which is correct per spec.

**2. Nested error boundaries** — in `frontend/src/pages/designer/index.tsx`, lines 990-1062, wrap each panel:

```tsx
{/* Left palette */}
{!leftCollapsed && (
  <div style={{ width: leftWidth, ... }}>
    <ErrorBoundary module="Designer Palette">
      <DesignerLeftPalette collapsed={false} width={leftWidth} />
    </ErrorBoundary>
    <CollapseBtn ... />
  </div>
)}

{/* Canvas */}
<div style={{ flex: 1, ... }}>
  {loading && <LoadingSkeleton />}
  {loadError && <ErrorState message={loadError} onRetry={loadDoc} />}
  {!loading && !loadError && (
    <ErrorBoundary module="Designer Canvas">
      <DesignerCanvas style={{ flex: 1 }} />
    </ErrorBoundary>
  )}
</div>

{/* Right panel */}
{!rightCollapsed && (
  <div style={{ width: rightWidth, ... }}>
    <ErrorBoundary module="Designer Properties">
      <DesignerRightPanel collapsed={false} width={rightWidth} />
    </ErrorBoundary>
    <CollapseBtn ... />
  </div>
)}
```

**3. Module-shaped loading skeleton** — replace `LoadingSkeleton()` at line 232 with:

```tsx
function LoadingSkeleton() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--io-surface-primary)', overflow: 'hidden' }}>
      {/* Toolbar row */}
      <div style={{ height: 40, background: 'var(--io-surface)', borderBottom: '1px solid var(--io-border)', flexShrink: 0 }} />
      {/* Body row */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left palette */}
        <div style={{ width: 240, background: 'var(--io-surface-secondary)', borderRight: '1px solid var(--io-border)', flexShrink: 0 }} />
        {/* Canvas */}
        <div style={{ flex: 1, background: 'var(--io-surface-primary)' }} />
        {/* Right panel */}
        <div style={{ width: 300, background: 'var(--io-surface-secondary)', borderLeft: '1px solid var(--io-border)', flexShrink: 0 }} />
      </div>
      {/* Status bar */}
      <div style={{ height: 28, background: 'var(--io-surface)', borderTop: '1px solid var(--io-border)', flexShrink: 0 }} />
    </div>
  )
}
```

**4. Hardcoded colors** — replace in `index.tsx`:
- Line 239: `background: '#0a0a0b'` → `background: 'var(--io-surface-primary)'`
- Line 263: `color: '#ef4444'` → `color: 'var(--io-status-error)'`
- Line 162 and 125: `color: '#09090b'` → `color: 'var(--io-text-on-accent)'` (check token registry in `tokens.ts` for the exact token name for dark text on accent background)

Do NOT:
- Change the ErrorBoundary button to trigger `window.location.reload()` — it must remount the component via `setState({ hasError: false })`
- Use the same structural skeleton for all modules (each module's skeleton should match its own layout)
