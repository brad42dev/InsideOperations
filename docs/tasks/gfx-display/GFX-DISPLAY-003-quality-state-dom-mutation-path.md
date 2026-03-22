---
id: GFX-DISPLAY-003
title: Complete quality state handling in DOM mutation path (applyPointValue)
unit: GFX-DISPLAY
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

When point values arrive in real-time, display elements are updated via direct SVG DOM mutation (`applyPointValue`) — not via React re-render. The DOM mutation path must apply all 6 quality states with the same fidelity as the React render path. Currently the DOM path handles `bad` (value text) and `stale` (opacity) but misses: `comm_fail` border color, `stale` dashed border stroke, `uncertain` dotted border, and `manual` badge insertion/removal.

## Spec Excerpt (verbatim)

> **Quality states** — all 6 states must produce specific rendered output (just checking "a state exists" is wrong):
> - `bad` → red (`#EF4444`) **dashed** border around entire element; `????` value text
> - `comm_fail` → gray (`#52525B`) border; "COMM" text overlaid on value
> - `stale` → entire element at 60% opacity + **dashed** border
> - `uncertain` → **dotted** border instead of solid
> - `manual` → cyan (`#06B6D4`) "M" badge in top-right corner
> — docs/SPEC_MANIFEST.md, §GFX-DISPLAY Non-Negotiable 8

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/graphics/SceneRenderer.tsx` — `applyPointValue()` function at lines 994–1123. Specifically the `text_readout` case at lines 1007–1025.
- `frontend/src/shared/graphics/SceneRenderer.tsx` — `renderDisplayElement()` text_readout React render at lines 475–517 (the reference-correct implementation to match)
- `frontend/src/shared/graphics/SceneRenderer.tsx` — `WsPointValue` interface at lines 22–34 — check it has `quality`, `stale`, `manual` fields

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `applyPointValue` text_readout case reads `pv.quality` and handles `'uncertain'` → sets `strokeDasharray="2 2"` on the box rect
- [ ] `applyPointValue` text_readout case reads `pv.manual` and adds/removes the "M" badge `<text>` element (or toggles its `display` style) based on the boolean
- [ ] `applyPointValue` text_readout case sets `strokeDasharray="4 2"` on the box rect for both `bad` AND `stale` states
- [ ] `applyPointValue` text_readout case sets `stroke="#52525B"` (not `#3F3F46`) for `comm_fail` — matching spec's gray border requirement
- [ ] The React render path (`renderDisplayElement` text_readout) also uses `#52525B` for `comm_fail` border (currently uses `#3F3F46`, which is wrong)

## Assessment

After checking:
- **Status**: ⚠️ Partial
- **What specifically needs to change**:
  1. `applyPointValue` text_readout (line 1007–1025): No `quality` variable read. No `strokeDasharray` update. No manual badge. Only opacity (for stale) and value text (for bad/comm_fail) are handled.
  2. React render path: `comm_fail` border color wrong — `boxStroke` falls through to `'#3F3F46'` (line 492), but spec requires `'#52525B'` for comm_fail.

## Fix Instructions

**In `applyPointValue()` text_readout case** (SceneRenderer.tsx ~line 1007), expand the logic:

```typescript
case 'text_readout': {
  const cfg = config as TextReadoutConfig
  const quality = pv.quality
  const isStale = pv.stale ?? false
  const isManual = pv.manual ?? false
  const isCommFail = quality === 'comm_fail'
  const isBad = quality === 'bad' && !isCommFail
  const isUncertain = quality === 'uncertain'

  // Value text
  const rawValueStr = isCommFail ? 'COMM' : isBad ? '????' : formatValue(pv.value, cfg.valueFormat)
  const valueColor = isCommFail ? '#71717A' : isBad ? '#EF4444' : '#A1A1AA'
  const textEl = el.querySelector<SVGTextElement>('[data-role="value"]')
  if (textEl) {
    textEl.textContent = rawValueStr
    textEl.setAttribute('fill', valueColor)
  }

  // Box rect (fill, stroke, strokeDasharray)
  const boxFill = isCommFail ? '#3F3F46' : '#27272A'
  const boxStroke = isBad ? '#EF4444' : isCommFail ? '#52525B' : '#3F3F46'
  const strokeDash = (isBad || isStale) ? '4 2' : isUncertain ? '2 2' : ''
  const strokeWidth = (isBad || isCommFail) ? '2' : '1'
  const rectEl = el.querySelector<SVGRectElement>('[data-role="box"]')
  if (rectEl) {
    rectEl.setAttribute('fill', boxFill)
    rectEl.setAttribute('stroke', boxStroke)
    rectEl.setAttribute('stroke-width', strokeWidth)
    if (strokeDash) {
      rectEl.setAttribute('stroke-dasharray', strokeDash)
    } else {
      rectEl.removeAttribute('stroke-dasharray')
    }
  }

  // Opacity (stale = 60%)
  el.style.opacity = isStale ? '0.6' : ''

  // Manual badge — find or create
  let badge = el.querySelector<SVGTextElement>('[data-role="manual-badge"]')
  if (isManual) {
    if (!badge) {
      badge = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      badge.setAttribute('data-role', 'manual-badge')
      badge.setAttribute('text-anchor', 'end')
      badge.setAttribute('dominant-baseline', 'hanging')
      badge.setAttribute('font-family', 'Inter')
      badge.setAttribute('font-size', '7')
      badge.setAttribute('font-weight', '700')
      badge.setAttribute('fill', '#06B6D4')
      el.appendChild(badge)
    }
    // Position at top-right — read width from box rect
    const w = rectEl ? Number(rectEl.getAttribute('width') ?? 60) : 60
    badge.setAttribute('x', String(w - 2))
    badge.setAttribute('y', '2')
    badge.textContent = 'M'
    badge.style.display = ''
  } else if (badge) {
    badge.style.display = 'none'
  }
  break
}
```

**Also fix the React render path** for `comm_fail` border color (SceneRenderer.tsx ~line 491–492):

Current (wrong):
```typescript
const boxStroke = isBad ? '#EF4444' : alarmColor ?? '#3F3F46'
```

Correct:
```typescript
const boxStroke = isBad ? '#EF4444' : isCommFail ? '#52525B' : alarmColor ?? '#3F3F46'
```

Also add `data-role="manual-badge"` to the manual badge `<text>` element in the React render (SceneRenderer.tsx ~line 513) so the DOM mutation path can find it:
```tsx
<text data-role="manual-badge" x={w - 2} y={2} ...>M</text>
```

Do NOT:
- Use `querySelector('[fill="#06B6D4"]')` to find the badge — always use `data-role` attributes
- Skip clearing `strokeDasharray` when quality returns to good — always explicitly remove it
- Forget to handle the case where `pv.quality` is undefined (treat as `'good'`)
