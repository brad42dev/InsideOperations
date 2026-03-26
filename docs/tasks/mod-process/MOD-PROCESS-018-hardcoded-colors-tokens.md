---
id: MOD-PROCESS-018
title: Replace hardcoded hex colors with design tokens in Process module
unit: MOD-PROCESS
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

All colors in the Process module must reference CSS custom properties from the design token registry. Three locations contain hardcoded hex colors: the connection status dot indicators, the hover tooltip font family, and the ProcessMinimap canvas background. These break the light and hphmi themes.

## Spec Excerpt (verbatim)

> All colors, spacing, radius, shadow, and typography values reference **CSS custom properties** from the token registry. No hardcoded hex colors, no hardcoded pixel values for semantic properties.
> All 3 themes must work: **dark** (default), **light**, **hphmi** (high-contrast). Switching theme at runtime must not require a page reload.
> — SPEC_MANIFEST.md, §CX-TOKENS

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/process/index.tsx:1060-1064` — connection status dot colors: `#22C55E`, `#EAB308`, `#EF4444`
- `frontend/src/pages/process/index.tsx:1287` — tooltip font: `'JetBrains Mono, monospace'`
- `frontend/src/pages/process/ProcessMinimap.tsx:115` — canvas background: `#1a1f2e`
- `frontend/src/shared/graphics/tokens.ts` (or `frontend/src/styles/tokens.css`) — the token registry for available values

## Verification Checklist

- [ ] Connection status indicator uses token colors (e.g., `var(--io-status-good)`, `var(--io-status-warning)`, `var(--io-status-error)`) not `#22C55E`, `#EAB308`, `#EF4444`.
- [ ] Tooltip monospace font uses `var(--io-font-mono)` or equivalent token, not hardcoded `'JetBrains Mono, monospace'`.
- [ ] Minimap canvas background uses a CSS variable value resolved at render time (via `getComputedStyle`), not a hardcoded `#1a1f2e`.
- [ ] All 3 themes (dark, light, hphmi) render the Process module without incorrect colors.

## Assessment

- **Status**: ⚠️ Wrong
- `index.tsx:1060-1064`: `{ color: '#22C55E' }`, `{ color: '#EAB308' }`, `{ color: '#EF4444' }` — hardcoded status colors.
- `index.tsx:1287`: `fontFamily: 'JetBrains Mono, monospace'` — should be a token.
- `ProcessMinimap.tsx:115`: `ctx.fillStyle = '#1a1f2e'` — canvas 2D context cannot use CSS vars directly; needs `getComputedStyle` resolution.

## Fix Instructions

**1. Connection status colors** (`index.tsx:1060-1064`):
```typescript
const connectedDot = connectionState === 'connected'
  ? { color: 'var(--io-status-good)', label: 'Connected' }
  : connectionState === 'connecting'
    ? { color: 'var(--io-status-warning)', label: 'Connecting' }
    : { color: 'var(--io-status-error)', label: 'Disconnected' }
```
Check `frontend/src/styles/tokens.css` for the exact token names — they may be `--io-state-good`, `--io-state-degraded`, `--io-state-fault`, or similar. Also check `index.tsx:1290` (quality color in tooltip) for the same `#22C55E`/`#EF4444`/`#F59E0B` pattern — replace those too.

**2. Tooltip font** (`index.tsx:1287`):
```typescript
fontFamily: 'var(--io-font-mono)',
```

**3. Minimap canvas background** (`ProcessMinimap.tsx:115`):
Canvas 2D context cannot use CSS variables directly. Resolve at draw time:
```typescript
const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--io-surface-primary').trim() || '#09090B'
ctx.fillStyle = bgColor
```
Call this inside the `useEffect` that draws the canvas (line ~104), so it re-resolves when the theme changes.

Do NOT:
- Replace alarm/state colors (critical/high/medium) with tokens — alarm colors are ISA-101 fixed values and must NOT change with theme (see CX-TOKENS §Non-negotiables #3).
- Try to use CSS variables directly in `ctx.fillStyle` — browsers do not resolve them there.
