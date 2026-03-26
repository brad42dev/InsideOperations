---
id: DD-31-010
title: Replace generic text loading states with module-shaped skeletons (CX-LOADING)
unit: DD-31
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

Every loading state in the Alerts module must render a structural skeleton that matches the shape of the content being loaded — not a generic "Loading…" text string. The skeleton must appear immediately on navigation so there is no blank flash. The active alerts list skeleton should show rows with colored severity badge placeholders; the history table skeleton should show table-row shimmer; the muster dashboard skeleton should show the summary bar and card grid shapes.

## Spec Excerpt (verbatim)

> Each module provides a module-shaped skeleton that matches the structure of the content being loaded. Not a generic shimmer bar or spinner covering the whole area.
> Skeleton must appear immediately on navigation (no blank flash before skeleton).
> — `docs/SPEC_MANIFEST.md`, §CX-LOADING Non-negotiables

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/alerts/index.tsx` line 533 — `"Loading active alerts…"` text
- `frontend/src/pages/alerts/AlertHistory.tsx` line 131 — `"Loading…"` text
- `frontend/src/pages/alerts/AlertGroups.tsx` line 197 — `"Loading…"` text
- `frontend/src/pages/alerts/MusterDashboard.tsx` line 503 — `"Loading muster data…"` text
- `frontend/src/pages/alerts/AlertTemplates.tsx` line 181 — `"Loading…"` text
- `frontend/src/shared/components/` — check for an existing `Skeleton` or `SkeletonRow` primitive

## Verification Checklist

- [ ] Active alerts loading state shows placeholder alert card shapes (not text)
- [ ] Alert history loading state shows placeholder table rows (column-aligned shimmer)
- [ ] Groups loading state shows placeholder group row shapes
- [ ] Templates loading state shows placeholder template row shapes
- [ ] Muster dashboard loading state shows summary bar skeleton + card grid skeleton

## Assessment

- **Status**: ❌ Missing
- **If missing**: All files use either `<p style="...">Loading…</p>` or `<div style="...">Loading…</div>` as their loading state. None render structural skeleton shapes.

## Fix Instructions

1. Check `frontend/src/shared/components/` for any existing `Skeleton`, `SkeletonRow`, or `SkeletonCard` component. If present, use it. If not, create a simple one with CSS animation shimmer.
2. For the history table, create a `SkeletonTableRow` that renders 6 cells with matching column widths matching the actual grid (`gridTemplateColumns: '120px 1fr 150px 160px 80px 90px'`).
3. For the active alerts panel, create a `SkeletonAlertCard` that renders the card's colored left border area, title line, and metadata lines.
4. For the muster dashboard, create a `SkeletonSummaryBar` and `SkeletonPersonCard`.
5. Replace each `isLoading && <div>Loading…</div>` with the appropriate skeleton component. Render N=3 skeleton rows/cards while loading.

Do NOT:
- Use a single full-page spinner that covers all content
- Leave the `Loading…` text in place as a fallback
